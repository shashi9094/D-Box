const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { sendEmail, buildOtpHtml } = require('../services/brevoEmail');
const otpStore = require('../utils/otpStore');
const db = require('../db/connection');

// Temporary token storage for reset tokens (in-memory)
const resetTokens = new Map();

function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

// POST /api/password-reset/forgot-password
// body: { email }
// Sends OTP to email for password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Valid email is required' });
    }

    // Check if user exists
    let user;
    try {
      const result = await db.promise().query(
        'SELECT id, fullname FROM users WHERE email = ? LIMIT 1',
        [email]
      );
      user = result[0]?.[0] || null;
    } catch (dbErr) {
      console.error('forgot-password db lookup error:', dbErr.message);
      // Don't leak whether email exists for security
      return res.status(500).json({ success: false, error: 'Database error' });
    }

    if (!user) {
      // Still succeed to prevent email enumeration
      console.log('forgot-password: email not found (returning success):', email);
      return res.json({ success: true, messageId: 'n/a' });
    }

    // Generate and save OTP
    const otp = otpStore.generateNumericOtp(6);
    otpStore.saveOtp(email, 'forgot-password', otp, 10 * 60 * 1000);

    // Build HTML email
    const html = buildOtpHtml(otp, 'password reset');
    const text = `Your password reset code is: ${otp}. It expires in 10 minutes.`;

    // Send email via Brevo
    const result = await sendEmail(email, 'Password Reset Code - D-Box', html, text);

    if (!result.success) {
      console.error('forgot-password sendEmail failed:', result.error);
      return res.status(500).json({ success: false, error: 'Failed to send email' });
    }

    console.log('forgot-password: OTP sent to', email);
    return res.json({ success: true, messageId: result.messageId });

  } catch (err) {
    console.error('POST /forgot-password error:', err.message || err);
    return res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// POST /api/password-reset/verify-reset-otp
// body: { email, otp }
// Verifies the OTP and returns a reset token
router.post('/verify-reset-otp', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const otp = String(req.body?.otp || '').trim();

    if (!email || !otp) {
      return res.status(400).json({ success: false, error: 'Email and OTP are required' });
    }

    // Verify OTP
    const check = otpStore.verifyOtp(email, 'forgot-password', otp);

    if (!check.valid) {
      console.log('verify-reset-otp: invalid OTP for', email, check.reason);
      return res.status(400).json({ 
        success: false, 
        error: check.reason === 'expired' ? 'Code expired' : 'Invalid code' 
      });
    }

    // Generate and store reset token (valid for 15 minutes)
    const token = generateResetToken();
    const expiresAt = Date.now() + 15 * 60 * 1000;

    const timeoutId = setTimeout(() => {
      resetTokens.delete(token);
    }, 15 * 60 * 1000 + 1000);

    resetTokens.set(token, {
      email,
      expiresAt,
      timeoutId
    });

    console.log('verify-reset-otp: token generated for', email);
    return res.json({ success: true, token });

  } catch (err) {
    console.error('POST /verify-reset-otp error:', err.message || err);
    return res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// POST /api/password-reset/reset-password
// body: { email, token, password }
// Updates the password if token is valid
router.post('/reset-password', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const token = String(req.body?.token || '').trim();
    const password = String(req.body?.password || '').trim();

    if (!email || !token || !password) {
      return res.status(400).json({ success: false, error: 'Email, token, and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }

    // Validate token
    const tokenData = resetTokens.get(token);

    if (!tokenData) {
      return res.status(400).json({ success: false, error: 'Invalid or expired token' });
    }

    if (Date.now() > tokenData.expiresAt) {
      clearTimeout(tokenData.timeoutId);
      resetTokens.delete(token);
      return res.status(400).json({ success: false, error: 'Token expired' });
    }

    if (tokenData.email !== email) {
      return res.status(400).json({ success: false, error: 'Token email mismatch' });
    }

    // Hash password
    let hashedPassword;
    try {
      hashedPassword = await bcrypt.hash(password, 10);
    } catch (hashErr) {
      console.error('Password hash error:', hashErr.message);
      return res.status(500).json({ success: false, error: 'Failed to hash password' });
    }

    // Update password in database
    try {
      await db.promise().query(
        'UPDATE users SET password = ? WHERE email = ? LIMIT 1',
        [hashedPassword, email]
      );
      
      console.log('reset-password: password updated for', email);

      // Clean up token
      clearTimeout(tokenData.timeoutId);
      resetTokens.delete(token);

      return res.json({ success: true, message: 'Password reset successfully' });

    } catch (dbErr) {
      console.error('reset-password db update error:', dbErr.message);
      return res.status(500).json({ success: false, error: 'Failed to update password' });
    }

  } catch (err) {
    console.error('POST /reset-password error:', err.message || err);
    return res.status(500).json({ success: false, error: 'Internal error' });
  }
});

module.exports = router;
