const crypto = require('crypto');
const sesEmailService = require('../services/sesEmailService');

const FRONTEND_URL = String(process.env.FRONTEND_URL || 'https://mydbox.co.in').trim();
const MIN_DELAY_MS = 2000;

let lastSendTime = 0;
const otpStore = new Map();
const resetStore = new Map();
const inviteStore = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

async function sendEmail(to, subject, text, html = null) {
  const recipient = String(to || '').trim().toLowerCase();

  if (!recipient || !recipient.includes('@')) {
    throw new Error('Invalid recipient email');
  }

  const wait = Math.max(0, MIN_DELAY_MS - (Date.now() - lastSendTime));
  if (wait > 0) {
    await sleep(wait);
  }

  const result = await sesEmailService.sendEmail(recipient, subject, html || '', text || '');
  lastSendTime = Date.now();
  return result;
}

async function sendVerificationOTP(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const otp = generateOTP();
  const expiresAt = Date.now() + 10 * 60 * 1000;

  otpStore.set(normalizedEmail, { otp, expiresAt, attempts: 0 });

  const html = sesEmailService.getOTPEmailTemplate(otp, 'signup');
  await sendEmail(normalizedEmail, '🔐 D-Box Verification Code', `Your OTP: ${otp}`, html);

  return { success: true, message: 'OTP sent' };
}

function verifyOTP(email, otp) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedOtp = String(otp || '').trim();
  const stored = otpStore.get(normalizedEmail);

  if (!stored) {
    return { success: false, message: 'OTP not found' };
  }

  if (Date.now() > stored.expiresAt) {
    otpStore.delete(normalizedEmail);
    return { success: false, message: 'OTP expired' };
  }

  if (stored.otp !== normalizedOtp) {
    stored.attempts += 1;
    return { success: false, message: 'Invalid OTP' };
  }

  otpStore.delete(normalizedEmail);
  return { success: true, message: 'Verified' };
}

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

async function sendInviteLink(email, boxId, boxName, invitedBy) {
  const token = generateToken();
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  inviteStore.set(token, { email, boxId, expiresAt });

  const joinUrl = `${FRONTEND_URL}/join?token=${token}&box=${boxId}`;
  const html = sesEmailService.getInviteEmailTemplate(joinUrl, invitedBy);

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
    expiresAt: stored.expiresAt,
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
  peekInviteToken,
};