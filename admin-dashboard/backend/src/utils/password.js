import bcrypt from 'bcryptjs';

export const GOOGLE_AUTH_PASSWORD = 'google_auth';

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$.{53}$/;

export const isGoogleAuthPassword = (value) => String(value || '') === GOOGLE_AUTH_PASSWORD;

export const isBcryptHash = (value) => BCRYPT_HASH_PATTERN.test(String(value || ''));

export const hashPassword = async (password) => {
  try {
    const normalizedPassword = String(password || '').trim();

    if (!normalizedPassword) {
      throw new Error('Password is required');
    }

    return await bcrypt.hash(normalizedPassword, 10);
  } catch (error) {
    throw new Error(error.message || 'Error hashing password');
  }
};

export const preparePasswordForStorage = async (password, { authProvider = 'local' } = {}) => {
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

export const comparePassword = async (password, hashedPassword) => {
  try {
    const storedPassword = String(hashedPassword || '');

    if (isGoogleAuthPassword(storedPassword) || !isBcryptHash(storedPassword)) {
      return false;
    }

    return await bcrypt.compare(String(password || ''), storedPassword);
  } catch (error) {
    throw new Error(error.message || 'Error comparing password');
  }
};

export const getPasswordMode = (storedPassword) => {
  if (isGoogleAuthPassword(storedPassword)) {
    return 'google';
  }

  if (isBcryptHash(storedPassword)) {
    return 'bcrypt';
  }

  return 'legacy';
};
