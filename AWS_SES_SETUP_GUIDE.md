# AWS SES Email Migration - Setup Guide

Complete setup guide for migrating from Brevo/SMTP to AWS SES with OTP verification and invite system.

## Prerequisites

- AWS account with SES access
- Node.js >= 20
- MySQL or PostgreSQL database
- Terminal/Command line access

---

## Step 1: AWS SES Setup

### 1.1 Verify Email in AWS SES

1. Go to AWS Console → Simple Email Service (SES)
2. Select your region (e.g., us-east-1)
3. Go to "Email Addresses" or "Identities"
4. Click "Verify New Email Address"
5. Enter your from email (e.g., no-reply@mydbox.co.in)
6. Check your email and click verification link
7. Email will show "verified" status

### 1.2 Get AWS Credentials

1. Go to AWS Console → IAM
2. Click "Users" → Create new user or select existing
3. Go to "Security Credentials" tab
4. Click "Create access key"
5. Choose "Application running on AWS compute service" or "Local application"
6. Download CSV with credentials
7. Store safely - these are sensitive!

### 1.3 Create IAM Policy for SES (Optional but Recommended)

Instead of using root AWS credentials, create a specific policy for SES:

1. Go to IAM → Policies → Create Policy
2. Use JSON editor and paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "ses:SendEmail",
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": "ses:SendRawEmail",
      "Resource": "*"
    }
  ]
}
```

3. Name it "D-Box-SES-Policy"
4. Attach to your user

---

## Step 2: Environment Configuration

### 2.1 Update .env file

```bash
# AWS SES Configuration
AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY_HERE
AWS_SECRET_ACCESS_KEY=YOUR_SECRET_KEY_HERE
AWS_REGION=us-east-1
AWS_SES_FROM_EMAIL=noreply@yourdomain.com

# Frontend URL for invite links
FRONTEND_URL=http://localhost:3000
# or production:
FRONTEND_URL=https://yourdomain.com

# OTP Configuration
OTP_MAX_ATTEMPTS=5
OTP_RESEND_COOLDOWN_MS=30000
```

### 2.2 Verify Environment Setup

```bash
node -e "
const vars = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY', 
  'AWS_REGION',
  'AWS_SES_FROM_EMAIL',
  'FRONTEND_URL'
];
const missing = vars.filter(v => !process.env[v]);
if (missing.length) {
  console.log('❌ Missing:', missing);
  process.exit(1);
} else {
  console.log('✅ All AWS SES variables configured');
}
"
```

---

## Step 3: Database Migration

### 3.1 Run Migration Script

```bash
# Run the migration
npm run migrate:otp-invite

# Expected output:
# Starting database migration for OTP and Invite tables...
# Creating otps table...
# ✓ otps table created successfully
# Creating invites table...
# ✓ invites table created successfully
# Altering users table...
# ✓ users table altered successfully
# ✅ Database migration completed successfully!
```

### 3.2 Verify Tables Created

```bash
# For MySQL
mysql -u root -p yourdb -e "SHOW TABLES;"

# For PostgreSQL
psql -U postgres -d yourdb -c "\dt"
```

Look for: `otps`, `invites`, and `users` table should have new columns.

---

## Step 4: Cleanup Old Email Services

### 4.1 Remove Old Email Utility Files

The following files are NO LONGER NEEDED and can be deleted:

```bash
# Old Brevo service
rm -f services/brevoEmail.js

# Old SMTP mailer
rm -f utils/mailer.js

# Old OTP routes (replaced with new ones)
rm -f routes/otpRoutes.js
rm -f routes/passwordResetRoutes.js

# Old OTP store
rm -f utils/otpStore.js
```

### 4.2 Remove Old npm Packages

```bash
# Remove nodemailer (no longer needed)
npm remove nodemailer

# Remove any Brevo packages if present
npm remove brevo
```

### 4.3 Clean package-lock.json

```bash
# This regenerates lock file
npm install
```

---

## Step 5: Update Controllers

The main auth controller (`authController.js`) still handles login/signup logic. The new email verification is handled by:

- `controllers/emailVerificationController.js` - OTP verification
- `controllers/inviteController.js` - Invite management

These are automatically registered in `server.js`.

---

## Step 6: Test the Integration

### 6.1 Test Sending OTP

```bash
curl -X POST http://localhost:5000/api/auth/send-verification-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "your-test-email@example.com"}'
```

Expected response:
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "email": "your-test-email@example.com",
  "expiresIn": 600
}
```

Check your email inbox - you should receive an OTP email!

### 6.2 Test OTP Verification

```bash
# Replace 123456 with actual OTP from email
curl -X POST http://localhost:5000/api/auth/verify-email-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "your-test-email@example.com", "otp": "123456"}'
```

### 6.3 Test Forgot Password Flow

```bash
# Step 1: Request OTP
curl -X POST http://localhost:5000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "existing@example.com"}'

# Step 2: Verify OTP (get resetToken from response)
curl -X POST http://localhost:5000/api/auth/verify-forgot-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "existing@example.com", "otp": "123456"}'

# Step 3: Reset password
curl -X POST http://localhost:5000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "existing@example.com",
    "resetToken": "returned-from-step-2",
    "newPassword": "NewPass123!",
    "confirmPassword": "NewPass123!"
  }'
```

---

## Step 7: Deploy to Production

### 7.1 AWS SES Production Access

By default, AWS SES is in sandbox mode (limited to 1 email/sec, verified addresses only).

To send to any email:

