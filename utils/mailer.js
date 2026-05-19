const sesEmailService = require('../services/sesEmailService');

async function sendEmail(to, subject, html, text) {
  try {
    return await sesEmailService.sendEmail(to, subject, html, text);
  } catch (error) {
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

async function sendOTP(email, otp) {
  try {
    return await sesEmailService.sendOTPEmail(email, otp);
  } catch (error) {
    return { success: false, error: error.message || 'Failed to send OTP email' };
  }
}

module.exports = {
  sendEmail,
  sendOTP,
};