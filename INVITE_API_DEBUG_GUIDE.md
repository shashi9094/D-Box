# Invite API Response Debug Guide

When "Add User" fails in the UI, use this guide to inspect the exact failure reason.

## Where to Find the API Response

### Method 1: Browser DevTools (Fastest)

1. Open the D-Box app in browser
2. Press **F12** to open DevTools → **Network** tab
3. Click **"Add User by Email"** button
4. Type email: `mamtashakya627@gmail.com`
5. Click **"Add User"** → Watch the Network tab
6. Find the POST request to `/api/boxes/:boxId/invite` (or similar)
7. Click that request → **Response** tab
8. Copy the entire JSON response

### Method 2: cURL Command (For Testing Locally)

```bash
curl -X POST "http://localhost:8080/api/boxes/1/invite" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "emails": "test@example.com"
  }'
```

Replace `<your-jwt-token>` with your session token from cookie inspection.

### Method 3: Railway Logs

1. Railway Dashboard → **Logs** tab
2. Search for: `Invites were created, but`
3. Look for lines with `Invitation email not sent to` or `Failed to send invitation email`

## Success Response Example

```json
{
  "success": true,
  "invitedCount": 1,
  "emailQueuedCount": 1,
  "emailFailedCount": 0,
  "skippedSelfCount": 0,
  "missingEmails": [],
  "inviteLinks": [
    {
      "email": "mamtashakya627@gmail.com",
      "url": "https://d-box-production-4d38.up.railway.app/login.html?invite=1&email=mamtashakya627%40gmail.com&token=abc123...",
      "token": "abc123..."
    }
  ],
  "message": "Processed 1 invite(s). Email sent to 1 recipient"
}
```

**Action:** Check that email inbox for invite link.

---

## Failure Response Example (NEW DETAILED FORMAT)

```json
{
  "success": false,
  "invitedCount": 1,
  "emailQueuedCount": 1,
  "emailFailedCount": 1,
  "emailFailures": [
    {
      "email": "mamtashakya627@gmail.com",
      "reason": "535 5.7.8 Username and Password not accepted"
    }
  ],
  "skippedSelfCount": 0,
  "missingEmails": [],
  "inviteLinks": [
    {
      "email": "mamtashakya627@gmail.com",
      "url": "https://d-box-production-4d38.up.railway.app/login.html?invite=1&email=mamtashakya627%40gmail.com&token=abc123...",
      "token": "abc123..."
    }
  ],
  "message": "Invites were created, but 1 invitation email was not sent. Check EMAIL_USER, EMAIL_PASSWORD, and the public app URL."
}
```

**Important:** 
- `emailFailures` array shows **exact reason per email** (NEW in latest code)
- `inviteLinks` still created; invite is in DB but NOT emailed to recipient
- Fix the reason in `emailFailures[0].reason`, update Railway vars, restart, and retry

---

## Failure Reason Mapping

| Reason | Action |
|--------|--------|
| `535 5.7.8 Username and Password not accepted` | Regenerate Gmail app password at https://myaccount.google.com/apppasswords |
| `Invalid login for user` | Gmail 2FA not enabled; enable 2FA first |
| `Email service is disabled` | `EMAIL_USER` or `EMAIL_PASSWORD` missing in .env |
| `ECONNREFUSED` or `Network timeout` | Check SMTP host/port settings; try smtp.gmail.com:465 |
| `535 5.7.45 Please log in with your app password` | Using main Gmail password instead of app password |
| `550 5.1.1 The email account that you tried to reach does not exist` | `EMAIL_USER` is invalid or mistyped |

---

## If Email is in Failure List but Can't Find Reason

1. Server logs often have more detail. Check Railway Logs with search:
   - `Failed to send invitation email to mamtashakya627@gmail.com`
   - `Invitation email sent to` (for successes)

2. Common hidden issues:
   - Gmail account blocked due to unusual login (check security email from Google)
   - 2FA enabled but app password not generated
   - ISP/Network blocks port 465 (try port 587)

3. Quick test outside the UI:

```bash
# From project root on local machine
node -e "
require('dotenv').config();
const { sendInvitationEmail } = require('./utils/emailService');
sendInvitationEmail(
  'mamtashakya627@gmail.com',
  'Test Box',
  'Admin',
  'https://example.com/join'
).then(r => console.log('Result:', JSON.stringify(r, null, 2)))
 .catch(e => console.error('Error:', e.message));
"
```

---

## Response Fields Explained

| Field | Type | Meaning |
|-------|------|---------|
| `success` | Boolean | Overall operation success (invites created, all emails sent) |
| `invitedCount` | Number | How many invites were created in DB |
| `emailQueuedCount` | Number | How many email send attempts were made |
| `emailFailedCount` | Number | How many email sends failed |
| `emailFailures` | Array | **NEW**: Per-email failure reason objects |
| `inviteLinks` | Array | Join URLs generated (exist even if email failed) |
| `message` | String | Human-readable summary |

---

## Next Steps

1. **If `success: true`:** Job done! Invite link was emailed.
2. **If `success: false` with emailFailures:** Use the reason to fix Railway env vars.
3. **If you see a different error:** Paste the full response above and I'll debug further.
