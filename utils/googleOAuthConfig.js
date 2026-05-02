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

function normalizeBaseUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.replace(/\/$/, '');
}

function buildCallbackFromBaseUrl(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return '';
  return `${normalized}/api/auth/google/callback`;
}

function normalizeCallbackUrl(value) {
  const callback = String(value || '').trim();
  if (!callback) return '';

  // Keep absolute URLs unchanged.
  if (/^https?:\/\//i.test(callback)) {
    return callback;
  }

  // Normalize relative values like "api/auth/google/callback".
  if (callback.startsWith('/')) {
    return callback;
  }

  return `/${callback}`;
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

  const railwayPublicDomain = String(process.env.RAILWAY_PUBLIC_DOMAIN || '').trim();
  const derivedRailwayBaseUrl = railwayPublicDomain ? `https://${railwayPublicDomain}` : '';

  const callbackURL = normalizeCallbackUrl(
    process.env.GOOGLE_CALLBACK_URL ||
    fileConfig?.callbackURL ||
    buildCallbackFromBaseUrl(process.env.PUBLIC_APP_URL || process.env.INVITE_BASE_URL || process.env.APP_URL) ||
    buildCallbackFromBaseUrl(derivedRailwayBaseUrl) ||
    '/api/auth/google/callback'
  );

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