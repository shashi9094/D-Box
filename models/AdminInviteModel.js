/**
 * Admin Invite Model
 * Handles admin invite token generation, storage, validation, and lifecycle
 */

const db = require('../db/connection');
const tokenUtility = require('../utils/tokenUtility');

const ADMIN_INVITE_EXPIRY_HOURS = 24;

class AdminInviteModel {
  /**
   * Create admin invite
   * @param {string} email - Email to send invite to
   * @param {string} role - Role for the invited user (admin, manager, employee)
   * @param {number} invitedByUserId - User ID of the person sending invite
   * @returns {Promise<object>} - Invite details with token and link
   */
  static async createInvite(email, role, invitedByUserId) {
    const sql = db.promise();
    const normalizedEmail = String(email || '').trim().toLowerCase();

    try {
      // Validate email
      if (!normalizedEmail || !normalizedEmail.includes('@')) {
        throw new Error('Invalid email address');
      }

      // Validate role
      if (!['admin', 'manager', 'employee'].includes(role)) {
        throw new Error('Invalid role. Must be: admin, manager, or employee');
      }

      // Check if user is admin or has permission to send invites
      const [invokerData] = await sql.query(
        'SELECT role FROM users WHERE id = ? LIMIT 1',
        [invitedByUserId]
      );

      if (invokerData.length === 0) {
        throw new Error('Invoking user not found');
      }

      const invokerRole = invokerData[0].role || 'employee';
      if (invokerRole !== 'admin') {
        throw new Error('Only admins can send invites');
      }

      // Generate token
      const plainToken = tokenUtility.generateToken();
      const tokenHash = await tokenUtility.hashToken(plainToken);
      const expiresAt = tokenUtility.getTokenExpiry(ADMIN_INVITE_EXPIRY_HOURS);

      // Insert into database
      const query = `
        INSERT INTO admin_invites 
        (token_hash, plain_token, email, role, invited_by_user_id, expires_at, is_used)
        VALUES (?, ?, ?, ?, ?, ?, false)
        RETURNING 
          id, token_hash, email, role, expires_at, 
          invited_by_user_id, is_used, created_at
      `;

      const [result] = await sql.query(query, [
        tokenHash,
        plainToken,
        normalizedEmail,
        role,
        invitedByUserId,
        expiresAt,
      ]);

      const inviteData = result[0];

      return {
        success: true,
        inviteId: inviteData.id,
        token: plainToken,
        email: normalizedEmail,
        role,
        expiresAt: inviteData.expires_at,
        inviteLink: tokenUtility.generateInviteLink(plainToken),
      };
    } catch (error) {
      console.error('Error creating admin invite:', error);
      throw error;
    }
  }

