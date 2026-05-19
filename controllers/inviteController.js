/**
 * Invite Controller
 * Handles invite sending and acceptance
 */

const db = require('../db/connection');
const InviteModel = require('../models/InviteModel');
const { sendInviteEmail } = require('../services/sesEmailService');

const FRONTEND_URL = String(process.env.FRONTEND_URL || 'http://localhost:3000').trim();

/**
 * POST /invite/send
 * Send invite to an email
 */
exports.sendInvite = async (req, res) => {
  try {
    const { email, boxId } = req.body;
    const userId = req.session?.user?.id;

    // Authentication check
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Validation
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Valid email address is required',
      });
    }

    if (normalizedEmail === (req.session.user.email || '').toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot invite yourself',
      });
    }

    const sql = db.promise();

    // Get user details
    const [users] = await sql.query(
      'SELECT fullname FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    const userName = users[0].fullname;

    // Check if boxId exists and user has access
    if (boxId) {
      const parsedBoxId = Number(boxId);
      const [boxes] = await sql.query(
        `SELECT id FROM boxes 
         WHERE id = ? AND (owner_id = ? OR id IN (
           SELECT box_id FROM box_members WHERE user_id = ?
         ))
         LIMIT 1`,
        [parsedBoxId, userId, userId]
      );

      if (boxes.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Box not found or access denied',
        });
      }
    }

    // Create invite
    const inviteResult = await InviteModel.sendInvite(
      normalizedEmail,
      userId,
      boxId ? Number(boxId) : null
    );

    if (!inviteResult.success) {
      return res.status(400).json({
        success: false,
        message: inviteResult.message,
      });
    }

    // Generate invite link
    const inviteLink = `${FRONTEND_URL}/invite/${inviteResult.token}`;

    // Send invite email
    try {
      await sendInviteEmail(normalizedEmail, inviteLink, userName);
    } catch (emailError) {
      console.error('Error sending invite email:', emailError);
      // Continue even if email fails - invite is still created
      return res.status(201).json({
        success: true,
        message: 'Invite created but failed to send email',
        invite: {
          id: inviteResult.inviteId,
          token: inviteResult.token,
          email: normalizedEmail,
          expiresAt: inviteResult.expiresAt,
        },
        emailError: true,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Invite sent successfully',
      invite: {
        id: inviteResult.inviteId,
        token: inviteResult.token,
        email: normalizedEmail,
        expiresAt: inviteResult.expiresAt,
      },
    });
  } catch (error) {
    console.error('Error sending invite:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send invite',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * POST /invite/accept
 * Accept invite and create account or join box
 */
exports.acceptInvite = async (req, res) => {
  try {
    const { token, ...signupData } = req.body;

    if (!token || token.length < 32) {
      return res.status(400).json({
        success: false,
        message: 'Invalid invite token',
      });
    }

    // Get invite details
    const invite = await InviteModel.getInviteByToken(token);

    if (!invite) {
      return res.status(400).json({
        success: false,
        message: 'Invite not found, expired, or already used',
      });
    }

    const sql = db.promise();

    // Check if email matches
    const normalizedInvitedEmail = invite.invited_email.toLowerCase();
    const normalizedSignupEmail = String(signupData.email || '')
      .trim()
      .toLowerCase();

    if (normalizedInvitedEmail !== normalizedSignupEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email does not match invite',
      });
    }

    // Check if user already exists
    const [existingUsers] = await sql.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
      [normalizedSignupEmail]
    );

    let userId;

    if (existingUsers.length === 0) {
      // Create new user account from signup data
      const { fullname, password } = signupData;

      if (!fullname || !password) {
        return res.status(400).json({
          success: false,
          message: 'Full name and password are required',
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters',
        });
      }

      const bcrypt = require('bcryptjs');
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create user
      const [result] = await sql.query(
        'INSERT INTO users (fullname, email, password, email_verified, created_at) VALUES (?, ?, ?, ?, NOW())',
        [fullname.trim(), normalizedSignupEmail, hashedPassword, true]
      );

      userId = result.insertId;
    } else {
      userId = existingUsers[0].id;
    }

    // Accept invite
    const acceptResult = await InviteModel.acceptInvite(token, userId);

    if (!acceptResult.success) {
      return res.status(400).json({
        success: false,
        message: acceptResult.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Invite accepted successfully',
      userId,
      boxId: acceptResult.boxId,
    });
  } catch (error) {
    console.error('Error accepting invite:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to accept invite',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * GET /invite/:token
 * Get invite details (public endpoint)
 */
exports.getInvite = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token || token.length < 32) {
      return res.status(400).json({
        success: false,
        message: 'Invalid invite token',
      });
    }

    const invite = await InviteModel.getInviteByToken(token);

    if (!invite) {
      return res.status(404).json({
        success: false,
        message: 'Invite not found, expired, or already used',
      });
    }

    return res.status(200).json({
      success: true,
      invite: {
        email: invite.invited_email,
        invitedByName: invite.invited_by_name,
        boxName: invite.box_name,
        expiresAt: invite.expires_at,
      },
    });
  } catch (error) {
    console.error('Error getting invite:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve invite details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * GET /invite/list/pending
 * Get pending invites for authenticated user
 */
exports.getPendingInvites = async (req, res) => {
  try {
    const userEmail = req.session?.user?.email;

    if (!userEmail) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const invites = await InviteModel.getUserInvites(userEmail);

    return res.status(200).json({
      success: true,
      invites,
      count: invites.length,
    });
  } catch (error) {
    console.error('Error getting pending invites:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve invites',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

module.exports = {
  sendInvite: exports.sendInvite,
  acceptInvite: exports.acceptInvite,
  getInvite: exports.getInvite,
  getPendingInvites: exports.getPendingInvites,
};
