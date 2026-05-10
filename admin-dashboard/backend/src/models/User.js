import pool from '../db/connection.js';
import { preparePasswordForStorage } from '../utils/password.js';

const ALLOWED_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'USER']);

export class User {
  static async create(userData) {
    const { name, username, email, password, role = 'USER', authProvider = 'local' } = userData;
    const normalizedRole = ALLOWED_ROLES.has(String(role || '').toUpperCase()) ? String(role).toUpperCase() : 'USER';
    const storedPassword = await preparePasswordForStorage(password, { authProvider });
    const result = await pool.query(
      `INSERT INTO users (name, username, email, password, role) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, name, username, email, role, created_at`,
      [name, username, String(email || '').trim().toLowerCase(), storedPassword, normalizedRole]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT id, name, username, email, role, is_banned, storage_limit, storage_used, 
              created_at, updated_at, last_login 
       FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  }

  static async findByEmail(email) {
    const result = await pool.query(
      `SELECT id, name, username, email, role, is_banned, storage_limit, storage_used,
              created_at, updated_at, last_login 
       FROM users WHERE LOWER(email) = LOWER($1)`,
      [String(email || '').trim()]
    );
    return result.rows[0];
  }

  static async findAuthByEmail(email) {
    const result = await pool.query(
      `SELECT id, name, username, email, password, role, is_banned, storage_limit, storage_used,
              created_at, updated_at, last_login 
       FROM users WHERE LOWER(email) = LOWER($1)`,
      [String(email || '').trim().toLowerCase()]
    );
    return result.rows[0];
  }

  static async findByUsername(username) {
    const result = await pool.query(
      `SELECT id, name, username, email, role, is_banned, storage_limit, storage_used,
              created_at, updated_at, last_login 
       FROM users WHERE username = $1`,
      [username]
    );
    return result.rows[0];
  }

  static async getAllUsers(limit = 20, offset = 0, searchTerm = '') {
    let query = `SELECT id, name, username, email, role, is_banned, storage_limit, storage_used,
                 created_at, last_login FROM users WHERE 1=1`;
    const params = [];

    if (searchTerm) {
      query += ` AND (email ILIKE $${params.length + 1} OR username ILIKE $${params.length + 2} OR name ILIKE $${params.length + 3})`;
      params.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  static async getUserCount(searchTerm = '') {
    let query = `SELECT COUNT(*) as count FROM users WHERE 1=1`;
    const params = [];

    if (searchTerm) {
      query += ` AND (email ILIKE $${params.length + 1} OR username ILIKE $${params.length + 2} OR name ILIKE $${params.length + 3})`;
      params.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
    }

    const result = await pool.query(query, params);
    return result.rows[0].count;
  }

  static async update(id, updates) {
    const { name, username, email, role, is_banned, storage_limit } = updates;
    const result = await pool.query(
      `UPDATE users SET 
       name = COALESCE($2, name),
       username = COALESCE($3, username),
       email = COALESCE($4, email),
       role = COALESCE($5, role),
       is_banned = COALESCE($6, is_banned),
       storage_limit = COALESCE($7, storage_limit),
       updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, name, username, email, role, is_banned, storage_limit, storage_used, created_at, updated_at, last_login`,
      [id, name, username, email, role, is_banned, storage_limit]
    );
    return result.rows[0];
  }

  static async delete(id) {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    return result.rows[0];
  }

  static async banUser(id) {
    const result = await pool.query(
      'UPDATE users SET is_banned = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, is_banned',
      [id]
    );
    return result.rows[0];
  }

  static async unbanUser(id) {
    const result = await pool.query(
      'UPDATE users SET is_banned = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, is_banned',
      [id]
    );
    return result.rows[0];
  }

  static async updateLastLogin(userId, loginHistoryId) {
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [userId]
    );
  }

  static async updateStorageUsed(userId, fileSize) {
    const result = await pool.query(
      'UPDATE users SET storage_used = storage_used + $2 WHERE id = $1 RETURNING storage_used',
      [userId, fileSize]
    );
    return result.rows[0];
  }

  static async getStatistics() {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE last_login IS NOT NULL AND last_login > NOW() - INTERVAL '7 days') as active_users,
        (SELECT COUNT(*) FROM files) as total_files,
        (SELECT COALESCE(SUM(storage_used), 0) FROM users) as total_storage_used,
        (SELECT AVG(storage_used) FROM users) as avg_storage_per_user
    `);
    return stats.rows[0];
  }
}

export default User;
