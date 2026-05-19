/**
 * Token Utility
 * Secure token generation and hashing for admin invites
 */

const crypto = require('crypto');
const bcryptjs = require('bcryptjs');

/**
 * Generate secure random token
 * @param {number} length - Length of token in bytes
 * @returns {string} - Hex encoded random token
 */
exports.generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Hash token using bcryptjs
 * @param {string} token - Plain text token
 * @param {number} saltRounds - Bcrypt salt rounds (default 10)
 * @returns {Promise<string>} - Hashed token
 */
exports.hashToken = async (token, saltRounds = 10) => {
  try {
    const hash = await bcryptjs.hash(token, saltRounds);
    return hash;
  } catch (error) {
    console.error('Error hashing token:', error);
    throw new Error('Failed to hash token');
  }
};

/**
 * Verify token against hash
 * @param {string} token - Plain text token to verify
 * @param {string} hash - Previously hashed token
 * @returns {Promise<boolean>} - True if token matches hash
 */
exports.verifyToken = async (token, hash) => {
  try {
    const isMatch = await bcryptjs.compare(token, hash);
    return isMatch;
  } catch (error) {
    console.error('Error verifying token:', error);
    return false;
  }
};

/**
 * Generate invite link from token
 * @param {string} token - Plain text token
 * @param {string} frontendUrl - Frontend base URL
 * @returns {string} - Complete invite link
 */
exports.generateInviteLink = (token, frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000') => {
  const baseUrl = String(frontendUrl || '').trim();
  return `${baseUrl}/admin/invite/accept?token=${token}`;
};

/**
 * Parse token from query string safely
 * @param {string} token - Token from query parameter
 * @returns {string|null} - Sanitized token or null if invalid
 */
exports.parseToken = (token) => {
  if (!token) return null;
  
  const sanitized = String(token || '').trim();
  
  // Check if token looks like hex (64 chars = 32 bytes)
  if (!/^[a-f0-9]{64}$/i.test(sanitized)) {
    return null;
  }
  
  return sanitized;
};

/**
 * Validate token format
 * @param {string} token - Token to validate
 * @returns {boolean} - True if token has valid format
 */
exports.isValidTokenFormat = (token) => {
  if (!token || typeof token !== 'string') return false;
  return /^[a-f0-9]{64}$/i.test(String(token).trim());
};

/**
 * Get token expiry time
 * @param {number} hoursFromNow - Hours until expiry (default 24)
 * @returns {Date} - Expiry timestamp
 */
exports.getTokenExpiry = (hoursFromNow = 24) => {
  const expiryMs = hoursFromNow * 60 * 60 * 1000;
  return new Date(Date.now() + expiryMs);
};

/**
 * Check if token is expired
 * @param {Date} expiresAt - Expiry timestamp
 * @returns {boolean} - True if token is expired
 */
exports.isTokenExpired = (expiresAt) => {
  if (!expiresAt) return true;
  return new Date(expiresAt) < new Date();
};

/**
 * Generate shareable invite object
 * @param {string} token - Plain text token
 * @param {string} frontendUrl - Frontend base URL
 * @param {object} options - Additional options
 * @returns {object} - Invite object with token and link
 */
exports.generateShareableInvite = (token, frontendUrl = process.env.FRONTEND_URL, options = {}) => {
  const inviteLink = this.generateInviteLink(token, frontendUrl);
  
  return {
    token,
    link: inviteLink,
    expiresAt: options.expiresAt || this.getTokenExpiry(24),
    role: options.role || 'employee',
  };
};
