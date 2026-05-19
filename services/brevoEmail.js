const sesEmailService = require('./sesEmailService');

async function sendEmail(to, subject, html, text) {
  try {
    return await sesEmailService.sendEmail(to, subject, html, text);
  } catch (error) {
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

function buildOtpHtml(otp, purpose) {
  return sesEmailService.getOTPEmailTemplate(otp, purpose);
}

function buildInviteHtml(inviterName, inviteLink) {
  return sesEmailService.getInviteEmailTemplate(inviteLink, inviterName);
}

module.exports = {
  sendEmail,
  buildOtpHtml,
  buildInviteHtml,
};