const nodemailer = require('nodemailer');

const host = String(process.env.SMTP_HOST || 'smtp-relay.brevo.com').trim();
const port = Number(process.env.SMTP_PORT || 587);
const user = String(process.env.SMTP_USER || '').trim();
const pass = String(process.env.SMTP_PASS || '').trim();
const senderEmail = String(process.env.SMTP_FROM || user || 'no-reply@mydbox.local').trim();
const secureSetting = String(process.env.SMTP_SECURE || '').trim().toLowerCase();
const secure = secureSetting ? secureSetting === 'true' : port === 465;
const connectionTimeoutMs = Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 30000);
const greetingTimeoutMs = Number(process.env.SMTP_GREETING_TIMEOUT_MS || 30000);
const socketTimeoutMs = Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 30000);
const sendTimeoutMs = Number(process.env.SMTP_SEND_TIMEOUT_MS || 30000);
const maxAttempts = Math.max(1, Number(process.env.SMTP_SEND_MAX_ATTEMPTS || 3));
const retryDelayMs = Math.max(0, Number(process.env.SMTP_SEND_RETRY_DELAY_MS || 1000));

const isEmail = (value) => /.+@.+\..+/.test(String(value || '').trim());

const summarizeMailerError = (error) => ({
    message: error?.message || 'Failed to send OTP email',
    code: error?.code || error?.name || null,
    response: error?.response || error?.responseCode || null,
    command: error?.command || null,
    stack: error?.stack || null,
});

console.log('OTP mailer initialized', {
    host,
    port,
    secure,
    hasCredentials: Boolean(user && pass),
    senderEmail,
    senderEmailValid: isEmail(senderEmail),
});

const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure,
    auth: {
        user,
        pass,
    },
    connectionTimeout: connectionTimeoutMs,
    greetingTimeout: greetingTimeoutMs,
    socketTimeout: socketTimeoutMs,
    tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2',
    },
});

transporter.verify()
    .then(() => {
        console.log('OTP mailer transporter verified successfully');
    })
    .catch((error) => {
        console.error('OTP mailer transporter verify failed:', summarizeMailerError(error));
    });

function withTimeout(promise, timeout, timeoutMessage) {
    let timer = null;
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutMessage)), timeout);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timer) {
            clearTimeout(timer);
        }
    });
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableSmtpError(error) {
    const code = String(error?.code || error?.name || '').toUpperCase();
    const responseCode = Number(error?.responseCode || error?.response?.code || 0);

    if (
        code === 'ETIMEDOUT' ||
        code === 'ESOCKET' ||
        code === 'ECONNECTION' ||
        code === 'ECONNRESET' ||
        code === 'EPIPE' ||
        code === 'EAI_AGAIN' ||
        code === 'ENOTFOUND' ||
        code === 'ECONNREFUSED'
    ) {
        return true;
    }

    return responseCode >= 400 && responseCode < 500;
}

function buildMessage(email, otp) {
    return {
        from: senderEmail,
        to: email,
        subject: 'Your OTP Code',
        text: `Your D-Box verification OTP is: ${otp}\n\nThis code is valid for 5 minutes.\n\nIf you did not request this OTP, please ignore this email.`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width:640px; margin:0 auto; color:#111;">
              <h2 style="color:#1f2937">Your verification code</h2>
              <p style="font-size:18px;">Use the code below. It expires in 5 minutes.</p>
              <div style="font-size:28px; font-weight:700; letter-spacing:4px; margin:18px 0; background:#f3f4f6; padding:12px 20px; display:inline-block; border-radius:8px">${otp}</div>
              <p style="color:#6b7280; font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
            </div>
        `,
    };
}

async function sendOTP(email, otp) {
    const recipient = String(email || '').trim().toLowerCase();
    const safeOtp = String(otp || '').trim();

    if (!recipient) {
        return { success: false, error: 'Recipient email is required' };
    }

    if (!/^[0-9]{6}$/.test(safeOtp)) {
        return { success: false, error: 'Invalid OTP format' };
    }

    if (!user || !pass) {
        return { success: false, error: 'Brevo SMTP credentials are missing' };
    }

    console.log('OTP send request received', {
        recipient,
        otpLength: safeOtp.length,
        host,
        port,
        secure,
    });

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const startedAt = Date.now();

        try {
            console.log('OTP email send attempt started', {
                attempt,
                totalAttempts: maxAttempts,
                recipient,
                host,
                port,
                secure,
                timeoutMs: sendTimeoutMs,
            });

            const info = await withTimeout(
                transporter.sendMail(buildMessage(recipient, safeOtp)),
                sendTimeoutMs,
                `OTP email send timed out after ${sendTimeoutMs}ms`
            );

            console.log('OTP email send succeeded', {
                attempt,
                totalAttempts: maxAttempts,
                recipient,
                messageId: info?.messageId || null,
                durationMs: Date.now() - startedAt,
            });

            return {
                success: true,
                messageId: info?.messageId || null,
            };
        } catch (error) {
            const summary = summarizeMailerError(error);
            const retryable = isRetryableSmtpError(error);

            console.error('OTP email send failed', {
                attempt,
                totalAttempts: maxAttempts,
                recipient,
                durationMs: Date.now() - startedAt,
                retryable,
                ...summary,
            });

            if (attempt < maxAttempts && retryable) {
                const delay = retryDelayMs * attempt;
                if (delay > 0) {
                    await sleep(delay);
                }
                continue;
            }

            return {
                success: false,
                error: summary.message,
                code: summary.code,
                response: summary.response,
                stack: summary.stack,
            };
        }
    }

    return {
        success: false,
        error: 'Failed to send OTP email',
        code: 'SMTP_RETRIES_EXHAUSTED',
        response: null,
        stack: null,
    };
}

async function sendOTPEmail(email, otp) {
    return sendOTP(email, otp);
}

module.exports = {
    transporter,
    sendOTPEmail,
    sendOTP,
};
