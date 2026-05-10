import pool from '../db/connection.js';

export class File {
  static async create(fileData) {
    const { userId, fileName, fileUrl, fileSize, mimeType } = fileData;
    const result = await pool.query(
      `INSERT INTO files (user_id, file_name, file_url, file_size, mime_type) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, user_id, file_name, file_url, file_size, mime_type, uploaded_at`,
      [userId, fileName, fileUrl, fileSize, mimeType]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query(
      'SELECT * FROM files WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return result.rows[0];
  }

  static async getFilesByUser(userId, limit = 50, offset = 0) {
    const result = await pool.query(
      `SELECT id, user_id, file_name, file_url, file_size, mime_type, uploaded_at 
       FROM files 
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY uploaded_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows;
  }

  static async getUserFileCount(userId) {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM files WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );
    return result.rows[0].count;
  }

  static async getAllFiles(limit = 100, offset = 0) {
    const result = await pool.query(
      `SELECT id, user_id, file_name, file_url, file_size, mime_type, uploaded_at 
       FROM files 
       WHERE deleted_at IS NULL
       ORDER BY uploaded_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  }

  static async getTotalFileCount() {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM files WHERE deleted_at IS NULL'
    );
    return result.rows[0].count;
  }

  static async softDelete(fileId) {
    const result = await pool.query(
      'UPDATE files SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id',
      [fileId]
    );
    return result.rows[0];
  }

  static async delete(fileId) {
    const result = await pool.query(
      'DELETE FROM files WHERE id = $1 RETURNING id',
      [fileId]
    );
    return result.rows[0];
  }

  static async getUserTotalSize(userId) {
    const result = await pool.query(
      'SELECT COALESCE(SUM(file_size), 0) as total_size FROM files WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );
    return result.rows[0].total_size;
  }
}

export default File;
