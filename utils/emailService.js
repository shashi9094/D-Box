const { sendEmail } = require('../emailService');

/**
 * Send invitation email to join a box/group.
 * @param {string} recipientEmail - Email to send to
 * @param {string} boxTitle - Name of the box/group
 * @param {string} senderName - Name of person sending invite
 * @param {string} joinUrl - URL for user to join/sign up
 * @returns {Promise<Object>}
 */
async function sendInvitationEmail(recipientEmail, boxTitle, senderName, joinUrl) {
  const recipient = String(recipientEmail || '').trim();

  if (!recipient) {
    console.error('sendInvitationEmail failed: invalid recipient email');
    return { success: false, error: 'Invalid recipient email' };
  }

  const subject = `You're invited to join "${String(boxTitle || '').trim()}" on D-Box`;
  const text = [
    `You're invited to join "${String(boxTitle || '').trim()}" on D-Box`,
    '',
    `${String(senderName || '').trim()} has invited you to join the group "${String(boxTitle || '').trim()}".`,
    '',
    'Click the link below to join:',
    String(joinUrl || '').trim(),
    '',
    'If you did not expect this invitation, you can safely ignore this email.'
  ].join('\n');

  try {
    const result = await sendEmail(recipient, subject, text);
    if (!result.success) {
      console.error(`sendInvitationEmail failed for ${recipient}:`, result.error);
    }
    return result;
  } catch (error) {
    const detail = [error.code, error.message].filter(Boolean).join(' | ');
    console.error(`sendInvitationEmail unexpected error for ${recipient}:`, detail || error.toString());
    return { success: false, error: detail || 'Unknown email error' };
  }
}

module.exports = {
  sendEmail,
  sendInvitationEmail
};
