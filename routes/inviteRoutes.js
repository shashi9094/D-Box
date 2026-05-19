/**
 * Invite Routes
 * Routes for invite management
 */

const express = require('express');
const router = express.Router();
const { inviteLimiter } = require('../middleware/rateLimiter');
const {
  sendInvite,
  acceptInvite,
  getInvite,
  getPendingInvites,
} = require('../controllers/inviteController');

/**
 * POST /invite/send
 * Send invite to an email
 * Requires authentication
 * Body: { email: "user@example.com", boxId: 123 (optional) }
 */
router.post('/send', inviteLimiter, sendInvite);

/**
 * POST /invite/accept
 * Accept invite (can be public or authenticated)
 * Body: { token: "xxx", email: "user@example.com", fullname?: "Name", password?: "pass123" }
 */
router.post('/accept', acceptInvite);

/**
 * GET /invite/:token
 * Get invite details (public)
 */
router.get('/:token', getInvite);

/**
 * GET /invite/list/pending
 * Get pending invites for authenticated user
 */
router.get('/list/pending', getPendingInvites);

module.exports = router;
