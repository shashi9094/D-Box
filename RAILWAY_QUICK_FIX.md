# Railway DB Connection Quick Fix ⚡

**Error:** `host: 'localhost'` in Railway logs

## Root Cause
`DATABASE_URL` environment variable is **NOT SET** in Railway dashboard.

## Fix (5 minutes)

### Step 1: Open Railway Dashboard
- Go to [railway.app](https://railway.app)
- Click your project → Web service

### Step 2: Add Environment Variable
1. Click **Settings** tab
2. Click **Environment** 
3. If PostgreSQL is attached:
   - Click **Generate** next to `DATABASE_URL`
   - Railway auto-populates the connection string
4. If not auto-populated, manually add:
   ```
   DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[database]
   ```
   (Get this from PostgreSQL service → Connect tab)

### Step 3: Redeploy
- Railway auto-redeploys when env vars change
- Wait 1-2 minutes for logs to show:
  ```
  ✅ Database connected successfully
  ```

### Step 4: Verify
Go to logs and search for:
- ❌ `host: 'localhost'` → **BAD** (means DATABASE_URL not set)
- ✅ `Server is running on port 8080` → **GOOD**

---

## If PostgreSQL Service Not Attached

1. Go to Railway dashboard → Project
2. Click **+ New** → PostgreSQL
3. Your Web service auto-discovers it
4. Click Web service → Generate DATABASE_URL
5. Redeploy

---

## Common Issues

| Error | Fix |
|-------|-----|
| `ECONNREFUSED localhost:5432` | DATABASE_URL not set (see above) |
| `Connection string is empty` | Same - set DATABASE_URL |
| PostgreSQL not found | Attach PostgreSQL service to project |

**After fix:** Login at `https://[your-app].up.railway.app/login.html` should work! ✅
