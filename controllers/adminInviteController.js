/**
 * Admin Invite Controller
 * Handles admin invite operations: sending, accepting, validation, and management
 */

const db = require('../db/connection');
const AdminInviteModel = require('../models/AdminInviteModel');
const tokenUtility = require('../utils/tokenUtility');
const { sendAdminInviteEmail } = require('../services/sesEmailService');
const bcryptjs = require('bcryptjs');

const FRONTEND_URL = String(process.env.FRONTEND_URL || 'http://localhost:3000').trim();

/**
 * POST /admin/invite/send
 * Send admin invite to a new user
 * Required: Admin role
 */
exports.sendInvite = async (req, res) => {
  try {
    const { email, role } = req.body;
    const adminUserId = req.session?.user?.id;

    // Validation
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    if (!role || !['admin', 'manager', 'employee'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be: admin, manager, or employee',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address',
      });
    }

    // Check if user already exists
    const sql = db.promise();
    const [existingUsers] = await sql.query(
      'SELECT id, email FROM users WHERE LOWER(email) = ? LIMIT 1',
      [normalizedEmail]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // Create invite
    const inviteResult = await AdminInviteModel.createInvite(
      normalizedEmail,
      role,
      adminUserId
    );

    // Send email with invite link
    try {
      const inviterData = await sql.query(
        'SELECT fullname FROM users WHERE id = ? LIMIT 1',
        [adminUserId]
      );

      const inviterName = inviterData[0]?.[0]?.fullname || 'Administrator';

      await sendAdminInviteEmail(
        normalizedEmail,
        inviteResult.inviteLink,
        inviterName,
        role
      );
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Don't fail the request if email fails, but log it
      return res.status(500).json({
        success: false,
        message: 'Invite created but email sending failed. Please check email configuration.',
        error: emailError.message,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Invite sent successfully',
      data: {
        inviteId: inviteResult.inviteId,
        email: normalizedEmail,
        role,
        expiresAt: inviteResult.expiresAt,
        inviteLink: inviteResult.inviteLink,
      },
    });
  } catch (error) {
    console.error('Error sending invite:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to send invite',
    });
  }
};

/**
 * GET /admin/invite/validate/:token
 * Validate invite token before acceptance
 * Public endpoint
 */
exports.validateInvite = async (req, res) => {
  try {
    const { token } = req.params;
    const { email } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Invite token is required',
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required for validation',
      });
    }

    const parsedToken = tokenUtility.parseToken(token);
    if (!parsedToken) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token format',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Validate invite
    const validationResult = await AdminInviteModel.validateInvite(
      parsedToken,
      normalizedEmail
    );

    if (!validationResult.valid) {
      return res.status(400).json({
        success: false,
        message: validationResult.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Invite is valid',
      data: validationResult.invite,
    });
  } catch (error) {
    console.error('Error validating invite:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate invite',
    });
  }
};

/**
 * POST /admin/invite/accept
 * Accept invite and create user account
 * Public endpoint - no auth required
 */
exports.acceptInvite = async (req, res) => {
  try {
    const { token, email, password, fullname } = req.body;
    const sql = db.promise();

    // Validation
    if (!token || !email || !password || !fullname) {
      return res.status(400).json({
        success: false,
        message: 'Token, email, password, and fullname are required',
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters',
      });
    }

    const parsedToken = tokenUtility.parseToken(token);
    if (!parsedToken) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token format',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const fullnameStr = String(fullname).trim();

    // Validate invite
    const validationResult = await AdminInviteModel.validateInvite(
      parsedToken,
      normalizedEmail
    );

    if (!validationResult.valid) {
      return res.status(400).json({
        success: false,
        message: validationResult.message,
      });
    }

    // Hash password
    const passwordHash = await bcryptjs.hash(password, 10);

    // Create user account
    const [result] = await sql.query(
      `INSERT INTO users (email, password, fullname, role, is_admin, email_verified)
       VALUES (?, ?, ?, ?, ?, true)
       RETURNING id, email, fullname, role`,
      [
        normalizedEmail,
        passwordHash,
        fullnameStr,
        validationResult.invite.role,
        validationResult.invite.role === 'admin',
      ]
    );

    if (!result || result.length === 0) {
      throw new Error('Failed to create user account');
    }

    const newUser = result[0];

    // Accept the invite
    const acceptResult = await AdminInviteModel.acceptInvite(parsedToken, newUser.id);

    return res.status(200).json({
      success: true,
      message: 'Account created and invite accepted',
      data: {
        userId: newUser.id,
        email: newUser.email,
        fullname: newUser.fullname,
        role: newUser.role,
        inviteAcceptedAt: acceptResult.usedAt,
      },
    });
  } catch (error) {
    console.error('Error accepting invite:', error);

    // Check for duplicate email
    if (error.message && error.message.includes('duplicate key')) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered',
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to accept invite',
    });
  }
};

