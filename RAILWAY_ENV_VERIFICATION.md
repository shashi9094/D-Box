# Railway Environment Verification Checklist

Quick 2-minute check to debug email sending failures on Railway.

## Step 1: Verify EMAIL_USER and EMAIL_PASSWORD (30 seconds)

Open Railway Dashboard → Variables tab for the web service:

- [ ] `EMAIL_USER` set to your Gmail: `shashikumarsingh9094@gmail.com`
- [ ] `EMAIL_PASSWORD` is a 16-character app password (NOT your main Gmail password)
  - No spaces, hyphens, or special chars—just the raw 16 chars
  - If unsure, regenerate: https://myaccount.google.com/apppasswords
- [ ] `RAILWAY_PUBLIC_DOMAIN` is set to `d-box-production-4d38.up.railway.app`

## Step 2: Check PUBLIC_APP_URL or RAILWAY_PUBLIC_DOMAIN (30 seconds)

One of these MUST be set:
- [ ] `PUBLIC_APP_URL=https://d-box-production-4d38.up.railway.app` (preferred), OR
- [ ] `RAILWAY_PUBLIC_DOMAIN=d-box-production-4d38.up.railway.app` (fallback)

**Never use** `localhost` or IP addresses in production.

## Step 3: Deploy/Restart After Any Env Change (15 seconds)

After updating `.env` in Railway:
- [ ] Click **"Deploy"** or **"Restart"** button in Railway dashboard
- [ ] Wait for "Running" status to confirm restart
- [ ] Do NOT immediately test; wait 10-15 seconds for service to stabilize

## Step 4: Test Email Send (1 minute)

1. Open the app at `https://d-box-production-4d38.up.railway.app/dashboard`
2. Open a Box → Click **"Add User by Email"**
3. Enter a test email: `mamtashakya627@gmail.com`
4. Click **"Add User"** button
5. Expected outcome:
   - ✅ Success: "Processed 1 invite(s). Email sent to 1 recipient"
   - ❌ Failure: "Invites were created, but 1 invitation email was not sent. Check EMAIL_USER, EMAIL_PASSWORD, and the public app URL."

## Step 5: If Failure, Check Server Logs (2 minutes)

1. Open Railway Dashboard → **Logs** tab
2. Search for the most recent log containing:
   - `Invitation email sent` (success)
   - `Failed to send invitation email` (failure with details)
3. Copy the exact error message and share

## Common Errors and Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `535 5.7.8 Username and Password not accepted` | Wrong EMAIL_PASSWORD | Regenerate app password at https://myaccount.google.com/apppasswords |
| `Invalid login for user` | Wrong EMAIL_USER or Gmail 2FA not enabled | Ensure 2FA is on, then regenerate app password |
| `Network timeout` | SMTP_HOST blocked or slow connection | Try SMTP_HOST=smtp.gmail.com, SMTP_PORT=587, SMTP_SECURE=false |
| `Email service disabled because EMAIL_USER or EMAIL_PASSWORD is missing` | Env var not set | Add both EMAIL_USER and EMAIL_PASSWORD in Railway vars |

## Checklist Completion

- [ ] All 3 env vars verified (EMAIL_USER, EMAIL_PASSWORD, RAILWAY_PUBLIC_DOMAIN)
- [ ] Service restarted after env change
- [ ] Test email sent successfully
- [ ] Logs checked and error details noted (if failed)

**If still stuck:** Paste the exact error from Railway logs → exact fix provided.