  /**
   * Get invite by plain token
   * @param {string} plainToken - Plain text token
   * @returns {Promise<object|null>} - Invite data or null if not found/expired
   */
  static async getInviteByToken(plainToken) {
    const sql = db.promise();

    try {
      // Get all non-expired, non-used invites
      const query = `
        SELECT 
          id, token_hash, email, role, invited_by_user_id, 
          expires_at, is_used, created_at, updated_at,
          (SELECT fullname FROM users WHERE users.id = admin_invites.invited_by_user_id) as invited_by_name
        FROM admin_invites
        WHERE is_used = false
          AND expires_at > NOW()
        LIMIT 100
      `;

      const [invites] = await sql.query(query);

      // Find matching invite by comparing token hash
      for (const invite of invites) {
        const isMatch = await tokenUtility.verifyToken(plainToken, invite.token_hash);
        if (isMatch) {
          return {
            ...invite,
            isExpired: false,
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Error retrieving invite:', error);
      throw error;
    }
  }

  /**
   * Validate invite token
   * @param {string} plainToken - Plain text token
   * @param {string} email - Email to match against invite
   * @returns {Promise<object>} - Validation result
   */
  static async validateInvite(plainToken, email) {
    try {
      const invite = await this.getInviteByToken(plainToken);

      if (!invite) {
        return {
          valid: false,
          message: 'Invalid or expired invite token',
        };
      }

      const normalizedEmail = String(email || '').trim().toLowerCase();
      if (invite.email !== normalizedEmail) {
        return {
          valid: false,
          message: 'Email does not match invite',
        };
      }

      if (tokenUtility.isTokenExpired(invite.expires_at)) {
        return {
          valid: false,
          message: 'Invite token has expired',
        };
      }

      if (invite.is_used) {
        return {
          valid: false,
          message: 'Invite has already been used',
        };
      }

      return {
        valid: true,
        invite: {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          invitedByName: invite.invited_by_name,
          expiresAt: invite.expires_at,
        },
      };
    } catch (error) {
      console.error('Error validating invite:', error);
      return {
        valid: false,
        message: 'Error validating invite',
      };
    }
  }

  /**
   * Accept and use invite
   * @param {string} plainToken - Plain text token
   * @param {number} userId - User ID accepting the invite
   * @returns {Promise<object>} - Success/error result
   */
  static async acceptInvite(plainToken, userId) {
    const sql = db.promise();

    try {
      const invite = await this.getInviteByToken(plainToken);

      if (!invite) {
        throw new Error('Invalid or expired invite token');
      }

      if (invite.is_used) {
        throw new Error('Invite has already been used');
      }

      // Update invite as used
      const updateQuery = `
        UPDATE admin_invites
        SET 
          is_used = true,
          used_at = NOW(),
          used_by_user_id = ?,
          updated_at = NOW()
        WHERE id = ?
        RETURNING id, email, role, used_at
      `;

      const [result] = await sql.query(updateQuery, [userId, invite.id]);

      if (result.length === 0) {
        throw new Error('Failed to update invite');
      }

      // Update user role
      const roleUpdateQuery = `
        UPDATE users
        SET role = ?, is_admin = ?
        WHERE id = ?
      `;

      const isAdminRole = invite.role === 'admin';
      await sql.query(roleUpdateQuery, [invite.role, isAdminRole, userId]);

      return {
        success: true,
        message: 'Invite accepted successfully',
        inviteId: invite.id,
        role: invite.role,
        usedAt: result[0].used_at,
      };
    } catch (error) {
      console.error('Error accepting invite:', error);
      throw error;
    }
  }

  /**
   * Get admin invites for a user (sent by this admin)
   * @param {number} adminUserId - Admin user ID
   * @param {object} filters - Optional filters (used, role, etc)
   * @returns {Promise<array>} - List of invites
   */
  static async getAdminInvites(adminUserId, filters = {}) {
    const sql = db.promise();

    try {
      let query = `
        SELECT 
          id, email, role, expires_at, is_used, 
          used_at, created_at, updated_at,
          (SELECT fullname FROM users WHERE users.id = used_by_user_id) as accepted_by_name
        FROM admin_invites
        WHERE invited_by_user_id = ?
      `;

      const params = [adminUserId];

      // Add optional filters
      if (filters.used !== undefined) {
        query += ' AND is_used = ?';
        params.push(filters.used);
      }

      if (filters.role) {
        query += ' AND role = ?';
        params.push(filters.role);
      }

      if (filters.email) {
        query += ' AND email ILIKE ?';
        params.push(`%${filters.email}%`);
      }

      // Add ordering
      query += ' ORDER BY created_at DESC LIMIT 100';

      const [invites] = await sql.query(query, params);

      return invites.map(invite => ({
        ...invite,
        isExpired: tokenUtility.isTokenExpired(invite.expires_at),
      }));
    } catch (error) {
      console.error('Error fetching admin invites:', error);
      throw error;
    }
  }

  /**
   * Revoke unused invite
   * @param {number} inviteId - Invite ID
   * @param {number} adminUserId - Admin user ID (for authorization)
   * @returns {Promise<object>} - Success result
   */
  static async revokeInvite(inviteId, adminUserId) {
    const sql = db.promise();

    try {
      // Check authorization
      const [invites] = await sql.query(
        'SELECT id FROM admin_invites WHERE id = ? AND invited_by_user_id = ? LIMIT 1',
        [inviteId, adminUserId]
      );

      if (invites.length === 0) {
        throw new Error('Invite not found or access denied');
      }

      // Update as expired
      const query = `
        UPDATE admin_invites
        SET updated_at = NOW()
        WHERE id = ? AND is_used = false
        RETURNING id
      `;

      const [result] = await sql.query(query, [inviteId]);

      if (result.length === 0) {
        throw new Error('Invite has already been used or revoked');
      }

      return {
        success: true,
        message: 'Invite revoked successfully',
        inviteId: result[0].id,
      };
    } catch (error) {
      console.error('Error revoking invite:', error);
      throw error;
    }
  }

  /**
   * Clean up expired invites
   * @returns {Promise<object>} - Cleanup result
   */
  static async cleanupExpiredInvites() {
    const sql = db.promise();

    try {
      const query = `
        DELETE FROM admin_invites
        WHERE expires_at < NOW() AND is_used = false
      `;

      const [result] = await sql.query(query);

      return {
        success: true,
        message: 'Expired invites cleaned up',
        deletedCount: result.affectedRows || 0,
      };
    } catch (error) {
      console.error('Error cleaning up invites:', error);
      throw error;
    }
  }

  /**
   * Get invite statistics
   * @param {number} adminUserId - Admin user ID
   * @returns {Promise<object>} - Statistics
   */
  static async getInviteStats(adminUserId) {
    const sql = db.promise();

    try {
      const query = `
        SELECT
          COUNT(*) as total_invites,
          SUM(CASE WHEN is_used = true THEN 1 ELSE 0 END) as accepted_invites,
          SUM(CASE WHEN is_used = false AND expires_at > NOW() THEN 1 ELSE 0 END) as pending_invites,
          SUM(CASE WHEN expires_at < NOW() AND is_used = false THEN 1 ELSE 0 END) as expired_invites,
          COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_invites,
          COUNT(CASE WHEN role = 'manager' THEN 1 END) as manager_invites,
          COUNT(CASE WHEN role = 'employee' THEN 1 END) as employee_invites
        FROM admin_invites
        WHERE invited_by_user_id = ?
      `;

      const [result] = await sql.query(query, [adminUserId]);

      return {
        success: true,
        stats: result[0] || {},
      };
    } catch (error) {
      console.error('Error getting invite stats:', error);
      throw error;
    }
  }
}

module.exports = AdminInviteModel;
