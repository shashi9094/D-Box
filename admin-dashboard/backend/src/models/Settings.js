import pool from '../db/connection.js';

export class Settings {
  static async get(key) {
    const result = await pool.query(
      'SELECT id, key, value FROM settings WHERE key = $1',
      [key]
    );
    return result.rows[0];
  }

  static async getAll() {
    const result = await pool.query('SELECT key, value FROM settings');
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    return settings;
  }

  static async set(key, value) {
    const result = await pool.query(
      `INSERT INTO settings (key, value) 
       VALUES ($1, $2) 
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP
       RETURNING key, value`,
      [key, value]
    );
    return result.rows[0];
  }

  static async delete(key) {
    const result = await pool.query(
      'DELETE FROM settings WHERE key = $1 RETURNING key',
      [key]
    );
    return result.rows[0];
  }
}

export default Settings;
