/**
 * AWS SES Email Service
 * Centralized email sending service using AWS Simple Email Service (SES)
 * Handles all email communications for the application
 */

const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

const AWS_REGION = String(process.env.AWS_REGION || "us-east-1").trim();
const AWS_ACCESS_KEY_ID = String(process.env.AWS_ACCESS_KEY_ID || "").trim();
const AWS_SECRET_ACCESS_KEY = String(process.env.AWS_SECRET_ACCESS_KEY || "").trim();
const AWS_SES_FROM_EMAIL = String(process.env.AWS_SES_FROM_EMAIL || "no-reply@mydbox.local").trim();

// Initialize SES Client
const sesClient = new SESClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Send email via AWS SES
 * @param {string} toEmail - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} htmlBody - HTML email body
 * @param {string} textBody - Plain text email body (optional)
 * @returns {Promise<object>} SES response
 */
async function sendEmail(toEmail, subject, htmlBody, textBody = null) {
  try {
    // Validate inputs
    if (!toEmail || !toEmail.includes("@")) {
      throw new Error("Invalid recipient email address");
    }

    if (!subject || subject.trim().length === 0) {
      throw new Error("Email subject is required");
    }

    if (!htmlBody || htmlBody.trim().length === 0) {
      throw new Error("Email body is required");
    }

    // Prepare email command
    const params = {
      Source: AWS_SES_FROM_EMAIL,
      Destination: {
        ToAddresses: [toEmail.toLowerCase().trim()],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: "UTF-8",
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: "UTF-8",
          },
          ...(textBody && {
            Text: {
              Data: textBody,
              Charset: "UTF-8",
            },
          }),
        },
      },
    };

    // Send email
    const command = new SendEmailCommand(params);
    const response = await sesClient.send(command);

    console.log(`✓ Email sent successfully to ${toEmail}`, {
      messageId: response.MessageId,
      subject,
    });

    return {
      success: true,
      messageId: response.MessageId,
      email: toEmail,
    };
  } catch (error) {
    console.error(`✗ Failed to send email to ${toEmail}`, {
      error: error.message,
      code: error.code,
    });

    throw new Error(`Email send failed: ${error.message}`);
  }
}

/**
 * Send OTP verification email
 * @param {string} toEmail - Recipient email
 * @param {string} otp - 6-digit OTP code
 * @param {string} purpose - "signup" or "reset"
 */
async function sendOTPEmail(toEmail, otp, purpose = "signup") {
  const subject =
    purpose === "reset"
      ? "Password Reset OTP - D-Box"
      : "Email Verification OTP - D-Box";

  const htmlBody = getOTPEmailTemplate(otp, purpose);
  const textBody = `Your D-Box ${
    purpose === "reset" ? "password reset" : "email verification"
  } OTP is: ${otp}\n\nThis code is valid for 10 minutes.`;

  return sendEmail(toEmail, subject, htmlBody, textBody);
}

/**
 * Send invite email
 * @param {string} toEmail - Recipient email
 * @param {string} inviteLink - Full invite link
 * @param {string} invitedByName - Name of person sending invite
 */
async function sendInviteEmail(toEmail, inviteLink, invitedByName) {
  const subject = `You're invited to join D-Box by ${invitedByName}`;
  const htmlBody = getInviteEmailTemplate(inviteLink, invitedByName);
  const textBody = `You're invited to join D-Box!\n\nClick here to accept: ${inviteLink}`;

  return sendEmail(toEmail, subject, htmlBody, textBody);
}

/**
 * Send admin invite email
 * @param {string} toEmail - Recipient email
 * @param {string} inviteLink - Full invite link
 * @param {string} invitedByName - Name of admin sending invite
 * @param {string} role - Role being assigned (admin, manager, employee)
 */
