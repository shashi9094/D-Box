const fs = require('fs');

function isValidGoogleClientId(value) {
  return /^\d+-[a-z0-9-]+\.apps\.googleusercontent\.com$/i.test(String(value || '').trim());
}

function maskClientId(value) {
  const id = String(value || '').trim();
  if (!id) return '(empty)';
  if (id.length <= 18) return `${id.slice(0, 4)}...`;
  return `${id.slice(0, 10)}...${id.slice(-18)}`;
}

function readOAuthFile(filePath) {
  const safePath = String(filePath || '').trim();
  if (!safePath || !fs.existsSync(safePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(safePath, 'utf8'));
    const webConfig = parsed?.web || parsed?.installed || parsed || {};

    return {
      clientID: String(webConfig.client_id || '').trim(),
      clientSecret: String(webConfig.client_secret || '').trim(),
      callbackURL: Array.isArray(webConfig.redirect_uris) && webConfig.redirect_uris.length
        ? String(webConfig.redirect_uris[0] || '').trim()
        : '',
    };
  } catch (error) {
    console.warn('Unable to read Google OAuth credentials file:', error.message);
    return null;
  }
}

function loadGoogleOAuthConfig() {
  const fileConfig = readOAuthFile(
    process.env.GOOGLE_OAUTH_CREDENTIALS_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS
  );

  // CRITICAL: In Railway, ensure GOOGLE_CLIENT_ID is set to the long ID (xxx-yyy.apps.googleusercontent.com), not the secret
  const clientID = String(
    process.env.GOOGLE_CLIENT_ID ||
    fileConfig?.clientID ||
    ''
  ).trim();

  const clientSecret = String(
    process.env.GOOGLE_CLIENT_SECRET ||
    fileConfig?.clientSecret ||
    ''
  ).trim();

  const callbackURL = String(
    process.env.GOOGLE_CALLBACK_URL ||
    fileConfig?.callbackURL ||
    '/api/auth/google/callback'
  ).trim();

  const enabled = Boolean(clientID && clientSecret && isValidGoogleClientId(clientID));

  return {
    clientID,
    clientSecret,
    callbackURL,
    enabled,
    maskedClientId: maskClientId(clientID),
    validClientIdFormat: isValidGoogleClientId(clientID),
    hasClientSecret: Boolean(clientSecret),
    source: fileConfig ? 'file' : 'env',
  };
}

module.exports = {
  loadGoogleOAuthConfig,
  isValidGoogleClientId,
  maskClientId,
};