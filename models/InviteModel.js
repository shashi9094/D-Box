/**
 * Invite Model
 * Handles invite token generation, storage, and validation
 */

const db = require('../db/connection');
const crypto = require('crypto');

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

class InviteModel {
  /**
   * Generate secure invite token
   */
  static generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Create invite token
   */
  static async createInvite(invitedEmail, invitedByUserId, boxId = null) {
    const sql = db.promise();
    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);

    try {
      const query = `
        INSERT INTO invites (token, invited_email, invited_by_user_id, box_id, expires_at, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
      `;

      const [result] = await sql.query(query, [
        token,
        invitedEmail.toLowerCase().trim(),
        invitedByUserId,
        boxId || null,
        expiresAt,
        'pending',
      ]);

      return {
        success: true,
        inviteId: result.insertId,
        token,
        invitedEmail,
        expiresAt,
      };
    } catch (error) {
      console.error('Error creating invite:', error);
      throw new Error('Failed to create invite');
    }
  }

  /**
   * Get invite by token
   */
  static async getInviteByToken(token) {
    const sql = db.promise();

    try {
      const query = `
        SELECT i.id, i.token, i.invited_email, i.invited_by_user_id, i.box_id, 
               i.expires_at, i.status, i.created_at, u.fullname as invited_by_name
        FROM invites i
        LEFT JOIN users u ON i.invited_by_user_id = u.id
        WHERE i.token = ? AND i.status = 'pending'
        LIMIT 1
      `;

      const [rows] = await sql.query(query, [token]);

      if (rows.length === 0) {
        return null;
      }

      const invite = rows[0];

      // Check if expired
      if (new Date(invite.expires_at) < new Date()) {
        await this.updateInviteStatus(invite.id, 'expired');
        return null;
      }

      return invite;
    } catch (error) {
      console.error('Error getting invite:', error);
      throw new Error('Failed to retrieve invite');
    }
  }

  /**
   * Accept invite
   */
  static async acceptInvite(token, userId) {
    const sql = db.promise();

    try {
      // Get invite
      const invite = await this.getInviteByToken(token);

      if (!invite) {
        return {
          success: false,
          message: 'Invite not found, expired, or already used',
        };
      }

      // Update invite status
      await this.updateInviteStatus(invite.id, 'accepted');

      // If box_id is set, add user to box
      if (invite.box_id) {
        const addUserQuery = `
          INSERT INTO box_members (box_id, user_id, role, added_at)
          VALUES (?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE role = VALUES(role)
        `;
        await sql.query(addUserQuery, [invite.box_id, userId, 'member']);
      }

      return {
        success: true,
        message: 'Invite accepted successfully',
        boxId: invite.box_id,
      };
    } catch (error) {
      console.error('Error accepting invite:', error);
      throw new Error('Failed to accept invite');
    }
  }

  /**
   * Update invite status
   */
  static async updateInviteStatus(inviteId, status) {
    const sql = db.promise();

    try {
      const query = `UPDATE invites SET status = ? WHERE id = ?`;
      await sql.query(query, [status, inviteId]);
    } catch (error) {
      console.error('Error updating invite status:', error);
    }
  }

  /**
   * Send invite
   */
  static async sendInvite(invitedEmail, invitedByUserId, boxId = null) {
    const sql = db.promise();

    try {
      // Check if email is already invited for same box
      if (boxId) {
        const checkQuery = `
          SELECT id FROM invites 
          WHERE invited_email = ? AND box_id = ? AND status = 'pending'
          LIMIT 1
        `;
        const [existingInvites] = await sql.query(checkQuery, [
          invitedEmail.toLowerCase().trim(),
          boxId,
        ]);

        if (existingInvites.length > 0) {
          return {
            success: false,
            message: 'This email already has a pending invite for this box',
          };
        }
      }

      // Create invite
      return await this.createInvite(invitedEmail, invitedByUserId, boxId);
    } catch (error) {
      console.error('Error sending invite:', error);
      throw new Error('Failed to send invite');
    }
  }

  /**
   * Get user invites
   */
  static async getUserInvites(email) {
    const sql = db.promise();

    try {
      const query = `
        SELECT i.id, i.token, i.invited_email, i.box_id, i.expires_at, 
               i.status, i.created_at, u.fullname as invited_by_name,
               b.name as box_name
        FROM invites i
        LEFT JOIN users u ON i.invited_by_user_id = u.id
        LEFT JOIN boxes b ON i.box_id = b.id
        WHERE i.invited_email = ? AND i.status = 'pending'
        AND i.expires_at > NOW()
        ORDER BY i.created_at DESC
      `;

      const [invites] = await sql.query(query, [email.toLowerCase().trim()]);
      return invites;
    } catch (error) {
      console.error('Error getting user invites:', error);
      throw new Error('Failed to retrieve invites');
    }
  }

  /**
   * Clean up expired invites (should be run periodically)
   */
  static async cleanupExpiredInvites() {
    const sql = db.promise();

    try {
      const query = `
        UPDATE invites 
        SET status = 'expired' 
        WHERE status = 'pending' AND expires_at < NOW()
      `;
      const result = await sql.query(query);
      console.log(`Updated ${result[0].affectedRows} expired invites`);
    } catch (error) {
      console.error('Error cleaning up invites:', error);
    }
  }
}

module.exports = InviteModel;
