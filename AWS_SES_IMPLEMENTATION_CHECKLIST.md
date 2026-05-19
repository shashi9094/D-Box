# AWS SES Migration - Implementation Checklist

Complete checklist for implementing the AWS SES email migration in your D-Box application.

---

## Phase 1: AWS Setup (Complete Before Code)

- [ ] **Create AWS Account**
  - [ ] Navigate to aws.amazon.com
  - [ ] Create account with valid payment method

- [ ] **Set Up AWS SES**
  - [ ] Go to AWS Console → Simple Email Service (SES)
  - [ ] Select region (recommend: us-east-1)
  - [ ] Go to "Email Addresses" or "Identities"
  - [ ] Click "Verify New Email Address"
  - [ ] Enter your from email (e.g., noreply@yourdomain.com)
  - [ ] Verify by clicking email link
  - [ ] Email shows "verified" status ✓

- [ ] **Get AWS Credentials**
  - [ ] Go to IAM → Users
  - [ ] Select or create user
  - [ ] Go to "Security Credentials"
  - [ ] Click "Create Access Key"
  - [ ] Download CSV file (keep safe!)
  - [ ] Note: Access Key ID and Secret Access Key

- [ ] **Create IAM Policy (Optional but Recommended)**
  - [ ] Go to IAM → Policies → Create Policy
  - [ ] Select SES service
  - [ ] Add "SendEmail" and "SendRawEmail" permissions
  - [ ] Attach to your user

---

## Phase 2: Code Changes (Local Development)

- [ ] **Update Environment Variables**
  - [ ] Copy .env.example to .env
  - [ ] Add AWS_ACCESS_KEY_ID
  - [ ] Add AWS_SECRET_ACCESS_KEY
  - [ ] Add AWS_REGION (e.g., us-east-1)
  - [ ] Add AWS_SES_FROM_EMAIL
  - [ ] Add FRONTEND_URL
  - [ ] Verify all variables are set:
    ```bash
    node -e "console.log(process.env.AWS_SES_FROM_EMAIL)"
    ```

- [ ] **Install Dependencies**
  - [ ] Run: `npm install`
  - [ ] Verify @aws-sdk/client-ses is installed

- [ ] **Run Database Migration**
  - [ ] Run: `npm run migrate:otp-invite`
  - [ ] Verify output shows:
    - [ ] otps table created
    - [ ] invites table created
    - [ ] users table altered
  - [ ] Check tables exist:
    ```bash
    # For MySQL:
    mysql -u root -p yourdb -e "SHOW TABLES;"
    # Should show: otps, invites
    ```

- [ ] **Start Development Server**
  - [ ] Run: `npm start`
  - [ ] Check server starts without errors
  - [ ] Verify routes registered in console

---

## Phase 3: API Testing (Local)

- [ ] **Test OTP Verification Flow**
  - [ ] Send OTP:
    ```bash
    curl -X POST http://localhost:5000/api/auth/send-verification-otp \
      -H "Content-Type: application/json" \
      -d '{"email": "your-test-email@example.com"}'
    ```
  - [ ] Should return: `{"success": true}`
  - [ ] Check email inbox for OTP
  - [ ] Copy OTP code
  - [ ] Verify OTP:
    ```bash
    curl -X POST http://localhost:5000/api/auth/verify-email-otp \
      -H "Content-Type: application/json" \
      -d '{"email": "your-test-email@example.com", "otp": "123456"}'
    ```
  - [ ] Should return: `{"success": true, "message": "Email verified successfully"}`

- [ ] **Test Password Reset Flow**
  - [ ] Create test account first (or use existing)
  - [ ] Request password reset:
    ```bash
    curl -X POST http://localhost:5000/api/auth/forgot-password \
      -H "Content-Type: application/json" \
      -d '{"email": "test@example.com"}'
    ```
  - [ ] Check email for OTP
  - [ ] Verify OTP:
    ```bash
    curl -X POST http://localhost:5000/api/auth/verify-forgot-otp \
      -H "Content-Type: application/json" \
      -d '{"email": "test@example.com", "otp": "123456"}'
    ```
  - [ ] Get resetToken from response
  - [ ] Reset password:
    ```bash
    curl -X POST http://localhost:5000/api/auth/reset-password \
      -H "Content-Type: application/json" \
      -d '{
        "email": "test@example.com",
        "resetToken": "token-from-previous-response",
        "newPassword": "NewPass123!",
        "confirmPassword": "NewPass123!"
      }'
    ```

- [ ] **Test Invite System**
  - [ ] Login to get session cookie
  - [ ] Send invite:
    ```bash
    curl -X POST http://localhost:5000/api/invite/send \
      -H "Content-Type: application/json" \
      -H "Cookie: connect.sid=your-session-cookie" \
      -d '{"email": "newuser@example.com", "boxId": 1}'
    ```
  - [ ] Get token from response
  - [ ] Get invite details:
    ```bash
    curl -X GET "http://localhost:5000/api/invite/{token}"
    ```
  - [ ] Should show invite details
  - [ ] Accept invite:
    ```bash
    curl -X POST http://localhost:5000/api/invite/accept \
      -H "Content-Type: application/json" \
      -d '{
        "token": "{token}",
        "email": "newuser@example.com",
        "fullname": "New User",
        "password": "Password123!"
      }'
    ```

- [ ] **Use Postman Collection**
  - [ ] Import: `D-Box-AWS-SES-Email.postman_collection.json`
  - [ ] Update base_url variable
  - [ ] Run all requests in order

---

## Phase 4: Code Cleanup

