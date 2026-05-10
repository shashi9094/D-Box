const nodemailer = require('nodemailer');

const host = String(process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com').trim();
const port = Number(process.env.BREVO_SMTP_PORT || 587);
const user = String(process.env.BREVO_SMTP_USER || '').trim();
const pass = String(process.env.BREVO_SMTP_PASS || '').trim();
const senderEmail = String(process.env.SMTP_FROM || user || 'no-reply@mydbox.local').trim();

const transporter = nodemailer.createTransport({
    host,
    port,
    secure: false,
    auth: {
        user,
        pass,
    },
});

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
        const info = await transporter.sendMail({
            from: `MyDbox <${senderEmail}>`,
            to: recipient,
            subject: 'Your OTP Code',
            text: `Your D-Box verification OTP is: ${safeOtp}\n\nThis code is valid for 5 minutes.\n\nIf you did not request this OTP, please ignore this email.`,
            html: `
                <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;border:1px solid #e5e7eb;border-radius:12px;line-height:1.6;color:#111827;">
                    <h2 style="margin:0 0 10px;color:#0f172a;">Your OTP Code</h2>
                    <p style="margin:0 0 14px;">Use the OTP below to continue:</p>
                    <div style="margin:0 0 14px;padding:12px 16px;background:#f3f4f6;border-radius:8px;font-size:28px;font-weight:700;letter-spacing:6px;text-align:center;">${safeOtp}</div>
                    <p style="margin:0 0 10px;">This code is valid for <strong>5 minutes</strong>.</p>
                    <p style="margin:0;color:#6b7280;font-size:13px;">If you did not request this OTP, you can safely ignore this email.</p>
                </div>
            `,
        });

        return { success: true, messageId: info.messageId };
    } catch (error) {
        return { success: false, error: error.message || 'Failed to send OTP email' };
    }
}

module.exports = {
    transporter,
    sendOTP,
};
