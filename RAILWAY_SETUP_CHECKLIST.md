# Railway Setup Checklist for D-Box

All errors from the deploy logs will be resolved by setting these environment variables correctly in Railway.

## Step 1: Create Railway Services

### A. PostgreSQL Database Service
1. Go to Railway dashboard → Create new project
2. Click `+ Add` → Select `PostgreSQL`
3. A PostgreSQL service will be created
4. **IMPORTANT**: Open the PostgreSQL service and go to `Connect` tab
5. Copy the `DATABASE_URL` value (it will look like: `postgresql://postgres:password@host.railway.internal:5432/railway`)
6. You'll inject this into the Web service below

### B. Web Service (Node.js App)
1. Click `+ Add` → Select `GitHub Repo` → Select your d-box repository
2. The Web service will auto-deploy when you push to GitHub

### C. Link the Services
1. Open the **Web service**
2. Go to `Connect` tab
3. Look for "PostgreSQL" service in the same project
4. Click to attach/link it
5. Railway will **automatically** set `DATABASE_URL` environment variable ✅

---

## Step 2: Set Environment Variables in Web Service

Click **Web service** → Settings (gear icon) → **Environment**

### REQUIRED - Database (auto-set if you linked PostgreSQL, but verify!)
```
DATABASE_URL=postgresql://postgres:[password]@[host].railway.internal:5432/railway
```
**Verify**: If this is missing, that's why you got `ECONNREFUSED localhost` error.

### REQUIRED - Session & Security
```
NODE_ENV=production
SESSION_SECRET=[generate-long-random-string]
JWT_SECRET=[generate-long-random-string]
```

Use this to generate secrets (run once locally):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### REQUIRED - Google OAuth
⚠️ **CRITICAL FIX**: The logs showed `clientId=GOCSPX-FN2...` which is the SECRET format!

```
GOOGLE_CLIENT_ID=[YOUR-CLIENT-ID-FROM-GOOGLE-CLOUD].apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=[YOUR-CLIENT-SECRET-FROM-GOOGLE-CLOUD]
GOOGLE_CALLBACK_URL=https://[YOUR-RAILWAY-APP-NAME].up.railway.app/api/auth/google/callback
PUBLIC_APP_URL=https://[YOUR-RAILWAY-APP-NAME].up.railway.app
```

**IMPORTANT**: 
- Replace `[YOUR-RAILWAY-APP-NAME]` with your actual Railway app name from the URL bar
- Replace `[YOUR-CLIENT-ID-FROM-GOOGLE-CLOUD]` with your actual Client ID (format: `123456789-abcdefg.apps.googleusercontent.com`)
- Replace `[YOUR-CLIENT-SECRET-FROM-GOOGLE-CLOUD]` with your actual Client Secret (starts with `GOCSPX-`)

### OPTIONAL - Email Service
To send invitation emails:
```
EMAIL_USER=[your-gmail@gmail.com]
EMAIL_PASSWORD=[your-gmail-app-password]
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_FORCE_IPV4=true
```

⚠️ **Note**: If not set, emails won't be sent but the app will still work (graceful fallback).

### OPTIONAL - Upload Storage
```
UPLOADS_ROOT=/data/uploads
```

---

## Step 3: Fix Google OAuth in Google Cloud Console

Your Google OAuth credential is currently only registered for `localhost` and `render.com`. You need to add Railway callback:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Project → D-Box Login
3. Left menu → **APIs & Services** → **Credentials**
4. Click your OAuth 2.0 ID (Client ID)
5. Under "Authorized redirect URIs", add:
   ```
   https://[YOUR-RAILWAY-APP-NAME].up.railway.app/api/auth/google/callback
   ```
6. **Save**

Now Railway callback will be accepted by Google.

---

## Step 4: Configure Upload Storage (Optional but Recommended)

1. In Railway Web service → go to **Volumes** tab
2. Click `+ Add Volume`
3. Mount point: `/data/uploads`
4. Size: 5GB (or more)
5. **Save**

This ensures uploaded files persist across redeploys.

---

## Step 5: Deploy & Verify

1. Go to your repository → commit and push all changes to `main` branch
2. Railway will auto-deploy
3. In Railway deploy logs, look for:
   ```
   ✅ Database connected successfully.
   ✅ Core tables are ready.
   Server is running on port 8080
   ```

### If you still see errors:

**Database Error (ECONNREFUSED localhost)**:
- DATABASE_URL is not set
- Fix: Go to Web service → Settings → Environment → Verify DATABASE_URL exists and has correct value

**Google OAuth disabled**:
- Visit: `https://your-app.up.railway.app/api/auth/google/status`
- Response will show exactly what's missing:
  ```json
  {
    "googleAuthEnabled": false,
    "missing": ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]
  }
  ```
- Fix: Set those env vars in Railway

**Email service error**:
- Normal if EMAIL_USER/EMAIL_PASSWORD not set
- Not critical; app will work without email

---

## Step 6: Test Login

1. Go to `https://your-app.up.railway.app/login.html`
2. Try email/password login (signup first if needed)
3. Try Google login (if enabled)
4. Check `/api/auth/google/status` to debug Google OAuth

---

## Troubleshooting

### "DB error" on login:
- Check Railway logs → look for database connection error
- Verify DATABASE_URL is set and PostgreSQL service is running
- Try: `curl https://your-app.up.railway.app/api/auth/status` to see database status

### "Google login is not configured":
- Go to `/api/auth/google/status` endpoint
- It will tell you exactly which env var is missing
- Set it in Railway environment and redeploy

### "Unable to send email":
- Not critical; app still works
- If needed: set EMAIL_USER and EMAIL_PASSWORD (Gmail app-specific password, not regular password)

---

## Quick Environment Variables Summary

| Variable | Example | Required | Notes |
|----------|---------|----------|-------|
| `DATABASE_URL` | `postgresql://...` | ✅ Yes | Auto-set if PostgreSQL attached |
| `NODE_ENV` | `production` | ✅ Yes | Must be exactly "production" |
| `SESSION_SECRET` | Random 64-char hex | ✅ Yes | Generate fresh |
| `JWT_SECRET` | Random 64-char hex | ✅ Yes | Generate fresh |
| `GOOGLE_CLIENT_ID` | `1026888...apps.googleusercontent.com` | ✅ For Google login | Long ID format, NOT the secret |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-...` | ✅ For Google login | The actual secret |
| `GOOGLE_CALLBACK_URL` | `https://app.up.railway.app/api/auth/google/callback` | ✅ For Google login | Must match Google Cloud config |
| `PUBLIC_APP_URL` | `https://app.up.railway.app` | ❌ Optional | For redirect URLs |
| `EMAIL_USER` | `your-email@gmail.com` | ❌ Optional | For sending invites |
| `EMAIL_PASSWORD` | Gmail app password | ❌ Optional | Not your regular Gmail password |
| `UPLOADS_ROOT` | `/data/uploads` | ❌ Optional | For persistent file storage |
| `PORT` | `8080` | ✅ Yes | Railway sets this automatically |

---

## Done! 🎉

Once all env vars are set correctly, the app will:
- ✅ Connect to PostgreSQL database
- ✅ Run user signup/login
- ✅ Enable Google OAuth login
- ✅ Send invitation emails (if configured)
- ✅ Store uploaded files persistently (if volume mounted)
