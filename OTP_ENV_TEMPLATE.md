# Brevo SMTP OTP System - Environment Setup

## Railway Environment Variables

Add these to your Railway project settings:

```
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your_brevo_login_email
SMTP_PASS=your_brevo_smtp_password_key
FROM_EMAIL=no-reply@yourdomain.com
```

## Steps to Setup

1. **Create Brevo Account**
   - Sign up at https://www.brevo.com
   - Go to SMTP & API > SMTP

2. **Get SMTP Credentials**
   - Copy your login email → `SMTP_USER`
   - Generate SMTP key → `SMTP_PASS`
   - Use Relay server: `smtp-relay.brevo.com`
   - Use port: `587`

3. **Set From Email**
   - Update `FROM_EMAIL` to a verified sender email in Brevo
   - Example: `no-reply@myapp.com`

4. **Add to Railway**
   - Go to your Railway project
   - Settings → Variables
   - Add all 5 variables above
   - Restart service

## API Endpoints

### Send OTP (Signup/Verify)
```bash
POST /api/otp/send-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "purpose": "signup"
}

Response: { "success": true, "messageId": "..." }
```

### Verify OTP
```bash
POST /api/otp/verify-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456",
  "purpose": "signup"
}

Response: { "success": true }
or
Response: { "success": false, "error": "expired|mismatch|not_found" }
```

### Forgot Password
```bash
POST /api/otp/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}

Response: { "success": true, "messageId": "..." }
```

### Send Invite
```bash
POST /api/otp/send-invite
Content-Type: application/json

{
  "email": "invitee@example.com",
  "inviterName": "Alice",
  "inviteLink": "https://yourapp.com/accept?token=abc123"
}

Response: { "success": true, "messageId": "..." }
```

## Implementation Details

- **OTP Length**: 6 digits
- **Expiry**: 10 minutes
- **Storage**: In-memory (auto-cleanup on expiry)
- **Response Format**: JSON with `success` boolean + `messageId` or `error`
- **Email Template**: HTML with styling + text fallback

## Testing Locally (Dev)

Set .env file:
```
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your_brevo_email
SMTP_PASS=your_brevo_key
FROM_EMAIL=your_sender_email
```

Then:
```bash
npm install  # if nodemailer not installed
npm run dev
```

Test endpoint:
```bash
curl -X POST http://localhost:5000/api/otp/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","purpose":"signup"}'
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Missing FROM_EMAIL" | Set `FROM_EMAIL` env variable |
| "SMTP auth failed" | Verify `SMTP_USER` and `SMTP_PASS` in Brevo |
| "Connection refused" | Check `SMTP_HOST` and `SMTP_PORT` |
| Emails not arriving | Check Brevo sender verification + spam folder |
| OTP mismatch error | Ensure OTP wasn't already verified (auto-deleted) |

## Notes

- OTP is stored in-memory and cleared after expiry or successful verification
- For multi-server deployments, switch to Redis/Database storage (ask for help)
- Rate limiting not included; add if needed for production
