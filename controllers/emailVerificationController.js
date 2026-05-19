/**
 * Email Verification Controller
 * Handles OTP generation, verification, and email confirmation flows
 */

const db = require('../db/connection');
const bcrypt = require('bcryptjs');
const OTPModel = require('../models/OTPModel');
const { sendOTPEmail } = require('../services/sesEmailService');

const FRONTEND_URL = String(process.env.FRONTEND_URL || 'http://localhost:3000').trim();

/**
 * POST /auth/send-verification-otp
 * Send OTP for email verification during signup
 */
exports.sendVerificationOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    // Validation
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Valid email address is required',
      });
    }

    const sql = db.promise();

    // Check if email already exists
    const [existingUsers] = await sql.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
      [normalizedEmail]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered',
      });
    }

    // Check resend cooldown
    const { canResend, waitSeconds } = await OTPModel.canResendOTP(
      normalizedEmail,
      'verification'
    );

    if (!canResend) {
      return res.status(429).json({
        success: false,
        message: `Please wait ${waitSeconds} seconds before resending OTP`,
        retryAfter: waitSeconds,
      });
    }

    // Generate and send OTP
    const otpResult = await OTPModel.createOTP(normalizedEmail, 'verification');
    await sendOTPEmail(normalizedEmail, otpResult.otp, 'signup');

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      email: normalizedEmail,
      expiresIn: 600, // 10 minutes in seconds
    });
  } catch (error) {
    console.error('Error sending verification OTP:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send OTP. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * POST /auth/verify-email-otp
 * Verify OTP during signup
 */
exports.verifyEmailOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const trimmedOTP = String(otp || '').trim();

    // Validation
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Valid email address is required',
      });
    }

    if (!trimmedOTP || trimmedOTP.length !== 6 || isNaN(trimmedOTP)) {
      return res.status(400).json({
        success: false,
        message: 'OTP must be a 6-digit number',
      });
    }

    // Verify OTP
    const verifyResult = await OTPModel.verifyOTPCode(
      normalizedEmail,
      trimmedOTP,
      'verification'
    );

    if (!verifyResult.success) {
      return res.status(400).json({
        success: false,
        message: verifyResult.message,
        remainingAttempts: verifyResult.remainingAttempts,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully',
      email: normalizedEmail,
    });
  } catch (error) {
    console.error('Error verifying email OTP:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify OTP. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * POST /auth/forgot-password
 * Send OTP for password reset
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    // Validation
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Valid email address is required',
      });
    }

    const sql = db.promise();

    // Check if email exists
    const [existingUsers] = await sql.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
      [normalizedEmail]
    );

    if (existingUsers.length === 0) {
      // For security, don't reveal if email exists
      return res.status(200).json({
        success: true,
        message: 'If the email exists, OTP will be sent to it',
      });
    }

    // Check resend cooldown
    const { canResend, waitSeconds } = await OTPModel.canResendOTP(
      normalizedEmail,
      'reset'
    );

    if (!canResend) {
      return res.status(429).json({
        success: false,
        message: `Please wait ${waitSeconds} seconds before resending OTP`,
        retryAfter: waitSeconds,
      });
    }

    // Generate and send OTP
    const otpResult = await OTPModel.createOTP(normalizedEmail, 'reset');
    await sendOTPEmail(normalizedEmail, otpResult.otp, 'reset');

    return res.status(200).json({
      success: true,
      message: 'OTP sent to your email',
      email: normalizedEmail,
      expiresIn: 600, // 10 minutes in seconds
    });
  } catch (error) {
    console.error('Error in forgot password:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process forgot password request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * POST /auth/verify-forgot-otp
 * Verify OTP for password reset
 */
exports.verifyForgotOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const trimmedOTP = String(otp || '').trim();

    // Validation
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Valid email address is required',
      });
    }

    if (!trimmedOTP || trimmedOTP.length !== 6 || isNaN(trimmedOTP)) {
      return res.status(400).json({
        success: false,
        message: 'OTP must be a 6-digit number',
      });
    }

    // Verify OTP
    const verifyResult = await OTPModel.verifyOTPCode(
      normalizedEmail,
      trimmedOTP,
      'reset'
    );

    if (!verifyResult.success) {
      return res.status(400).json({
        success: false,
        message: verifyResult.message,
        remainingAttempts: verifyResult.remainingAttempts,
      });
    }

    // Generate temporary reset token (valid for 15 minutes)
    const resetToken = require('crypto').randomBytes(32).toString('hex');
    const resetTokenHash = require('crypto')
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);

    const sql = db.promise();
    await sql.query(
      'UPDATE users SET reset_token_hash = ?, reset_token_expiry = ? WHERE LOWER(email) = LOWER(?)',
      [resetTokenHash, resetTokenExpiry, normalizedEmail]
    );

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      resetToken, // Send plain token to client
      expiresIn: 900, // 15 minutes in seconds
    });
  } catch (error) {
    console.error('Error verifying forgot OTP:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify OTP',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * POST /auth/reset-password
 * Reset password using reset token
 */
exports.resetPassword = async (req, res) => {
  try {
    const { email, resetToken, newPassword, confirmPassword } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const trimmedPassword = String(newPassword || '');
    const trimmedConfirmPassword = String(confirmPassword || '');

    // Validation
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Valid email address is required',
      });
    }

    if (!resetToken || resetToken.length < 32) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reset token',
      });
    }

    if (!trimmedPassword || trimmedPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters',
      });
    }

    if (trimmedPassword !== trimmedConfirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
      });
    }

    // Verify reset token
    const resetTokenHash = require('crypto')
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    const sql = db.promise();
    const [users] = await sql.query(
      `SELECT id FROM users 
       WHERE LOWER(email) = LOWER(?) 
       AND reset_token_hash = ? 
       AND reset_token_expiry > NOW()
       LIMIT 1`,
      [normalizedEmail, resetTokenHash]
    );

    if (users.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }

    const userId = users[0].id;

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(trimmedPassword, salt);

    // Update password and clear reset token
    await sql.query(
      `UPDATE users 
       SET password = ?, reset_token_hash = NULL, reset_token_expiry = NULL 
       WHERE id = ?`,
      [hashedPassword, userId]
    );

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * POST /auth/resend-verification-otp
 * Resend verification OTP
 */
exports.resendVerificationOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Valid email address is required',
      });
    }

    // Check resend cooldown
    const { canResend, waitSeconds } = await OTPModel.canResendOTP(
      normalizedEmail,
      'verification'
    );

    if (!canResend) {
      return res.status(429).json({
        success: false,
        message: `Please wait ${waitSeconds} seconds before resending OTP`,
        retryAfter: waitSeconds,
      });
    }

    // Generate and send new OTP
    const otpResult = await OTPModel.createOTP(normalizedEmail, 'verification');
    await sendOTPEmail(normalizedEmail, otpResult.otp, 'signup');

    return res.status(200).json({
      success: true,
      message: 'OTP resent successfully',
      email: normalizedEmail,
      expiresIn: 600,
    });
  } catch (error) {
    console.error('Error resending OTP:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to resend OTP',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

module.exports = {
  sendVerificationOTP: exports.sendVerificationOTP,
  verifyEmailOTP: exports.verifyEmailOTP,
  forgotPassword: exports.forgotPassword,
  verifyForgotOTP: exports.verifyForgotOTP,
  resetPassword: exports.resetPassword,
  resendVerificationOTP: exports.resendVerificationOTP,
};
