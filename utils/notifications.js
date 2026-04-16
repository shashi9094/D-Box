const db = require('../db/connection');

let tableReady = false;

const ensureNotificationsTable = async () => {
  if (tableReady) return;

  await db.promise().query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      type VARCHAR(80) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      details_json TEXT NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_notifications_user_created (user_id, created_at),
      KEY idx_notifications_user_read (user_id, is_read)
    )
  `);

  tableReady = true;
};

const parseDetails = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(String(value));
  } catch (_) {
    return null;
  }
};

const createNotification = async ({ userId, type, title, message, details = null }) => {
  const numericUserId = Number(userId);
  if (!Number.isFinite(numericUserId) || numericUserId <= 0) return false;

  await ensureNotificationsTable();

  await db.promise().query(
    `INSERT INTO notifications (user_id, type, title, message, details_json)
     VALUES (?, ?, ?, ?, ?)`,
    [
      numericUserId,
      String(type || 'general').slice(0, 80),
      String(title || 'Notification').slice(0, 255),
      String(message || '').slice(0, 5000),
      details ? JSON.stringify(details) : null,
    ]
  );

  return true;
};

const createNotificationsForUsers = async (userIds, payload) => {
  const uniqueUserIds = Array.from(
    new Set(
      (Array.isArray(userIds) ? userIds : [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  );

  if (!uniqueUserIds.length) {
    return 0;
  }

  await Promise.all(uniqueUserIds.map((userId) => createNotification({ userId, ...payload })));
  return uniqueUserIds.length;
};

const listUserNotifications = async (userId, limit = 30) => {
  const numericUserId = Number(userId);
  await ensureNotificationsTable();

  const safeLimit = Math.min(Math.max(Math.floor(Number(limit) || 30), 1), 200);

  const [rows] = await db.promise().query(
    `SELECT id, user_id, type, title, message, details_json, is_read, created_at
     FROM notifications
     WHERE user_id = ?
     ORDER BY id DESC
     LIMIT ?`,
    [numericUserId, safeLimit]
  );

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    details: parseDetails(row.details_json),
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
  }));
};

const getUnreadNotificationCount = async (userId) => {
  const numericUserId = Number(userId);
  await ensureNotificationsTable();

  const [rows] = await db.promise().query(
    `SELECT COUNT(*) AS total
     FROM notifications
     WHERE user_id = ? AND is_read = 0`,
    [numericUserId]
  );

  return Number(rows[0]?.total || 0);
};

const markNotificationsRead = async (userId, ids = null) => {
  const numericUserId = Number(userId);
  await ensureNotificationsTable();

  if (Array.isArray(ids) && ids.length) {
    const safeIds = ids
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (!safeIds.length) return 0;

    const [result] = await db.promise().query(
      `UPDATE notifications
       SET is_read = 1
       WHERE user_id = ? AND id IN (?)`,
      [numericUserId, safeIds]
    );

    return Number(result.affectedRows || 0);
  }

  const [result] = await db.promise().query(
    `UPDATE notifications
     SET is_read = 1
     WHERE user_id = ? AND is_read = 0`,
    [numericUserId]
  );

  return Number(result.affectedRows || 0);
};

const deleteNotification = async (userId, notificationId) => {
  const numericUserId = Number(userId);
  const numericNotificationId = Number(notificationId);

  if (!Number.isFinite(numericNotificationId) || numericNotificationId <= 0) {
    return 0;
  }

  await ensureNotificationsTable();

  const [result] = await db.promise().query(
    `DELETE FROM notifications WHERE user_id = ? AND id = ? LIMIT 1`,
    [numericUserId, numericNotificationId]
  );

  return Number(result.affectedRows || 0);
};

module.exports = {
  ensureNotificationsTable,
  createNotification,
  createNotificationsForUsers,
  listUserNotifications,
  getUnreadNotificationCount,
  markNotificationsRead,
  deleteNotification,
};
