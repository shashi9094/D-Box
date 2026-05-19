/**
 * Admin Invite Routes
 * Routes for admin invite system: send, validate, accept, manage invites
 */

const express = require('express');
const router = express.Router();
const adminInviteController = require('../controllers/adminInviteController');
const { requireAdmin, requireAdminOrManager, requirePermission } = require('../middlewares/roleAuth');

/**
 * POST /admin/invite/send
 * Send invite to a new user
 * Admin only
 */
router.post('/send', requireAdmin, adminInviteController.sendInvite);

/**
 * GET /admin/invite/validate/:token
 * Validate invite token
 * Public (no auth required)
 */
router.get('/validate/:token', adminInviteController.validateInvite);

/**
 * POST /admin/invite/accept
 * Accept invite and create user account
 * Public (no auth required)
 */
router.post('/accept', adminInviteController.acceptInvite);

/**
 * GET /admin/invite/my-invites
 * Get all invites sent by current admin
 * Admin/Manager only
 */
router.get('/my-invites', requireAdminOrManager, adminInviteController.getMyInvites);

/**
 * GET /admin/invite/stats
 * Get invite statistics
 * Admin only
 */
router.get('/stats', requireAdmin, adminInviteController.getInviteStats);

/**
 * DELETE /admin/invite/:inviteId
 * Revoke an unused invite
 * Admin only
 */
router.delete('/:inviteId', requireAdmin, adminInviteController.revokeInvite);

/**
 * POST /admin/invite/resend/:inviteId
 * Resend invite email
 * Admin only
 */
router.post('/resend/:inviteId', requireAdmin, adminInviteController.resendInvite);

module.exports = router;