- [ ] **Delete Old Email Service Files**
  - [ ] Delete: `services/brevoEmail.js`
  - [ ] Delete: `utils/mailer.js`
  - [ ] Delete: `utils/otpStore.js`
  - [ ] Delete: `routes/otpRoutes.js`
  - [ ] Delete: `routes/passwordResetRoutes.js`

- [ ] **Update Dependencies**
  - [ ] Run: `npm uninstall nodemailer`
  - [ ] Run: `npm install` (regenerate package-lock.json)

- [ ] **Verify Server Still Works**
  - [ ] Restart server: `npm start`
  - [ ] No errors in console
  - [ ] All routes still loading

---

## Phase 5: Production Preparation

- [ ] **AWS SES Production Access**
  - [ ] Go to AWS SES console
  - [ ] Click "Account Dashboard"
  - [ ] Click "Request production access"
  - [ ] Fill form with business details
  - [ ] Wait for AWS approval (usually 24 hours)
  - [ ] Once approved, can send to any email

- [ ] **Production Environment**
  - [ ] Create production .env file
  - [ ] Update FRONTEND_URL to production domain
  - [ ] Use production AWS credentials
  - [ ] Set NODE_ENV=production
  - [ ] Ensure HTTPS is enabled

- [ ] **Database Backup**
  - [ ] Backup production database before migration
  - [ ] Keep backup for rollback if needed

- [ ] **Email Verification in SES**
  - [ ] Verify production from email in SES
  - [ ] Wait for verification email
  - [ ] Click verification link

---

## Phase 6: Production Deployment

- [ ] **Deploy Code**
  - [ ] Push code to production
  - [ ] Run database migration: `npm run migrate:otp-invite`
  - [ ] Verify tables created
  - [ ] Start production server

- [ ] **Test in Production**
  - [ ] Send test OTP
  - [ ] Verify email received
  - [ ] Test password reset flow
  - [ ] Test invite system
  - [ ] Monitor logs for errors

- [ ] **Monitor Performance**
  - [ ] Check AWS SES dashboard
  - [ ] Monitor email delivery rate
  - [ ] Check bounce rate (should be < 5%)
  - [ ] Monitor application logs

---

## Phase 7: Post-Deployment

- [ ] **Set Up Monitoring**
  - [ ] CloudWatch alerts for errors
  - [ ] Email delivery metrics
  - [ ] OTP success rate tracking
  - [ ] Rate limit monitoring

- [ ] **Schedule Cleanup Tasks**
  - [ ] Hourly OTP cleanup:
    ```bash
    0 * * * * node -e "require('./models/OTPModel').cleanupExpiredOTPs()"
    ```
  - [ ] Every 6 hours invite cleanup:
    ```bash
    0 */6 * * * node -e "require('./models/InviteModel').cleanupExpiredInvites()"
    ```

- [ ] **Team Training**
  - [ ] Share QUICK_REFERENCE.md
  - [ ] Explain new API endpoints
  - [ ] Review security features
  - [ ] Document troubleshooting

- [ ] **Documentation**
  - [ ] Update internal wiki
  - [ ] Document OTP flows
  - [ ] Add troubleshooting guide
  - [ ] Create runbook for ops team

---

## Phase 8: Verification

- [ ] **Functionality Check**
  - [ ] [ ] Email verification works
  - [ ] [ ] Password reset works
  - [ ] [ ] Invite system works
  - [ ] [ ] Rate limiting works
  - [ ] [ ] Error handling works

- [ ] **Security Check**
  - [ ] [ ] OTPs are hashed
  - [ ] [ ] Tokens are secure
  - [ ] [ ] SQL injection prevented
  - [ ] [ ] Rate limiting active
  - [ ] [ ] No credentials in logs

- [ ] **Performance Check**
  - [ ] [ ] OTP generation < 10ms
  - [ ] [ ] Email send < 2 seconds
  - [ ] [ ] Database queries < 50ms
  - [ ] [ ] No memory leaks

- [ ] **Compliance Check**
  - [ ] [ ] GDPR compliant (secure storage)
  - [ ] [ ] PII handled securely
  - [ ] [ ] Logs don't contain sensitive data
  - [ ] [ ] Backups encrypted

---

## Common Issues & Resolutions

| Issue | Resolution |
|-------|-----------|
| "Email not verified" | Verify email in AWS SES console, check spam folder |
| "Invalid AWS credentials" | Check .env file, regenerate credentials |
| "Database migration failed" | Check database connection, run migration again |
| "OTP not received" | Check AWS SES sending rate, verify email address |
| "Rate limit exceeded" | Wait configured cooldown time, check rate limiter settings |

---

## Emergency Rollback

If issues occur:

```bash
# Stop production server
kill -9 $(lsof -t -i:5000)

# Restore from backup
mysql -u root -p < backup.sql

# Revert code changes
git revert HEAD

# Restart server
npm start
```

---

## Sign-Off

- [ ] **Developer**
  - Name: ________________
  - Date: ________________
  - All tests passed: ✓

- [ ] **QA**
  - Name: ________________
  - Date: ________________
  - Production ready: ✓

- [ ] **DevOps**
  - Name: ________________
  - Date: ________________
  - Monitoring active: ✓

---

## Quick Links

| Document | Purpose |
|----------|---------|
| AWS_SES_IMPLEMENTATION_README.md | Architecture & overview |
| AWS_SES_SETUP_GUIDE.md | Detailed setup steps |
| AWS_SES_EMAIL_API.md | API documentation |
| QUICK_REFERENCE.md | Quick reference guide |
| AWS_SES_MIGRATION_SUMMARY.md | What changed |

---

**Checklist Version:** 1.0
**Last Updated:** May 2024
**Status:** Ready for Use ✅
