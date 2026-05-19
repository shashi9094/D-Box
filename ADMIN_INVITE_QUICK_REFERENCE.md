# 📌 Admin Invite System - Quick Reference

**Version:** 1.0.0 | **Status:** ✅ Production Ready

---

## 🚀 5-Minute Quick Start

### 1. Setup (1 min)

```bash
# Run migration
npm run migrate:admin-invites

# Restart server
npm start
```

### 2. Send Invite (API)

```bash
curl -X POST http://localhost:5000/admin/invite/send \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_ID" \
  -d '{
    "email": "user@example.com",
    "role": "manager"
  }'
```

### 3. Accept Invite (User)

User receives email → Clicks link → Creates account with password

### 4. Verify Success

```bash
curl http://localhost:5000/admin/invite/stats \
  -H "Cookie: connect.sid=YOUR_SESSION_ID"
```

---

## 📡 API Endpoints (Quick Reference)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/admin/invite/send` | POST | ✅ Admin | Send new invite |
| `/admin/invite/validate/:token` | GET | ❌ Public | Validate token |
| `/admin/invite/accept` | POST | ❌ Public | Accept & create account |
| `/admin/invite/my-invites` | GET | ✅ Admin/Manager | View sent invites |
| `/admin/invite/stats` | GET | ✅ Admin | View statistics |
| `/admin/invite/:inviteId` | DELETE | ✅ Admin | Revoke invite |
| `/admin/invite/resend/:inviteId` | POST | ✅ Admin | Resend invite |

---

## 🔑 Roles & Permissions

| Action | Admin | Manager | Employee |
|--------|-------|---------|----------|
| Send Invites | ✅ | ✅ | ❌ |
| View Stats | ✅ | ❌ | ❌ |
| Revoke Invite | ✅ | ❌ | ❌ |
| View Own Profile | ✅ | ✅ | ✅ |
| Upload Files | ✅ | ✅ | ✅ |

---

## 📋 Request/Response Templates

### Send Invite

```javascript
// Request
POST /admin/invite/send
{
  "email": "user@example.com",
  "role": "manager"  // admin, manager, or employee
}

// Success Response (201)
{
  "success": true,
  "message": "Invite sent successfully",
  "data": {
    "inviteId": 1,
    "email": "user@example.com",
    "role": "manager",
    "expiresAt": "2026-05-18T10:00:00Z",
    "inviteLink": "http://localhost:3000/admin/invite/accept?token=..."
  }
}

// Error Response (400)
{
  "success": false,
  "message": "Invalid email address"
}
```

### Validate Invite

```javascript
// Request
GET /admin/invite/validate/abc123...?email=user@example.com

// Success Response (200)
{
  "success": true,
  "message": "Invite is valid",
  "data": {
    "id": 1,
    "email": "user@example.com",
    "role": "manager",
    "invitedByName": "Admin Name",
    "expiresAt": "2026-05-18T10:00:00Z"
  }
}
```

### Accept Invite

```javascript
// Request
POST /admin/invite/accept
{
  "token": "abc123...",
  "email": "user@example.com",
  "password": "SecurePass123!",
  "fullname": "John Doe"
}

// Success Response (200)
{
  "success": true,
  "message": "Account created and invite accepted",
  "data": {
    "userId": 42,
    "email": "user@example.com",
    "fullname": "John Doe",
    "role": "manager",
    "inviteAcceptedAt": "2026-05-17T10:00:00Z"
  }
}
```

---

## 🗂️ File Structure

```
D-Box/
├── models/
│   └── AdminInviteModel.js           (Database operations)
├── controllers/
│   └── adminInviteController.js      (Business logic)
├── routes/
│   └── adminInviteRoutes.js          (API routes)
├── middlewares/
│   └── roleAuth.js                   (Role-based auth)
├── utils/
│   └── tokenUtility.js               (Token utilities)
├── services/
│   └── sesEmailService.js            (Updated with admin template)
├── scripts/
│   └── migrate-admin-invites.js      (Database migration)
├── server.js                          (Updated with routes)
├── package.json                       (Updated with migration script)
└── ADMIN_INVITE_SYSTEM_README.md     (Full documentation)
```

