const axios = require('axios');
const crypto = require('crypto');

// ENV variables (Railway se aayenge)
const BREVO_API_KEY = String(process.env.BREVO_API_KEY || '').trim();
const SENDER_EMAIL = String(process.env.SMTP_FROM || '').trim();
const SENDER_NAME = String(process.env.SENDER_NAME || 'D-Box').trim();
const FRONTEND_URL = String(process.env.FRONTEND_URL || '').trim();

// Rate limit
let lastSendTime = 0;
const MIN_DELAY_MS = 2000;

// Stores
const otpStore = new Map();
const resetStore = new Map();
const inviteStore = new Map();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

// ==================== CORE EMAIL ====================

async function sendEmail(to, subject, text, html = null) {
  const recipient = String(to || '').trim().toLowerCase();

  if (!recipient || !recipient.includes('@')) {
    throw new Error('Invalid recipient email');
  }

  if (!BREVO_API_KEY) {
    throw new Error('BREVO_API_KEY missing');
  }

  // Rate limit delay
  const now = Date.now();
  const wait = Math.max(0, MIN_DELAY_MS - (now - lastSendTime));
  if (wait > 0) await sleep(wait);

  try {
    const payload = {
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email: recipient }],
      subject: subject || 'D-Box Notification',
      textContent: text || '',
    };

    if (html) payload.htmlContent = html;

    const { data } = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      payload,
      {
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    lastSendTime = Date.now();
    console.log('✅ Email sent:', recipient, data.messageId);
    return { success: true, messageId: data.messageId };

  } catch (error) {
    const errMsg = error.response?.data?.message || error.message;
    console.error('❌ Email failed:', errMsg);
    throw new Error('Failed to send email: ' + errMsg);
  }
}

// ==================== OTP ====================

async function sendVerificationOTP(email) {
  const otp = generateOTP();
  const expiresAt = Date.now() + 10 * 60 * 1000;

  otpStore.set(email, { otp, expiresAt, attempts: 0 });

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:30px;">
      <h2>Verify Your Account</h2>
      <p>Your OTP code:</p>
      <div style="background:#f3f4f6;padding:20px;border-radius:8px;text-align:center;margin:20px 0;">
        <span style="font-size:36px;font-weight:bold;color:#2563eb;letter-spacing:8px;">${otp}</span>
      </div>
      <p style="color:#ef4444;">Expires in 10 minutes</p>
    </div>
  `;

  await sendEmail(email, '🔐 D-Box Verification Code', `Your OTP: ${otp}`, html);
  return { success: true, message: 'OTP sent' };
}

function verifyOTP(email, otp) {
  const stored = otpStore.get(email);
  if (!stored) return { success: false, message: 'OTP not found' };
  
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(email);
    return { success: false, message: 'OTP expired' };
  }

  if (stored.otp !== otp) {
    stored.attempts++;
    if (stored.attempts >= 3) {
      otpStore.delete(email);
      return { success: false, message: 'Max attempts exceeded' };
    }
    return { success: false, message: 'Invalid OTP' };
  }

  otpStore.delete(email);
  return { success: true, message: 'Verified' };
}

// ==================== FORGOT PASSWORD ====================

async function sendForgotPasswordLink(email) {
  const token = generateToken();
  const expiresAt = Date.now() + 30 * 60 * 1000;

  resetStore.set(token, { email, expiresAt });

  const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:30px;">
      <h2>Reset Password</h2>
      <a href="${resetUrl}" style="display:inline-block;padding:14px 28px;background:#2563eb;color:white;text-decoration:none;border-radius:8px;">Reset Password</a>
      <p style="color:#ef4444;">Expires in 30 minutes</p>
    </div>
  `;

  await sendEmail(email, '🔑 Reset Your Password', `Link: ${resetUrl}`, html);
  return { success: true, message: 'Reset link sent' };
}

function verifyResetToken(token) {
  const stored = resetStore.get(token);
  if (!stored || Date.now() > stored.expiresAt) {
    return { success: false, message: 'Invalid or expired token' };
  }
  resetStore.delete(token);
  return { success: true, email: stored.email };
}

// ==================== INVITE ====================

async function sendInviteLink(email, boxId, boxName, invitedBy) {
  const token = generateToken();
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

  inviteStore.set(token, { email, boxId, expiresAt });

  const joinUrl = `${FRONTEND_URL}/join?token=${token}&box=${boxId}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:30px;">
      <h2>Box Invitation</h2>
      <p><strong>${invitedBy}</strong> invited you to <strong>${boxName}</strong></p>
      <a href="${joinUrl}" style="display:inline-block;padding:14px 28px;background:#10b981;color:white;text-decoration:none;border-radius:8px;">Accept Invitation</a>
      <p style="color:#6b7280;">Expires in 7 days</p>
    </div>
  `;

  await sendEmail(email, `📦 Invitation to ${boxName}`, `Join: ${joinUrl}`, html);
  return { success: true, message: 'Invitation sent' };
}

function verifyInviteToken(token, boxId) {
  const stored = inviteStore.get(token);
  if (!stored || stored.boxId !== boxId || Date.now() > stored.expiresAt) {
    return { success: false, message: 'Invalid or expired invitation' };
  }
  return { success: true, email: stored.email };
}

function consumeInviteToken(token, boxId) {
  const stored = inviteStore.get(token);
  if (!stored || stored.boxId !== boxId || Date.now() > stored.expiresAt) {
    return { success: false, message: 'Invalid or expired invitation' };
  }

  inviteStore.delete(token);
  return { success: true, email: stored.email };
}

function peekInviteToken(token, boxId) {
  const stored = inviteStore.get(token);
  if (!stored || stored.boxId !== boxId || Date.now() > stored.expiresAt) {
    return { success: false, message: 'Invalid or expired invitation' };
  }

  return {
    success: true,
    email: stored.email,
    boxId: stored.boxId,
    expiresAt: stored.expiresAt
  };
}

module.exports = {
  sendEmail,
  sendVerificationOTP,
  verifyOTP,
  sendForgotPasswordLink,
  verifyResetToken,
  sendInviteLink,
  verifyInviteToken,
  consumeInviteToken,
  peekInviteToken
};