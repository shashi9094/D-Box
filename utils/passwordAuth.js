const bcrypt = require('bcryptjs');

const GOOGLE_AUTH_PASSWORD = 'google_auth';
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$.{53}$/;

const isGoogleAuthPassword = (value) => String(value || '') === GOOGLE_AUTH_PASSWORD;

const isBcryptHash = (value) => BCRYPT_HASH_PATTERN.test(String(value || ''));

const hashPassword = async (password) => {
  const normalizedPassword = String(password || '').trim();

  if (!normalizedPassword) {
    throw new Error('Password is required');
  }

  return bcrypt.hash(normalizedPassword, 10);
};

const preparePasswordForStorage = async (password, authProvider = 'local') => {
  const normalizedProvider = String(authProvider || 'local').trim().toLowerCase();

  if (normalizedProvider === 'google') {
    return GOOGLE_AUTH_PASSWORD;
  }

  const normalizedPassword = String(password || '').trim();

  if (!normalizedPassword) {
    throw new Error('Password is required');
  }

  if (isGoogleAuthPassword(normalizedPassword)) {
    throw new Error('Invalid password value');
  }

  if (isBcryptHash(normalizedPassword)) {
    return normalizedPassword;
  }

  return hashPassword(normalizedPassword);
};

const comparePassword = async (password, storedPassword) => {
  const normalizedStoredPassword = String(storedPassword || '');

  if (isGoogleAuthPassword(normalizedStoredPassword) || !isBcryptHash(normalizedStoredPassword)) {
    return false;
  }

  return bcrypt.compare(String(password || ''), normalizedStoredPassword);
};

const getPasswordMode = (storedPassword) => {
  if (isGoogleAuthPassword(storedPassword)) {
    return 'google';
  }

  if (isBcryptHash(storedPassword)) {
    return 'bcrypt';
  }

  return 'legacy';
};

module.exports = {
  GOOGLE_AUTH_PASSWORD,
  isGoogleAuthPassword,
  isBcryptHash,
  hashPassword,
  preparePasswordForStorage,
  comparePassword,
  getPasswordMode,
};