---

## 🔐 Database Schema

```sql
-- Main table
CREATE TABLE admin_invites (
  id SERIAL PRIMARY KEY,
  token_hash VARCHAR(255) UNIQUE,
  plain_token VARCHAR(255),
  email VARCHAR(255),
  role VARCHAR(50),  -- admin, manager, employee
  invited_by_user_id INTEGER REFERENCES users(id),
  expires_at TIMESTAMP,
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User table updates
ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'employee';
ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
```

---

## ⚙️ Configuration Checklist

- [ ] AWS SES configured (.env)
- [ ] Database migration run (`npm run migrate:admin-invites`)
- [ ] Server restarted (`npm start`)
- [ ] Frontend URL configured (FRONTEND_URL)
- [ ] Email templates tested
- [ ] HTTPS enabled (production)
- [ ] Rate limiting configured (optional)
- [ ] Backups scheduled

---

## 🧪 Testing Examples

### Test 1: Send Invite

```bash
# Using curl
curl -X POST http://localhost:5000/admin/invite/send \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_ID" \
  -d '{"email":"test@example.com","role":"manager"}'

# Expected: 201 Created with invite details
```

### Test 2: Validate Token

```bash
curl "http://localhost:5000/admin/invite/validate/YOUR_TOKEN?email=test@example.com"

# Expected: 200 OK if valid, 400 if expired/invalid
```

### Test 3: Accept Invite

```bash
curl -X POST http://localhost:5000/admin/invite/accept \
  -H "Content-Type: application/json" \
  -d '{
    "token":"YOUR_TOKEN",
    "email":"test@example.com",
    "password":"Test@Pass123",
    "fullname":"Test User"
  }'

# Expected: 200 OK with new user details
```

---

## 🐛 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| "Only admins can send invites" | Make user admin: `UPDATE users SET role='admin' WHERE id=1;` |
| Email not received | Check AWS SES verified addresses |
| Invalid token format | Token must be 64 hex characters |
| Database error | Run: `npm run migrate:admin-invites` |
| Cors error | Check FRONTEND_URL in .env |
| Token expired | 24-hour expiry from creation time |

---

## 📊 Key Features Summary

✅ **24-hour invite expiry**
✅ **Single-use tokens**
✅ **Bcrypt hashing**
✅ **Role-based access**
✅ **AWS SES integration**
✅ **Professional email templates**
✅ **Admin analytics**
✅ **Resend capability**
✅ **Revoke functionality**
✅ **Production-ready security**

---

## 📞 Support

**Documentation:** `ADMIN_INVITE_SYSTEM_README.md`
**Database Help:** Check PostgreSQL logs
**Email Issues:** Verify AWS SES configuration
**API Issues:** Check browser console & server logs

---

## 🎯 Common Workflows

### Workflow 1: Add New Manager

```bash
# 1. Send invite
POST /admin/invite/send
{ "email": "manager@example.com", "role": "manager" }

# 2. Manager receives email
# 3. Manager clicks link and creates account
# 4. Manager is added as manager role
# 5. Manager can now send invites to employees
```

### Workflow 2: Resend Expired Invite

```bash
# 1. Get invites list
GET /admin/invite/my-invites?filter=pending

# 2. Find expired invite ID
# 3. Resend with new token
POST /admin/invite/resend/:inviteId

# 4. User receives new email with updated link
```

### Workflow 3: Revoke Unused Invite

```bash
# 1. Get pending invites
GET /admin/invite/my-invites?filter=pending

# 2. Find invite to revoke
# 3. Delete it
DELETE /admin/invite/:inviteId

# 4. Original link no longer works
```

---

**Last Updated:** May 17, 2026
**Version:** 1.0.0
**Status:** ✅ Production Ready
