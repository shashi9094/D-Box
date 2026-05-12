const store = new Map();

function _key(email, type) {
  return `${String(email || '').toLowerCase().trim()}|${String(type || 'default')}`;
}

function generateNumericOtp(digits = 6) {
  const min = 10 ** (digits - 1);
  const max = 10 ** digits - 1;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

function saveOtp(email, type, otp, ttlMs = 10 * 60 * 1000) {
  const key = _key(email, type);
  const expiresAt = Date.now() + ttlMs;
  if (store.has(key)) {
    clearTimeout(store.get(key).timeoutId);
  }

  const timeoutId = setTimeout(() => {
    store.delete(key);
  }, ttlMs + 1000);

  store.set(key, { otp: String(otp), expiresAt, timeoutId });
  return { key, expiresAt };
}

function verifyOtp(email, type, otp) {
  const key = _key(email, type);
  const entry = store.get(key);
  if (!entry) return { valid: false, reason: 'not_found' };
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return { valid: false, reason: 'expired' };
  }
  if (String(otp) !== String(entry.otp)) return { valid: false, reason: 'mismatch' };

  clearTimeout(entry.timeoutId);
  store.delete(key);
  return { valid: true };
}

function peek(email, type) {
  const key = _key(email, type);
  return store.get(key) || null;
}

module.exports = {
  generateNumericOtp,
  saveOtp,
  verifyOtp,
  peek
};
