# Email Setup Guide for D-Box Invitations

This guide explains how to set up email invitations for D-Box so that when admins invite users by email, they receive invitation emails.

## Prerequisites

- Node.js and npm installed
- D-Box project with updated code
- A Gmail account (or other email service)

## Setup Instructions

### Option 1: Gmail with App Password (Recommended)

Gmail doesn't allow directly using your account password for third-party apps. You need to create an "App Password" instead.

#### Step 1: Enable 2-Factor Authentication
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Click "2-Step Verification" and follow the prompts to enable it
3. You must complete this step to create an App Password

#### Step 2: Create an App Password
1. Go back to [Google Account Security](https://myaccount.google.com/security)
2. Scroll down to "App passwords" (only visible if 2FA is enabled)
3. Select "Mail" and "Windows Computer" (or your device)
4. Google will generate a 16-character password
5. Copy this password

#### Step 3: Update .env File
Open `.env` and update:
```
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
```

Replace:
- `your-email@gmail.com` with your actual Gmail address
- `xxxx xxxx xxxx xxxx` with the 16-character app password (spaces don't matter)

#### Step 4: Restart Server
```bash
npm start
# or
node server.js
```

You should see in the console: "Email service ready"

---

### Option 2: Other Email Providers

To use Outlook, Yahoo, or other providers, update the transporter in `utils/emailService.js`:

#### Outlook/Office 365:
```javascript
const transporter = nodemailer.createTransport({
  host: 'smtp-mail.outlook.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});
```

#### Yahoo:
```javascript
const transporter = nodemailer.createTransport({
  host: 'smtp.mail.yahoo.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});
```

---

## Testing Email Sending

1. Start your D-Box server:
   ```bash
   npm start
   ```

2. Open the uploads page for a group you admin

3. Click "Add User" button

4. Enter an email address that doesn't have a D-Box account

5. Click "Add User"

6. Check the email inbox - you should receive an invitation email

---

## Troubleshooting

### "Email service not configured" in logs
- Check that `EMAIL_USER` and `EMAIL_PASSWORD` are set in `.env`
- Restart the server after changing `.env`

### "Failed to send invitation email"
- If using Gmail, verify you created an App Password (not using your regular password)
- Check that 2-Factor Authentication is enabled on your Google account
- Verify the email address is correct in `.env`

### Emails still not received
- Check spam/junk folder
- Make sure the recipient email address is correct (typos?)
- Check server logs for error messages with full details

### "Looking for SCRAM-SHA-256 authentication"
- This usually means invalid credentials
- Double-check your App Password is entered correctly (copy-paste is recommended)

---

## How It Works

When an admin invites someone by email:

1. **User exists in system**: They are added directly to the group as a member

2. **User doesn't exist**: 
   - An invite record is created in the `box_invites` table (status: pending)
   - An email is sent with a link to join D-Box
   - The link includes the group ID and their email address
   - When they click the link and sign up, they're automatically added to the group

---

## Email Template

Users receive a professional HTML email with:
- A welcome message
- The name of the person who invited them
- The name of the group they're invited to
- A "Join Now" button
- A direct link to the signup page
- Information about what D-Box is

---

## Next Steps

After setup:
- Test inviting a user with a test email address
- Verify the email arrives in their inbox
- Click the join link to complete the signup process

For questions or issues, check the server console logs for detailed error messages.
