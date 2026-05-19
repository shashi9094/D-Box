# AWS SES Email Integration - API Documentation

Complete guide for the new AWS SES-based email system with OTP verification, password reset, and invite functionality.

## Overview

This document covers:
- OTP-based email verification
- Forgot password with OTP reset
- Secure invite system
- All API endpoints with examples

---

## 1. Email Verification (Signup)

### Flow:
1. User requests OTP for email verification
2. OTP is sent via AWS SES
3. User verifies the OTP
4. Email is marked as verified
5. User proceeds with signup

### Endpoints

#### 1.1 Send Verification OTP
**POST** `/api/auth/send-verification-otp`

Send a 6-digit OTP to verify email during signup.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (Success 200):**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "email": "user@example.com",
  "expiresIn": 600
}
```

**Response (Error 400):**
```json
{
  "success": false,
  "message": "Valid email address is required"
}
```

**Response (Error 409):**
```json
{
  "success": false,
  "message": "Email already registered"
}
```

**Response (Error 429 - Rate Limit):**
```json
{
  "success": false,
  "message": "Please wait 25 seconds before resending OTP",
  "retryAfter": 25
}
```

---

#### 1.2 Verify Email OTP
**POST** `/api/auth/verify-email-otp`

Verify the 6-digit OTP sent to email.

**Request Body:**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Response (Success 200):**
```json
{
  "success": true,
  "message": "Email verified successfully",
  "email": "user@example.com"
}
```

**Response (Error 400 - Invalid OTP):**
```json
{
  "success": false,
  "message": "Invalid OTP",
  "remainingAttempts": 3
}
```

**Response (Error 400 - Expired):**
```json
{
  "success": false,
  "message": "OTP has expired"
}
```

**Response (Error 400 - Max Attempts):**
```json
{
  "success": false,
  "message": "Maximum OTP attempts exceeded. Please request a new OTP."
}
```

---

#### 1.3 Resend Verification OTP
**POST** `/api/auth/resend-verification-otp`

Resend OTP if the first one expired or user didn't receive it.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (Success 200):**
```json
{
  "success": true,
  "message": "OTP resent successfully",
  "email": "user@example.com",
  "expiresIn": 600
}
```

---

## 2. Password Reset (Forgot Password)

### Flow:
1. User requests password reset OTP
2. OTP is sent via AWS SES
3. User verifies OTP (gets reset token)
4. User submits new password with reset token
5. Password is updated

### Endpoints

#### 2.1 Send Forgot Password OTP
**POST** `/api/auth/forgot-password`

Send OTP to reset password.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (Success 200):**
```json
{
  "success": true,
  "message": "OTP sent to your email",
  "email": "user@example.com",
  "expiresIn": 600
}
```

**Note:** Even if email doesn't exist, returns success (security measure).

---

#### 2.2 Verify Forgot Password OTP
**POST** `/api/auth/verify-forgot-otp`

Verify OTP and get reset token for password change.

**Request Body:**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Response (Success 200):**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "resetToken": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "expiresIn": 900
}
```

**Notes:**
- `resetToken` is valid for 15 minutes
- Use this token in the next step to reset password
- Send plain resetToken (not hashed)

---

#### 2.3 Reset Password
**POST** `/api/auth/reset-password`

Update password using reset token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "resetToken": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "newPassword": "NewSecurePassword123!",
  "confirmPassword": "NewSecurePassword123!"
}
```

**Response (Success 200):**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

**Response (Error 400):**
```json
{
  "success": false,
  "message": "Invalid or expired reset token"
}
```

---

## 3. Invite System

### Flow:
1. Authenticated user sends invite to email
2. Invite link sent via AWS SES
3. Recipient clicks link (public page)
4. Recipient accepts and signs up (if new user)
5. Recipient joins box (if boxId provided)

### Endpoints

#### 3.1 Send Invite
**POST** `/api/invite/send`

Send invite to email address (requires authentication).

**Request Headers:**
```
Cookie: connect.sid=session_cookie_here
```

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "boxId": 123
}
```

**Response (Success 201):**
```json
{
  "success": true,
  "message": "Invite sent successfully",
  "invite": {
    "id": 1,
    "token": "abc123def456ghi789jkl012mno345pqr678stu901vwx234yz",
    "email": "newuser@example.com",
    "expiresAt": "2024-05-24T12:00:00Z"
  }
}
```

**Response (Error 400):**
```json
{
  "success": false,
  "message": "This email already has a pending invite for this box"
}
```

---

#### 3.2 Get Invite Details
**GET** `/api/invite/:token`

Get invite details before accepting (public endpoint).

**URL:** `/api/invite/abc123def456ghi789jkl012mno345pqr678stu901vwx234yz`

**Response (Success 200):**
```json
{
  "success": true,
  "invite": {
    "email": "newuser@example.com",
    "invitedByName": "John Doe",
    "boxName": "Project Docs",
    "expiresAt": "2024-05-24T12:00:00Z"
  }
}
```

---

#### 3.3 Accept Invite
**POST** `/api/invite/accept`

Accept invite and create account or join box.

**Request Body (For New User):**
```json
{
  "token": "abc123def456ghi789jkl012mno345pqr678stu901vwx234yz",
  "email": "newuser@example.com",
  "fullname": "John Smith",
  "password": "SecurePassword123!"
}
```

**Request Body (For Existing User):**
```json
{
  "token": "abc123def456ghi789jkl012mno345pqr678stu901vwx234yz",
  "email": "existing@example.com"
}
```

**Response (Success 200):**
```json
{
  "success": true,
  "message": "Invite accepted successfully",
  "userId": 123,
  "boxId": 456
}
```

