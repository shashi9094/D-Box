import pool from '../db/connection.js';

export class LoginHistory {
  static async create(loginData) {
    const { userId, ipAddress, userAgent } = loginData;
    const result = await pool.query(
      `INSERT INTO login_history (user_id, ip_address, user_agent) 
       VALUES ($1, $2, $3) 
       RETURNING id, user_id, ip_address, user_agent, login_at`,
      [userId, ipAddress, userAgent]
    );
    return result.rows[0];
  }

  static async getLoginHistory(userId, limit = 20) {
    const result = await pool.query(
      `SELECT id, user_id, ip_address, user_agent, login_at, logout_at 
       FROM login_history 
       WHERE user_id = $1
       ORDER BY login_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }

  static async recordLogout(userId) {
    const result = await pool.query(
      `UPDATE login_history 
       SET logout_at = CURRENT_TIMESTAMP 
       WHERE user_id = $1 AND logout_at IS NULL
       RETURNING id`,
      [userId]
    );
    return result.rows[0];
  }
}

export default LoginHistory;
