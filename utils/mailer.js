const nodemailer = require('nodemailer');
const { sendEmail } = require('../emailService');

const host = String(process.env.SMTP_HOST || 'smtp-relay.brevo.com').trim();
const port = Number(process.env.SMTP_PORT || 465);
const user = String(process.env.SMTP_USER || '').trim();
const pass = String(process.env.SMTP_PASS || '').trim();
const senderEmail = String(process.env.SMTP_FROM || user || 'no-reply@mydbox.local').trim();

const isEmail = (value) => /.+@.+\..+/.test(String(value || '').trim());

const summarizeMailerError = (error) => ({
    message: error?.message || 'Failed to send OTP email',
    code: error?.code || error?.name || null,
    response: error?.response || error?.responseCode || null,
    command: error?.command || null,
    stack: error?.stack || null,
});

const transporter = nodemailer.createTransport({
    host,
    port,
    secure: true, 
    auth: {
        user,
        pass,
    },
});

console.log('OTP mailer initialized', {
    host,
    port,
    hasCredentials: Boolean(user && pass),
    senderEmail,
    senderEmailValid: isEmail(senderEmail),
});

transporter.verify()
    .then(() => {
        console.log('OTP mailer transporter verified successfully');
    })
    .catch((error) => {
        console.error('OTP mailer transporter verify failed:', summarizeMailerError(error));
    });

function withTimeout(promise, timeoutMs, timeoutMessage) {
    let timer = null;
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timer) {
            clearTimeout(timer);
        }
    });
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
        console.log('STEP 1 sendOTP received request', { recipient, otpLength: safeOtp.length });

        const bodyText = `Your D-Box verification OTP is: ${safeOtp}\n\nThis code is valid for 5 minutes.\n\nIf you did not request this OTP, please ignore this email.`;

        console.log('STEP 2 sendOTP delegating to sendEmail');
        const result = await withTimeout(
            sendEmail(
                recipient,
                'Your OTP Code',
                bodyText
            ),
            15000,
            'OTP email send timed out'
        );

        console.log('STEP 4 email result', result);

        if (!result || !result.success) {
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
