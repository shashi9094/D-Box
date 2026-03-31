const nodemailer = require('nodemailer');

// Create transporter - using Gmail SMTP
// For production, use environment variables with app passwords
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'your-app-password'
  }
});

// Verify transporter connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.warn('Email service not configured:', error.message);
  } else {
    console.log('Email service ready');
  }
});

/**
 * Send invitation email to join a box/group
 * @param {string} recipientEmail - Email to send to
 * @param {string} boxTitle - Name of the box/group
 * @param {string} senderName - Name of person sending invite
 * @param {string} joinUrl - URL for user to join/sign up
 * @returns {Promise<Object>}
 */
const sendInvitationEmail = async (recipientEmail, boxTitle, senderName, joinUrl) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@d-box.local',
      to: recipientEmail,
      subject: `You're invited to join "${boxTitle}" on D-Box`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #333; margin-top: 0;">Welcome to D-Box!</h2>
            <p style="color: #666; font-size: 16px;">
              <strong>${senderName}</strong> has invited you to join the group <strong>"${boxTitle}"</strong>
            </p>
          </div>

          <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #0084ff;">
            <p style="color: #333; margin: 0 0 10px 0;">
              Click the button below to join the group and start collaborating:
            </p>
            <a href="${joinUrl}" style="display: inline-block; background-color: #0084ff; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 10px;">
              Join Now
            </a>
            <p style="color: #999; font-size: 12px; margin-top: 15px;">
              Or copy this link in your browser: <br/>
              <a href="${joinUrl}" style="color: #0084ff; word-break: break-all;">
                ${joinUrl}
              </a>
            </p>
          </div>

          <div style="border-top: 1px solid #ddd; padding-top: 20px; color: #999; font-size: 12px;">
            <p style="margin: 0 0 10px 0;">
              D-Box is a secure file sharing and collaboration platform.
            </p>
            <p style="margin: 0;">
              If you did not expect this invitation, you can safely ignore this email.
            </p>
          </div>
        </div>
      `,
      text: `
You're invited to join "${boxTitle}" on D-Box

${senderName} has invited you to join the group "${boxTitle}". 

Click the link below to join:
${joinUrl}

If you did not expect this invitation, you can safely ignore this email.
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`Invitation email sent to ${recipientEmail}:`, result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error(`Failed to send invitation email to ${recipientEmail}:`, error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendInvitationEmail
};
