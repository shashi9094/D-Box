const nodemailer = require('nodemailer');
const { SESClient } = require('@aws-sdk/client-ses');

// ENV variables
const awsAccessKeyId = String(process.env.AWS_ACCESS_KEY_ID || '').trim();
const awsSecretAccessKey = String(process.env.AWS_SECRET_ACCESS_KEY || '').trim();
const awsRegion = String(process.env.AWS_REGION || '').trim();
const smtpHost = String(process.env.SMTP_HOST || 'smtp-relay.brevo.com').trim();
const smtpPort = Number(process.env.SMTP_PORT || 465);
const smtpUser = String(process.env.SMTP_USER || '').trim();
const smtpPass = String(process.env.SMTP_PASS || '').trim();
const smtpFrom = String(process.env.SMTP_FROM || smtpUser || '').trim();

const summarizeSesError = (error) => ({
  message: error?.message || 'SES send failed',
  code: error?.name || error?.code || null,
  requestId: error?.$metadata?.requestId || null,
  httpStatusCode: error?.$metadata?.httpStatusCode || null,
  stack: error?.stack || null,
});

const awsSesEnabled = process.env.ENABLE_AWS_SES === 'true';
let sesClient = null;

if (awsSesEnabled) {
  sesClient = new SESClient({
    region: awsRegion,
    credentials: {
      accessKeyId: awsAccessKeyId,
      secretAccessKey: awsSecretAccessKey
    }
  });

  console.log('AWS SES support configured (inactive sender)', {
    region: awsRegion || '(missing)',
    from: smtpFrom || '(missing)',
    hasAccessKey: Boolean(awsAccessKeyId),
    hasSecretKey: Boolean(awsSecretAccessKey),
  });
}

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: true,
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

console.log('Brevo SMTP email service initialized', {
  host: smtpHost,
  port: smtpPort,
  hasUser: Boolean(smtpUser),
  hasPass: Boolean(smtpPass),
  from: smtpFrom || '(missing)',
});

function extractFirstUrl(text) {
  const match = String(text || '').match(/https?:\/\/[^\s<>"')]+/i);
  return match ? match[0] : '';
}

function buildHtmlBody(subject, text) {
  const safeSubject = String(subject || '').trim();
  const safeText = String(text || '').trim();
  const verifyUrl = extractFirstUrl(safeText);

  const escapedText = safeText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');

  if (!verifyUrl) {
    return `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#111827;line-height:1.6">
        <h2 style="margin:0 0 16px 0">${safeSubject}</h2>
        <div>${escapedText}</div>
      </div>
    `;
  }

  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;background:#ffffff;color:#111827;line-height:1.6">
      <h2 style="margin:0 0 16px 0">${safeSubject}</h2>
      <div style="margin:0 0 24px 0">${escapedText}</div>
      <a href="${verifyUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700">Verify Account</a>
      <div style="margin-top:20px;font-size:12px;color:#6b7280;word-break:break-all">
        If the button does not work, copy and paste this link:<br/>
        <a href="${verifyUrl}" style="color:#2563eb">${verifyUrl}</a>
      </div>
    </div>
  `;
}

// MAIN FUNCTION
async function sendEmail(to, subject, text) {
  const recipient = String(to || '').trim();
  const mailSubject = String(subject || '').trim();
  const bodyText = String(text || '').trim();

  // Debug logs
  console.log("FROM:", smtpFrom);
  console.log("TO:", recipient);

  // Validation
  if (!recipient) {
    return { success: false, error: 'Recipient email is required' };
  }

  if (!recipient.includes('@')) {
    return { success: false, error: 'Invalid recipient email' };
  }

  if (!smtpFrom || !smtpFrom.includes('@')) {
    return { success: false, error: 'Invalid SMTP_FROM email' };
  }

  if (!mailSubject) {
    return { success: false, error: 'Email subject is required' };
  }

  if (!bodyText) {
    return { success: false, error: 'Email text is required' };
  }

  // Check ENV config
  const missingConfig = [
    !smtpHost ? 'SMTP_HOST' : null,
    !smtpPort ? 'SMTP_PORT' : null,
    !smtpUser ? 'SMTP_USER' : null,
    !smtpPass ? 'SMTP_PASS' : null,
    !smtpFrom ? 'SMTP_FROM' : null
  ].filter(Boolean);

  if (missingConfig.length > 0) {
    return {
      success: false,
      error: `Missing env variables: ${missingConfig.join(', ')}`
    };
  }

  try {

    console.log("Sending email via Brevo SMTP...");
    console.log({
      host: smtpHost,
      port: smtpPort,
      from: smtpFrom,
      to: recipient,
      subject: mailSubject
   });
    const result = await transporter.sendMail({
      from: smtpFrom,
      to: recipient,
      subject: mailSubject,
      text: bodyText,
      html: buildHtmlBody(mailSubject, bodyText),
    });

    console.log("Email sent:", result);

    return {
      success: true,
      messageId: result.messageId || null
    };

  } catch (error) {
    console.error("FULL SMTP ERROR:", error);

    return {
      success: false,
      error: error?.message || 'Failed to send email'
    };
  }
}

module.exports = {
  sendEmail
};