/**
 * GET /admin/invite/my-invites
 * Get all invites sent by current admin
 * Required: Admin or Manager role
 */
exports.getMyInvites = async (req, res) => {
  try {
    const adminUserId = req.session?.user?.id;
    const { filter = 'all', role, email } = req.query;

    // Validate filter
    const validFilters = ['all', 'pending', 'accepted', 'expired'];
    if (!validFilters.includes(filter)) {
      return res.status(400).json({
        success: false,
        message: `Invalid filter. Valid values: ${validFilters.join(', ')}`,
      });
    }

    // Build filters object
    const filters = {};

    if (filter === 'pending') {
      filters.used = false;
    } else if (filter === 'accepted') {
      filters.used = true;
    }

    if (role && ['admin', 'manager', 'employee'].includes(role)) {
      filters.role = role;
    }

    if (email) {
      filters.email = email;
    }

    // Get invites
    const invites = await AdminInviteModel.getAdminInvites(adminUserId, filters);

    return res.status(200).json({
      success: true,
      message: 'Invites retrieved successfully',
      data: {
        total: invites.length,
        filter,
        invites,
      },
    });
  } catch (error) {
    console.error('Error fetching invites:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch invites',
    });
  }
};

/**
 * GET /admin/invite/stats
 * Get invite statistics for current admin
 * Required: Admin role
 */
exports.getInviteStats = async (req, res) => {
  try {
    const adminUserId = req.session?.user?.id;

    const statsResult = await AdminInviteModel.getInviteStats(adminUserId);

    return res.status(200).json({
      success: true,
      message: 'Statistics retrieved successfully',
      data: statsResult.stats,
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get statistics',
    });
  }
};

/**
 * DELETE /admin/invite/:inviteId
 * Revoke an unused invite
 * Required: Admin role
 */
exports.revokeInvite = async (req, res) => {
  try {
    const { inviteId } = req.params;
    const adminUserId = req.session?.user?.id;

    if (!inviteId) {
      return res.status(400).json({
        success: false,
        message: 'Invite ID is required',
      });
    }

    const revokeResult = await AdminInviteModel.revokeInvite(
      Number(inviteId),
      adminUserId
    );

    return res.status(200).json({
      success: true,
      message: revokeResult.message,
      data: {
        inviteId: revokeResult.inviteId,
      },
    });
  } catch (error) {
    console.error('Error revoking invite:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to revoke invite',
    });
  }
};

/**
 * POST /admin/invite/resend/:inviteId
 * Resend invite email to the same address
 * Required: Admin role
 */
exports.resendInvite = async (req, res) => {
  try {
    const { inviteId } = req.params;
    const adminUserId = req.session?.user?.id;

    if (!inviteId) {
      return res.status(400).json({
        success: false,
        message: 'Invite ID is required',
      });
    }

    const sql = db.promise();

    // Get invite details
    const [invites] = await sql.query(
      `SELECT id, email, role, invited_by_user_id, is_used
       FROM admin_invites
       WHERE id = ? AND invited_by_user_id = ?
       LIMIT 1`,
      [Number(inviteId), adminUserId]
    );

    if (invites.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invite not found',
      });
    }

    const invite = invites[0];

    if (invite.is_used) {
      return res.status(400).json({
        success: false,
        message: 'Cannot resend already accepted invite',
      });
    }

    // Get inviter info
    const [inviters] = await sql.query(
      'SELECT fullname FROM users WHERE id = ? LIMIT 1',
      [adminUserId]
    );

    const inviterName = inviters[0]?.fullname || 'Administrator';

    // Generate new token
    const newPlainToken = tokenUtility.generateToken();
    const newTokenHash = await tokenUtility.hashToken(newPlainToken);
    const newExpiresAt = tokenUtility.getTokenExpiry(24);
    const inviteLink = tokenUtility.generateInviteLink(newPlainToken);

    // Update invite with new token
    const [updateResult] = await sql.query(
      `UPDATE admin_invites
       SET token_hash = ?, plain_token = ?, expires_at = ?, updated_at = NOW()
       WHERE id = ?
       RETURNING id, email, role`,
      [newTokenHash, newPlainToken, newExpiresAt, Number(inviteId)]
    );

    if (!updateResult || updateResult.length === 0) {
      throw new Error('Failed to update invite');
    }

    // Send email
    try {
      await sendAdminInviteEmail(
        invite.email,
        inviteLink,
        inviterName,
        invite.role
      );
    } catch (emailError) {
      console.error('Email resend failed:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to resend invite email',
        error: emailError.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Invite resent successfully',
      data: {
        inviteId: updateResult[0].id,
        email: updateResult[0].email,
        newExpiresAt,
      },
    });
  } catch (error) {
    console.error('Error resending invite:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to resend invite',
    });
  }
};
