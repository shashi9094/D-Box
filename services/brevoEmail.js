const nodemailer = require('nodemailer');

const SMTP_HOST = String(process.env.SMTP_HOST || '').trim();
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = String(process.env.SMTP_USER || '').trim();
const SMTP_PASS = String(process.env.SMTP_PASS || '').trim();
const FROM_EMAIL = String(process.env.FROM_EMAIL || process.env.SMTP_FROM || 'no-reply@example.com').trim();

console.log('Brevo mailer initializing', {
  host: SMTP_HOST || '(missing)',
  port: SMTP_PORT,
  user: SMTP_USER ? SMTP_USER.replace(/.(?=.{2,}@)/g, '*') : '(missing)',
  from: FROM_EMAIL || '(missing)'
});

const transporter = nodemailer.createTransport({
  host: SMTP_HOST || 'smtp-relay.brevo.com',
  port: SMTP_PORT || 587,
  secure: false,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  }
});

async function sendEmail(to, subject, html, text) {
  if (!to || !to.includes('@')) {
    return { success: false, error: 'Invalid recipient' };
  }

  if (!FROM_EMAIL || !FROM_EMAIL.includes('@')) {
    console.error('Missing FROM_EMAIL env variable');
    return { success: false, error: 'Missing FROM_EMAIL configuration' };
  }

  try {
    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      to,
      subject,
      text: text || undefined,
      html: html || undefined
    });

    console.log('Brevo sendMail success', { to, messageId: info.messageId });

    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('Brevo sendMail error', err && (err.message || err));
    return { success: false, error: err && (err.message || String(err)) };
  }
}

function buildOtpHtml(otp, purpose) {
  const safePurpose = String(purpose || 'verification');
  return `
    <div style="font-family: Arial, sans-serif; max-width:640px; margin:0 auto; color:#111;">
      <h2 style="color:#1f2937">Your ${safePurpose} code</h2>
      <p style="font-size:18px;">Use the code below. It expires in 10 minutes.</p>
      <div style="font-size:28px; font-weight:700; letter-spacing:4px; margin:18px 0; background:#f3f4f6; padding:12px 20px; display:inline-block; border-radius:8px">${otp}</div>
      <p style="color:#6b7280; font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;
}

function buildInviteHtml(inviterName, inviteLink) {
  return `
    <div style="font-family: Arial, sans-serif; max-width:640px; margin:0 auto; color:#111;">
      <h2 style="color:#1f2937">You're invited to D-Box</h2>
      <p>${inviterName || 'Someone'} has invited you to join D-Box. Click the button below to accept the invite.</p>
      <a href="${inviteLink}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#6d28d9;color:#fff;text-decoration:none">Accept Invite</a>
    </div>
  `;
}

module.exports = {
  sendEmail,
  buildOtpHtml,
  buildInviteHtml
};
