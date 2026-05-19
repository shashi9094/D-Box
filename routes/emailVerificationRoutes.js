/**
 * Email Verification Routes
 * Routes for OTP-based email verification and password reset
 */

const express = require('express');
const router = express.Router();
const { otpLimiter, passwordResetLimiter } = require('../middleware/rateLimiter');
const {
  sendVerificationOTP,
  verifyEmailOTP,
  forgotPassword,
  verifyForgotOTP,
  resetPassword,
  resendVerificationOTP,
} = require('../controllers/emailVerificationController');

/**
 * POST /auth/send-verification-otp
 * Send OTP for email verification during signup
 * Body: { email: "user@example.com" }
 */
router.post('/send-verification-otp', otpLimiter, sendVerificationOTP);

/**
 * POST /auth/verify-email-otp
 * Verify OTP during signup
 * Body: { email: "user@example.com", otp: "123456" }
 */
router.post('/verify-email-otp', otpLimiter, verifyEmailOTP);

/**
 * POST /auth/resend-verification-otp
 * Resend verification OTP
 * Body: { email: "user@example.com" }
 */
router.post('/resend-verification-otp', otpLimiter, resendVerificationOTP);

/**
 * POST /auth/forgot-password
 * Send OTP for password reset
 * Body: { email: "user@example.com" }
 */
router.post('/forgot-password', passwordResetLimiter, forgotPassword);

/**
 * POST /auth/verify-forgot-otp
 * Verify OTP for password reset
 * Body: { email: "user@example.com", otp: "123456" }
 * Response includes resetToken for next step
 */
router.post('/verify-forgot-otp', passwordResetLimiter, verifyForgotOTP);

/**
 * POST /auth/reset-password
 * Reset password using reset token
 * Body: { email: "user@example.com", resetToken: "xxx", newPassword: "password123", confirmPassword: "password123" }
 */
router.post('/reset-password', passwordResetLimiter, resetPassword);

module.exports = router;
