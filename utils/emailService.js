const nodemailer = require('nodemailer');
const dns = require('dns');

const emailUser = String(process.env.EMAIL_USER || '').trim();
const emailPassword = String(process.env.EMAIL_PASSWORD || '').replace(/\s+/g, '').trim();
const emailEnabled = Boolean(emailUser && emailPassword);
const smtpHost = String(process.env.SMTP_HOST || 'smtp.gmail.com').trim();
const smtpPort = Number(process.env.SMTP_PORT || 465);
const smtpSecure = String(process.env.SMTP_SECURE || 'true').toLowerCase() !== 'false';
const smtpForceIpv4 = String(process.env.SMTP_FORCE_IPV4 || 'true').toLowerCase() !== 'false';

// IPv4-only DNS lookup for Railway compatibility
const ipv4Lookup = (hostname, callback) => {
  if (smtpForceIpv4) {
    dns.resolve4(hostname, (err, addresses) => {
      if (err) {
        return callback(err);
      }
      callback(null, addresses[0] || hostname, 4);
    });
  } else {
    dns.lookup(hostname, { family: 0 }, callback);
  }
};

const transporter = emailEnabled
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      family: smtpForceIpv4 ? 4 : 0,
      lookup: smtpForceIpv4 ? ipv4Lookup : undefined,
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
      auth: {
        user: emailUser,
        pass: emailPassword
      }
    })
  : null;

if (transporter) {
  transporter
    .verify()
    .then(() => {
      console.log('Email service ready (IPv4 mode: ' + (smtpForceIpv4 ? 'enabled' : 'disabled') + ')');
    })
    .catch((error) => {
      console.warn('Email service not configured:', error.code, '|', error.message);
    });
} else {
  console.warn('Email service disabled because EMAIL_USER or EMAIL_PASSWORD is missing.');
}

/**
 * Retry helper for transient SMTP failures (timeout, socket errors)
 */
const sendMailWithRetry = async (mailOptions, maxRetries = 3) => {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await transporter.sendMail(mailOptions);
      return result;
    } catch (error) {
      lastError = error;
      const isTransient = ['ETIMEDOUT', 'ESOCKET', 'ECONNREFUSED', 'ENETUNREACH'].includes(error.code);
      
      if (isTransient && attempt < maxRetries) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // exponential backoff
        console.warn(
          `[Email Retry ${attempt}/${maxRetries}] Transient error (${error.code}), retrying in ${delayMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else if (!isTransient) {
        // Non-transient error, fail immediately
        throw error;
      }
    }
  }
  
  throw lastError;
};

/**
 * Send invitation email to join a box/group
 * @param {string} recipientEmail - Email to send to
 * @param {string} boxTitle - Name of the box/group
 * @param {string} senderName - Name of person sending invite
 * @param {string} joinUrl - URL for user to join/sign up
 * @returns {Promise<Object>}
 */
const sendInvitationEmail = (recipientEmail, boxTitle, senderName, joinUrl) => {
  return new Promise((resolve) => {
    if (!transporter) {
      resolve({ success: false, error: 'Email service is disabled' });
      return;
    }

    const mailOptions = {
      from: emailUser,
      to: String(recipientEmail || '').trim(),
      subject: `You're invited to join "${boxTitle}" on D-Box`,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;"><h2 style="color: #333; margin-top: 0;">Welcome to D-Box!</h2><p style="color: #666; font-size: 16px;"><strong>${senderName}</strong> has invited you to join the group <strong>"${boxTitle}"</strong></p></div><div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #0084ff;"><p style="color: #333; margin: 0 0 10px 0;">Click the button below to join the group and start collaborating:</p><a href="${joinUrl}" style="display: inline-block; background-color: #0084ff; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 10px;">Join Now</a><p style="color: #999; font-size: 12px; margin-top: 15px;">Or copy this link in your browser: <br/><a href="${joinUrl}" style="color: #0084ff; word-break: break-all;">${joinUrl}</a></p></div><div style="border-top: 1px solid #ddd; padding-top: 20px; color: #999; font-size: 12px;"><p style="margin: 0 0 10px 0;">D-Box is a secure file sharing and collaboration platform.</p><p style="margin: 0;">If you did not expect this invitation, you can safely ignore this email.</p></div></div>`,
      text: `You're invited to join "${boxTitle}" on D-Box\n\n${senderName} has invited you to join the group "${boxTitle}".\n\nClick the link below to join:\n${joinUrl}\n\nIf you did not expect this invitation, you can safely ignore this email.`
    };

    sendMailWithRetry(mailOptions)
      .then((result) => {
        console.log(`Invitation email sent to ${recipientEmail}:`, result.messageId);
        resolve({ success: true, messageId: result.messageId });
      })
      .catch((error) => {
        const detail = [error.code, error.responseCode, error.command, error.message]
          .filter(Boolean)
          .join(' | ');
        console.error(`Failed to send invitation email to ${recipientEmail}:`, detail);
        resolve({ success: false, error: detail || 'Unknown email error' });
      });
  });
};

module.exports = {
  sendInvitationEmail
};