**Response (Error 400):**
```json
{
  "success": false,
  "message": "Invite not found, expired, or already used"
}
```

---

#### 3.4 Get Pending Invites
**GET** `/api/invite/list/pending`

Get all pending invites for authenticated user.

**Request Headers:**
```
Cookie: connect.sid=session_cookie_here
```

**Response (Success 200):**
```json
{
  "success": true,
  "invites": [
    {
      "id": 1,
      "token": "abc123...",
      "invited_email": "user@example.com",
      "box_id": 123,
      "expires_at": "2024-05-24T12:00:00Z",
      "status": "pending",
      "created_at": "2024-05-17T12:00:00Z",
      "invited_by_name": "John Doe",
      "box_name": "Project Docs"
    }
  ],
  "count": 1
}
```

---

## Complete Signup Flow Example

### Step 1: Request OTP
```bash
curl -X POST http://localhost:5000/api/auth/send-verification-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "newuser@example.com"}'
```

### Step 2: Verify OTP (User receives OTP in email)
```bash
curl -X POST http://localhost:5000/api/auth/verify-email-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "newuser@example.com", "otp": "123456"}'
```

### Step 3: Create Account (with email verified)
```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "fullname": "John Doe",
    "email": "newuser@example.com",
    "password": "SecurePass123!",
    "dob": "1990-01-15",
    "country": "India",
    "purpose": "Work"
  }'
```

---

## Complete Password Reset Flow Example

### Step 1: Request Password Reset
```bash
curl -X POST http://localhost:5000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

### Step 2: Verify OTP (User receives OTP in email)
```bash
curl -X POST http://localhost:5000/api/auth/verify-forgot-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "otp": "123456"}'
```

### Step 3: Reset Password
```bash
curl -X POST http://localhost:5000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "resetToken": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "newPassword": "NewPassword123!",
    "confirmPassword": "NewPassword123!"
  }'
```

---

## Complete Invite Flow Example

### Step 1: Send Invite (Authenticated)
```bash
curl -X POST http://localhost:5000/api/invite/send \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=your_session_cookie" \
  -d '{
    "email": "newuser@example.com",
    "boxId": 123
  }'
```

### Step 2: Get Invite Details (User clicks email link)
```bash
curl -X GET http://localhost:5000/api/invite/abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
```

### Step 3: Accept Invite (New User)
```bash
curl -X POST http://localhost:5000/api/invite/accept \
  -H "Content-Type: application/json" \
  -d '{
    "token": "abc123def456ghi789jkl012mno345pqr678stu901vwx234yz",
    "email": "newuser@example.com",
    "fullname": "John Smith",
    "password": "SecurePassword123!"
  }'
```

---

## Database Schema

### OTP Table
```sql
CREATE TABLE otps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  otp_hash VARCHAR(255) NOT NULL,
  purpose VARCHAR(50) DEFAULT 'verification',
  expires_at DATETIME NOT NULL,
  attempts INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_purpose (purpose),
  INDEX idx_expires_at (expires_at)
);
```

### Invite Table
```sql
CREATE TABLE invites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  token VARCHAR(64) NOT NULL UNIQUE,
  invited_email VARCHAR(255) NOT NULL,
  invited_by_user_id INT NOT NULL,
  box_id INT,
  expires_at DATETIME NOT NULL,
  status ENUM('pending', 'accepted', 'expired', 'rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_token (token),
  INDEX idx_email (invited_email),
  INDEX idx_status (status),
  INDEX idx_expires_at (expires_at),
  FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (box_id) REFERENCES boxes(id) ON DELETE SET NULL
);
```

### Users Table Additions
```sql
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS reset_token_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS reset_token_expiry DATETIME,
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
```

---

## Security Features

✅ **OTP Security:**
- 6-digit secure random OTPs
- OTPs hashed with bcrypt before storage
- 10-minute expiry time
- 5 maximum verification attempts
- Automatic cleanup of expired OTPs

✅ **Password Security:**
- 8-character minimum length requirement
- Passwords hashed with bcrypt
- Reset tokens expire after 15 minutes
- One-time use reset tokens

✅ **Invite Security:**
- 32-byte secure random tokens
- 7-day expiry on invites
- Unique invite per email per box
- Token validation before acceptance

✅ **Rate Limiting:**
- 30-second cooldown between OTP resends
- 5 OTP verification attempts before lockout

---

## Error Codes

| Code | Message | Action |
|------|---------|--------|
| 400 | Invalid email address | Check email format |
| 400 | OTP must be 6-digit | Enter 6 digits |
| 400 | Invalid OTP | Check entered OTP |
| 400 | OTP has expired | Request new OTP |
| 400 | Maximum attempts exceeded | Request new OTP |
| 400 | Password must be 8+ characters | Use longer password |
| 400 | Passwords do not match | Confirm password match |
| 400 | Invalid or expired reset token | Restart password reset |
| 400 | Invite not found or expired | Ask sender for new invite |
| 400 | Email does not match invite | Use invited email |
| 401 | Authentication required | Login first |
| 403 | Access denied | Check permissions |
| 409 | Email already registered | Use different email |
| 429 | Rate limit exceeded | Wait before retrying |
| 500 | Server error | Contact support |

---

## Environment Variables

Required for AWS SES:
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `AWS_REGION` - AWS region (e.g., us-east-1)
- `AWS_SES_FROM_EMAIL` - From email address (must be verified in SES)
- `FRONTEND_URL` - Frontend URL for invite links

---

## Notes

- All email addresses are case-insensitive
- OTPs are valid for exactly 10 minutes
- Invites are valid for exactly 7 days
- Password reset tokens are valid for 15 minutes
- All timestamps are in UTC/ISO format
- Emails are sent asynchronously via AWS SES
