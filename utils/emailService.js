const nodemailer = require('nodemailer');

const smtpHost = String(process.env.SMTP_HOST || '').trim();
const smtpPort = Number.parseInt(process.env.SMTP_PORT || '587', 10) || 587;
const smtpUser = String(process.env.SMTP_USER || '').trim();
const smtpPass = String(process.env.SMTP_PASS || '').trim();
const fromAddress = String(process.env.SMTP_FROM || smtpUser).trim();

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: 587,
  secure: false,
  auth: {
    user: smtpUser,
    pass: smtpPass
  }
});

console.log('Email service configured for AWS SES SMTP with Nodemailer', {
  host: smtpHost || '(missing)',
  requestedPort: smtpPort,
  port: 587,
  from: fromAddress || '(missing)'
});

if (smtpPort !== 587) {
  console.warn(`SMTP_PORT is set to ${smtpPort}, but Nodemailer is configured to use port 587 for SES SMTP.`);
}

async function sendEmail(to, subject, text) {
  const recipient = String(to || '').trim();
  const mailSubject = String(subject || '').trim();
  const bodyText = String(text || '').trim();

  if (!recipient) {
    console.error('Email send failed: missing recipient address');
    return { success: false, error: 'Recipient email is required' };
  }

  if (!mailSubject) {
    console.error(`Email send failed for ${recipient}: missing subject`);
    return { success: false, error: 'Email subject is required' };
  }

  if (!bodyText) {
    console.error(`Email send failed for ${recipient}: missing body text`);
    return { success: false, error: 'Email text is required' };
  }

  if (!smtpHost || !smtpUser || !smtpPass) {
    const missingConfig = [
      !smtpHost ? 'SMTP_HOST' : null,
      !smtpUser ? 'SMTP_USER' : null,
      !smtpPass ? 'SMTP_PASS' : null
    ].filter(Boolean).join(', ');

    console.error(`Email send failed for ${recipient}: missing SMTP config (${missingConfig})`);
    return { success: false, error: `Missing SMTP config: ${missingConfig}` };
  }

  if (!fromAddress) {
    console.error(`Email send failed for ${recipient}: missing from address`);
    return { success: false, error: 'SMTP_FROM or SMTP_USER must provide a verified sender email' };
  }

  try {
    console.log(`Sending email to ${recipient} from ${fromAddress}`);

    const info = await transporter.sendMail({
      from: fromAddress,
      to: recipient,
      subject: mailSubject,
      text: bodyText
    });

    console.log(`Email sent to ${recipient}`, {
      messageId: info.messageId,
      response: info.response
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    const detail = [error.code, error.response, error.message]
      .filter(Boolean)
      .join(' | ');

    console.error(`Failed to send email to ${recipient}:`, detail || error.toString());
    return { success: false, error: detail || 'Unknown email error' };
  }
}

/**
 * Send invitation email to join a box/group using AWS SES SMTP via Nodemailer
 * @param {string} recipientEmail - Email to send to
 * @param {string} boxTitle - Name of the box/group
 * @param {string} senderName - Name of person sending invite
 * @param {string} joinUrl - URL for user to join/sign up
 * @returns {Promise<Object>}
 */
const sendInvitationEmail = async (recipientEmail, boxTitle, senderName, joinUrl) => {
  try {
    const recipientEmailTrimmed = String(recipientEmail || '').trim();
    if (!recipientEmailTrimmed) {
      return { success: false, error: 'Invalid recipient email' };
    }

    const subject = `You're invited to join "${boxTitle}" on D-Box`;
    const text = [
      `You're invited to join "${boxTitle}" on D-Box`,
      '',
      `${senderName} has invited you to join the group "${boxTitle}".`,
      '',
      'Click the link below to join:',
      joinUrl,
      '',
      'If you did not expect this invitation, you can safely ignore this email.'
    ].join('\n');

    return await sendEmail(recipientEmailTrimmed, subject, text);
  } catch (error) {
    const detail = [error.code, error.message]
      .filter(Boolean)
      .join(' | ');
    console.error(
      `Failed to send invitation email to ${recipientEmail}:`,
      detail || error.toString()
    );
    return { success: false, error: detail || 'Unknown email error' };
  }
};

module.exports = {
  sendEmail,
  sendInvitationEmail
};