1. Go to AWS SES → Account Dashboard
2. Click "Request production access"
3. Fill form with your use case
4. AWS will review (usually 24 hours)
5. Once approved, you can send to any email

### 7.2 Production Deployment Checklist

- [ ] AWS credentials stored in secure environment variables
- [ ] From email verified in AWS SES
- [ ] Production AWS SES sandbox limits lifted
- [ ] HTTPS enabled on frontend URL
- [ ] Database backup taken
- [ ] Migration script executed successfully
- [ ] Test email flows in production
- [ ] Error logs monitored
- [ ] Rate limiting configured appropriately
- [ ] Old email service files deleted

### 7.3 Update Production .env

```bash
AWS_ACCESS_KEY_ID=prod_access_key
AWS_SECRET_ACCESS_KEY=prod_secret_key
AWS_REGION=us-east-1
AWS_SES_FROM_EMAIL=noreply@yourdomain.com
FRONTEND_URL=https://yourdomain.com
NODE_ENV=production
```

---

## Step 8: Monitoring & Maintenance

### 8.1 Monitor AWS SES

1. AWS Console → SES → Dashboard
2. Check:
   - Send rate
   - Bounce rate
   - Complaint rate
   - Bounce/complaint ratio (must stay < 5%)

### 8.2 Regular Cleanup

Add these to your cron jobs:

```bash
# Every hour: Clean up expired OTPs
0 * * * * node -e "require('./models/OTPModel').cleanupExpiredOTPs()"

# Every 6 hours: Clean up expired invites
0 */6 * * * node -e "require('./models/InviteModel').cleanupExpiredInvites()"
```

### 8.3 Monitor Email Delivery

```bash
# Check CloudWatch logs in AWS Console
# or query SES API for bounce/complaint reports
```

---

## Troubleshooting

### Problem: "AWS SES configuration not found"

**Solution:**
- Check .env file has all AWS variables
- Verify credentials are correct
- Ensure AWS access key is valid (not revoked)

### Problem: "Email send failed: User not verified"

**Solution:**
- Go to AWS SES console
- Verify the from email address (noreply@yourdomain.com)
- AWS sends verification email - click the link
- Wait 5 minutes, then test again

### Problem: "Rate limit exceeded on OTP resend"

**Solution:**
- This is expected behavior (prevents spam)
- Wait 30 seconds before resending
- Adjust `OTP_RESEND_COOLDOWN_MS` in .env if needed

### Problem: "OTP expires too quickly"

**Solution:**
- Check `OTP_MAX_ATTEMPTS` setting in .env
- OTP expires after 10 minutes (hardcoded - change in OTPModel.js if needed)

### Problem: "Invite link not working"

**Solution:**
- Check `FRONTEND_URL` matches your domain
- Ensure invite hasn't expired (7 days)
- Database connection working properly

---

## File Structure

```
D-Box/
├── services/
│   ├── sesEmailService.js          ← New! AWS SES email service
│   └── brevoEmail.js               ← DELETE
├── models/
│   ├── OTPModel.js                 ← New! OTP management
│   ├── InviteModel.js              ← New! Invite management
│   └── users.js                    ← Updated with new columns
├── controllers/
│   ├── emailVerificationController.js  ← New! OTP verification
│   ├── inviteController.js             ← New! Invite handling
│   └── authController.js           ← Existing auth logic
├── routes/
│   ├── emailVerificationRoutes.js   ← New! Email verification routes
│   ├── inviteRoutes.js              ← New! Invite routes
│   ├── authRoutes.js                ← Existing auth routes
│   ├── otpRoutes.js                 ← DELETE
│   └── passwordResetRoutes.js       ← DELETE
├── scripts/
│   ├── migrate-otp-invite-tables.js ← New! Database migration
│   └── ...other scripts
├── .env.example                     ← Updated with AWS SES vars
├── server.js                        ← Updated with new routes
├── package.json                     ← Updated, nodemailer removed
└── AWS_SES_EMAIL_API.md            ← This API documentation
```

---

## Quick Start Checklist

- [ ] 1. AWS SES email verified
- [ ] 2. AWS credentials obtained
- [ ] 3. .env configured with AWS vars
- [ ] 4. Database migration run (`npm run migrate:otp-invite`)
- [ ] 5. Old email services deleted
- [ ] 6. `npm install` to update packages
- [ ] 7. Test OTP flow
- [ ] 8. Test password reset flow
- [ ] 9. Test invite system
- [ ] 10. Deploy to production

---

## Next Steps

After successful migration:

1. **Frontend Integration:**
   - Add signup form with OTP verification
   - Add forgot password page with OTP
   - Add invite acceptance page

2. **Testing:**
   - Write tests for OTP validation
   - Test edge cases (expired OTP, max attempts)
   - Load test AWS SES

3. **Monitoring:**
   - Set up CloudWatch alerts
   - Monitor OTP success rate
   - Track email delivery metrics

4. **Documentation:**
   - Create user guides for password reset
   - Document invite process for users
   - Add troubleshooting FAQ

---

## Support

For issues or questions:

1. Check AWS SES CloudWatch logs
2. Review error responses in API logs
3. Verify database tables exist: `SHOW TABLES;`
4. Check environment variables: `echo $AWS_SES_FROM_EMAIL`

---

## Version Info

- **Implementation Date:** May 2024
- **AWS SDK Version:** @aws-sdk/client-ses ^3.1042.0
- **Node Version:** >= 20
- **Database:** MySQL 5.7+ / PostgreSQL 12+
