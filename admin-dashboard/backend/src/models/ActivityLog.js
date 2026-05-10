import pool from '../db/connection.js';

export class ActivityLog {
  static async create(logData) {
    const { adminId, action, targetUser, targetFile, description, ipAddress, userAgent } = logData;
    const result = await pool.query(
      `INSERT INTO activity_logs (admin_id, action, target_user, target_file, description, ip_address, user_agent) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, admin_id, action, target_user, target_file, description, created_at`,
      [adminId, action, targetUser, targetFile, description, ipAddress, userAgent]
    );
    return result.rows[0];
  }

  static async getRecentLogs(limit = 50, offset = 0) {
    const result = await pool.query(
      `SELECT id, admin_id, action, target_user, target_file, description, created_at 
       FROM activity_logs 
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  }

  static async getLogsByUser(userId, limit = 50, offset = 0) {
    const result = await pool.query(
      `SELECT id, admin_id, action, target_user, target_file, description, created_at 
       FROM activity_logs 
       WHERE admin_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows;
  }

  static async getLogsByTargetUser(targetUserId, limit = 50, offset = 0) {
    const result = await pool.query(
      `SELECT id, admin_id, action, target_user, target_file, description, created_at 
       FROM activity_logs 
       WHERE target_user = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [targetUserId, limit, offset]
    );
    return result.rows;
  }

  static async getTotalLogCount() {
    const result = await pool.query('SELECT COUNT(*) as count FROM activity_logs');
    return result.rows[0].count;
  }

  static async getActionStats() {
    const result = await pool.query(`
      SELECT action, COUNT(*) as count 
      FROM activity_logs 
      GROUP BY action 
      ORDER BY count DESC
    `);
    return result.rows;
  }

  static async getDailyActivityStats(days = 7) {
    const result = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as activity_count
      FROM activity_logs
      WHERE created_at > NOW() - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
    return result.rows;
  }
}

export default ActivityLog;