async function sendAdminInviteEmail(toEmail, inviteLink, invitedByName, role = 'employee') {
  const subject = `Admin Invite - Join D-Box as ${role.charAt(0).toUpperCase() + role.slice(1)}`;
  const htmlBody = getAdminInviteEmailTemplate(inviteLink, invitedByName, role);
  const textBody = `You've been invited to join D-Box as a ${role}.\n\nClick here to accept: ${inviteLink}\n\nThis invite expires in 24 hours.`;

  return sendEmail(toEmail, subject, htmlBody, textBody);
}

/**
 * Get OTP email HTML template
 */
function getOTPEmailTemplate(otp, purpose = "signup") {
  const title =
    purpose === "reset" ? "Password Reset OTP" : "Email Verification OTP";
  const message =
    purpose === "reset"
      ? "Use this code to reset your password. This code is valid for 10 minutes."
      : "Use this code to verify your email address. This code is valid for 10 minutes.";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background-color: #f5f5f5; }
    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
    .email-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; color: white; }
    .email-header h1 { margin: 0; font-size: 28px; font-weight: 600; }
    .email-body { padding: 40px 30px; }
    .email-body p { margin: 15px 0; font-size: 16px; line-height: 1.6; color: #333333; }
    .otp-box { background-color: #f8f9fa; border: 2px dashed #667eea; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0; }
    .otp-code { font-size: 48px; font-weight: 700; letter-spacing: 8px; color: #667eea; font-family: 'Courier New', monospace; }
    .email-footer { background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e0e0e0; font-size: 12px; color: #999999; }
    .warning { color: #ff6b6b; font-size: 14px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>${title}</h1>
    </div>
    <div class="email-body">
      <p>Hello,</p>
      <p>${message}</p>
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
      </div>
      <p style="text-align: center; color: #666666; font-size: 14px; margin-top: 20px;">
        Code expires in <strong>10 minutes</strong>
      </p>
      <p class="warning">
        ⚠️ If you didn't request this code, please ignore this email or contact support immediately.
      </p>
    </div>
    <div class="email-footer">
      <p style="margin: 0;">© 2024 D-Box. All rights reserved.</p>
      <p style="margin: 5px 0 0 0;">Need help? Contact us at support@mydbox.local</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Get invite email HTML template
 */
function getInviteEmailTemplate(inviteLink, invitedByName) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>D-Box Invite</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background-color: #f5f5f5; }
    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
    .email-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; color: white; }
    .email-header h1 { margin: 0; font-size: 28px; font-weight: 600; }
    .email-body { padding: 40px 30px; }
    .email-body p { margin: 15px 0; font-size: 16px; line-height: 1.6; color: #333333; }
    .invite-message { background-color: #f0f4ff; border-left: 4px solid #667eea; padding: 20px; margin: 25px 0; border-radius: 4px; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 25px 0; }
    .cta-button:hover { opacity: 0.9; }
    .link-text { word-break: break-all; color: #667eea; font-size: 12px; margin-top: 15px; }
    .email-footer { background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e0e0e0; font-size: 12px; color: #999999; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>You're Invited to D-Box! 🎉</h1>
    </div>
    <div class="email-body">
      <p>Hello,</p>
      <div class="invite-message">
        <p style="margin: 0;"><strong>${invitedByName}</strong> has invited you to join D-Box, a collaborative file management platform.</p>
      </div>
      <p>Start collaborating with your team and manage your files securely in the cloud.</p>
      <div style="text-align: center;">
        <a href="${inviteLink}" class="cta-button">Accept Invite</a>
      </div>
      <p style="text-align: center; color: #666666; font-size: 14px;">
        or copy this link: <br>
        <div class="link-text">${inviteLink}</div>
      </p>
      <p style="margin-top: 30px; color: #999999; font-size: 13px;">
        This invite link will expire in 7 days.
      </p>
    </div>
    <div class="email-footer">
      <p style="margin: 0;">© 2024 D-Box. All rights reserved.</p>
      <p style="margin: 5px 0 0 0;">Questions? Reply to this email or visit support@mydbox.local</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Get admin invite email HTML template
 * Professional template for admin user invitations
 */
function getAdminInviteEmailTemplate(inviteLink, invitedByName, role = 'employee') {
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const roleDescription = {
    'admin': 'You will have full administrative access to the system.',
    'manager': 'You will have manager-level access and can manage team members.',
    'employee': 'You will have employee-level access to collaborate with your team.'
  };

  const description = roleDescription[role] || roleDescription.employee;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>D-Box Admin Invite</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background-color: #f5f5f5; }
    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.15); overflow: hidden; }
    .email-header { background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); padding: 50px 20px; text-align: center; color: white; }
    .email-header h1 { margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px; }
    .email-subheader { font-size: 16px; margin-top: 10px; opacity: 0.9; }
    .email-body { padding: 40px 30px; }
    .email-body p { margin: 15px 0; font-size: 15px; line-height: 1.8; color: #444444; }
    .role-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; margin: 25px 0; border-radius: 8px; text-align: center; }
    .role-label { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9; }
    .role-name { font-size: 28px; font-weight: 700; margin: 10px 0; }
    .role-description { font-size: 14px; line-height: 1.6; margin-top: 15px; opacity: 0.95; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 50px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 30px 0; font-size: 16px; }
    .cta-button:hover { opacity: 0.9; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); }
    .button-container { text-align: center; }
    .link-container { background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 6px; border: 1px solid #e0e0e0; }
    .link-label { font-size: 12px; color: #999999; margin-bottom: 8px; font-weight: 600; }
    .link-text { word-break: break-all; color: #667eea; font-size: 12px; font-family: 'Courier New', monospace; }
    .expiry-notice { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; color: #856404; font-size: 13px; }
    .important-note { background-color: #f8d7da; border-left: 4px solid #f5c6cb; padding: 15px; margin: 20px 0; border-radius: 4px; color: #721c24; font-size: 13px; }
    .email-footer { background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e0e0e0; font-size: 12px; color: #999999; }
    .footer-links { margin: 10px 0; }
    .footer-links a { color: #667eea; text-decoration: none; margin: 0 10px; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>D-Box Admin Invite</h1>
      <div class="email-subheader">You've been invited to join our team</div>
    </div>
    <div class="email-body">
      <p>Hello,</p>
      <p><strong>${invitedByName}</strong> has invited you to join D-Box as a team member.</p>
      
      <div class="role-box">
        <div class="role-label">Your Role</div>
        <div class="role-name">${roleLabel}</div>
        <div class="role-description">${description}</div>
      </div>

      <p style="margin: 30px 0;">Accept your invite and create your account to get started:</p>

      <div class="button-container">
        <a href="${inviteLink}" class="cta-button">Accept Invite & Create Account</a>
      </div>

      <div class="link-container">
        <div class="link-label">Or copy this link if the button doesn't work:</div>
        <div class="link-text">${inviteLink}</div>
      </div>

      <div class="expiry-notice">
        ⏰ <strong>Important:</strong> This invite link will expire in <strong>24 hours</strong>. Please accept it before it expires.
      </div>

      <div class="important-note">
        🔐 <strong>Security Note:</strong> Never share this link with anyone else. It's unique to your email address and can only be used once.
      </div>

      <p style="margin-top: 30px; color: #666666; font-size: 14px;">
        If you didn't expect this invite, please contact ${invitedByName} or our support team.
      </p>
    </div>
    <div class="email-footer">
      <p style="margin: 0; font-weight: 600;">D-Box Admin Team</p>
      <p style="margin: 5px 0 0 0;">© 2024 D-Box. All rights reserved.</p>
      <div class="footer-links">
        <a href="https://mydbox.local">Website</a>
        <a href="https://mydbox.local/support">Support</a>
        <a href="https://mydbox.local/privacy">Privacy</a>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

module.exports = {
  sendEmail,
  sendOTPEmail,
  sendInviteEmail,
  sendAdminInviteEmail,
  getOTPEmailTemplate,
  getInviteEmailTemplate,
  getAdminInviteEmailTemplate,
};
