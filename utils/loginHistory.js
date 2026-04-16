const db = require('../db/connection');

let tableReady = false;

const inferDeviceType = (userAgent) => {
  const ua = String(userAgent || '').toLowerCase();
  if (/ipad|tablet/.test(ua)) return 'Tablet';
  if (/mobi|android|iphone|ipod/.test(ua)) return 'Mobile';
  return 'Desktop';
};

const inferBrowser = (userAgent) => {
  const ua = String(userAgent || '');
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return 'Opera';
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua) && !/OPR\//i.test(ua)) return 'Chrome';
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return 'Safari';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/MSIE|Trident/i.test(ua)) return 'Internet Explorer';
  return 'Unknown';
};

const inferOS = (userAgent) => {
  const ua = String(userAgent || '');
  if (/Windows NT/i.test(ua)) return 'Windows';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Unknown';
};

const getClientIp = (req) => {
  const forwarded = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  if (forwarded) return forwarded;

  return (
    req?.ip ||
    req?.socket?.remoteAddress ||
    req?.connection?.remoteAddress ||
    null
  );
};

const ensureLoginHistoryTable = async () => {
  if (tableReady) return;

  await db.promise().query(`
    CREATE TABLE IF NOT EXISTS login_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      email VARCHAR(255) NOT NULL,
      login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ip_address VARCHAR(100) NULL,
      user_agent TEXT NULL,
      device_type VARCHAR(50) NULL,
      browser VARCHAR(100) NULL,
      os VARCHAR(100) NULL
    )
  `);

  tableReady = true;
};

const logLoginHistory = async ({ userId, email, req }) => {
  const numericUserId = Number(userId);
  const safeEmail = String(email || '').trim().toLowerCase();

  if (!Number.isFinite(numericUserId) || !safeEmail) return;

  try {
    await ensureLoginHistoryTable();

    const userAgent = String(req?.headers?.['user-agent'] || '').trim() || null;
    const ipAddress = getClientIp(req);
    const deviceType = inferDeviceType(userAgent);
    const browser = inferBrowser(userAgent);
    const os = inferOS(userAgent);

    await db.promise().query(
      `INSERT INTO login_history (user_id, email, ip_address, user_agent, device_type, browser, os)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [numericUserId, safeEmail, ipAddress, userAgent, deviceType, browser, os]
    );
  } catch (error) {
    console.warn('Login history log failed:', error.message);
  }
};

module.exports = {
  logLoginHistory,
};
