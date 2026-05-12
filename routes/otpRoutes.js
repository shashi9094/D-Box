const express = require('express');
const router = express.Router();
const { sendEmail, buildOtpHtml, buildInviteHtml } = require('../services/brevoEmail');
const otpStore = require('../utils/otpStore');

// POST /api/otp/send-otp
// body: { email, purpose }
router.post('/send-otp', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const purpose = String(req.body?.purpose || 'signup').trim();

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Valid email is required' });
    }

    const otp = otpStore.generateNumericOtp(6);
    otpStore.saveOtp(email, purpose, otp);

    const html = buildOtpHtml(otp, purpose);

    const result = await sendEmail(email, `Your ${purpose} code`, html, `Your code is: ${otp}`);

    if (!result.success) {
      console.error('send-otp sendEmail failed', result.error);
      return res.status(500).json({ success: false, error: result.error || 'Failed to send email' });
    }

    return res.json({ success: true, messageId: result.messageId });
  } catch (err) {
    console.error('POST /send-otp error', err && err.message);
    return res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// POST /api/otp/verify-otp
// body: { email, otp, purpose }
router.post('/verify-otp', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const otp = String(req.body?.otp || '').trim();
    const purpose = String(req.body?.purpose || 'signup').trim();

    if (!email || !otp) {
      return res.status(400).json({ success: false, error: 'Email and otp are required' });
    }

    const check = otpStore.verifyOtp(email, purpose, otp);

    if (!check.valid) {
      return res.status(400).json({ success: false, error: check.reason || 'invalid' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('POST /verify-otp error', err && err.message);
    return res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// POST /api/otp/forgot-password
// body: { email }
router.post('/forgot-password', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Valid email is required' });
    }

    const otp = otpStore.generateNumericOtp(6);
    otpStore.saveOtp(email, 'forgot-password', otp);

    const html = buildOtpHtml(otp, 'password reset');

    const result = await sendEmail(email, 'Password reset code', html, `Your password reset code is: ${otp}`);
    if (!result.success) {
      console.error('forgot-password sendEmail failed', result.error);
      return res.status(500).json({ success: false, error: result.error || 'Failed to send email' });
    }

    return res.json({ success: true, messageId: result.messageId });
  } catch (err) {
    console.error('POST /forgot-password error', err && err.message);
    return res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// POST /api/otp/send-invite
// body: { email, inviterName, inviteLink }
router.post('/send-invite', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const inviterName = String(req.body?.inviterName || 'A friend');
    const inviteLink = String(req.body?.inviteLink || '#');

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Valid email is required' });
    }

    // Generate OTP for invite verification as requested
    const otp = otpStore.generateNumericOtp(6);
    otpStore.saveOtp(email, 'invite', otp);

    const inviteHtml = `${buildInviteHtml(inviterName, inviteLink)}<hr/>${buildOtpHtml(otp, 'invite')}`;

    const result = await sendEmail(email, `${inviterName} invited you to D-Box`, inviteHtml, `Invite link: ${inviteLink}\nCode: ${otp}`);
    if (!result.success) {
      console.error('send-invite sendEmail failed', result.error);
      return res.status(500).json({ success: false, error: result.error || 'Failed to send invite' });
    }

    return res.json({ success: true, messageId: result.messageId });
  } catch (err) {
    console.error('POST /send-invite error', err && err.message);
    return res.status(500).json({ success: false, error: 'Internal error' });
  }
});

module.exports = router;
