const nodemailer = require('nodemailer');

const smtpHost = String(process.env.SMTP_HOST || '').trim();
const smtpPort = Number.parseInt(process.env.SMTP_PORT || '587', 10) || 587;
const smtpUser = String(process.env.SMTP_USER || '').trim();
const smtpPass = String(process.env.SMTP_PASS || '').trim();
const smtpFrom = String(process.env.SMTP_FROM || '').trim();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

console.log('SES SMTP email service initialized', {
  host: smtpHost || '(missing)',
  configuredPort: smtpPort,
  activePort: 587,
  from: smtpFrom || '(missing)'
});

if (smtpPort !== 587) {
  console.warn(`SMTP_PORT is ${smtpPort}, but SES SMTP transport is configured to use port 587.`);
}

async function sendEmail(to, subject, text) {
  const recipient = String(to || '').trim();
  const mailSubject = String(subject || '').trim();
  const bodyText = String(text || '').trim();

  if (!recipient) {
    console.error('sendEmail failed: missing recipient');
    return { success: false, error: 'Recipient email is required' };
  }

  if (!mailSubject) {
    console.error(`sendEmail failed for ${recipient}: missing subject`);
    return { success: false, error: 'Email subject is required' };
  }

  if (!bodyText) {
    console.error(`sendEmail failed for ${recipient}: missing text`);
    return { success: false, error: 'Email text is required' };
  }

  const missingConfig = [
    !smtpHost ? 'SMTP_HOST' : null,
    !process.env.SMTP_PORT ? 'SMTP_PORT' : null,
    !smtpUser ? 'SMTP_USER' : null,
    !smtpPass ? 'SMTP_PASS' : null,
    !smtpFrom ? 'SMTP_FROM' : null
  ].filter(Boolean);

  if (missingConfig.length > 0) {
    const message = `Missing required SMTP environment variables: ${missingConfig.join(', ')}`;
    console.error(`sendEmail failed for ${recipient}: ${message}`);
    return { success: false, error: message };
  }

  try {
    console.log(`Sending SES SMTP email to ${recipient} from ${smtpFrom}`);

    const info = await transporter.sendMail({
      from: smtpFrom,
      to: recipient,
      subject: mailSubject,
      text: bodyText
    });

    console.log(`Email sent successfully to ${recipient}`, {
      messageId: info.messageId,
      response: info.response
    });

    return {
      success: true,
      messageId: info.messageId,
      response: info.response
    };
  } catch (error) {
    const detail = [error.code, error.response, error.message].filter(Boolean).join(' | ');
    console.error(`sendEmail failed for ${recipient}:`, detail || error.toString());
    return {
      success: false,
      error: detail || 'Unknown SMTP send error'
    };
  }
}

module.exports = {
  sendEmail
};
