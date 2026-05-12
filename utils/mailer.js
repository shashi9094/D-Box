const { sendEmail } = require('../emailService');

const host = String(process.env.SMTP_HOST || 'smtp-relay.brevo.com').trim();
const port = Number(process.env.SMTP_PORT || 587);
const user = String(process.env.SMTP_USER || '').trim();
const pass = String(process.env.SMTP_PASS || '').trim();
const senderEmail = String(process.env.SMTP_FROM || user || 'no-reply@mydbox.local').trim();
const secureSetting = String(process.env.SMTP_SECURE || '').trim().toLowerCase();
const secure = secureSetting ? secureSetting === 'true' : port === 465;

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

function buildSendOptions() {
    return {
        timeoutMs: Number(process.env.SMTP_SEND_TIMEOUT_MS || 30000),
        maxAttempts: Math.max(1, Number(process.env.SMTP_SEND_MAX_ATTEMPTS || 3)),
        retryDelayMs: Math.max(0, Number(process.env.SMTP_SEND_RETRY_DELAY_MS || 1000)),
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

    try {
        console.log('OTP send request received', {
            recipient,
            otpLength: safeOtp.length,
            host,
            port,
            secure,
        });

        const bodyText = `Your D-Box verification OTP is: ${safeOtp}\n\nThis code is valid for 5 minutes.\n\nIf you did not request this OTP, please ignore this email.`;

        const sendOptions = buildSendOptions();
        console.log('OTP send delegating to sendEmail', sendOptions);

        const result = await sendEmail(recipient, 'Your OTP Code', bodyText);

        console.log('OTP send result', result);

        if (!result || !result.success) {
            console.error('OTP email send failed', {
                recipient,
                error: result?.error || 'Failed to send OTP email',
                code: result?.code || null,
                response: result?.response || null,
                stack: result?.stack || null,
            });

            return {
                success: false,
                error: result?.error || 'Failed to send OTP email',
                code: result?.code || null,
                response: result?.response || null,
                stack: result?.stack || null,
            };
        }

        return { success: true, messageId: result.messageId || null };
    } catch (error) {
        console.error('OTP EMAIL ERROR:', summarizeMailerError(error));

        return {
            success: false,
            ...summarizeMailerError(error),
        };
    }
}

module.exports = {
    transporter,
    sendOTP,
};
