# Quick Reference Guide - D-Box Admin Dashboard

Fast access to key information and commands.

## 🚀 Quick Start (5 Minutes)

### Terminal 1 - Backend
```bash
cd backend
npm install
npm run migrate
npm run dev
# Server runs on http://localhost:5000
```

### Terminal 2 - Frontend
```bash
cd frontend
npm install
npm run dev
# App opens at http://localhost:3000
```

### Login
- Email: `admin@dbox.com`
- Password: `[Your password from setup]`

---

## 📝 Important Files

| File | Purpose |
|------|---------|
| `backend/server.js` | Express app entry point |
| `backend/.env.example` | Environment variables template |
| `backend/src/db/schema.js` | Database schema |
| `frontend/src/App.jsx` | React router & protected routes |
| `frontend/src/services/api.js` | API calls |
| `frontend/vite.config.js` | API proxy config |

---

## 🔑 Environment Variables

### Backend .env
```env
PORT=5000
NODE_ENV=development
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_NAME=admin_dashboard
JWT_SECRET=your_secret_key
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
AWS_S3_BUCKET=your_bucket
```

### Frontend .env (optional)
```env
VITE_API_URL=http://localhost:5000/api
```

---

## 🗄️ Database Commands

### Setup
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE admin_dashboard;

# Create user
CREATE USER dbox_admin WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE admin_dashboard TO dbox_admin;

# Run migrations
npm run migrate
```

### Useful Queries
```sql
-- Get all users
SELECT * FROM users;

-- Get user's files
SELECT * FROM files WHERE user_id = 'user-id';

-- Get storage stats
SELECT email, storage_used, storage_limit FROM users;

-- Get activity logs
SELECT * FROM activity_logs ORDER BY created_at DESC;
```

---

## 🔌 API Endpoints (Quick Reference)

### Auth
```
POST /api/auth/login
POST /api/auth/register
POST /api/auth/logout
```

### Users
```
GET /api/admin/users
GET /api/admin/users/:id
PATCH /api/admin/users/:id/ban
PATCH /api/admin/users/:id/role
DELETE /api/admin/users/:id
```

### Files
```
GET /api/admin/files
DELETE /api/admin/files/:id
```

### Analytics
```
GET /api/admin/analytics/stats
GET /api/admin/analytics/metrics
```

### Settings
```
GET /api/admin/settings
PATCH /api/admin/settings
```

---

## 🧪 Testing Endpoints

### Login Test
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dbox.com","password":"password123"}'
```

### Get Users (with token)
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/admin/users
```

---

## 🛠️ Common Commands

### Backend
```bash
npm install          # Install dependencies
npm run migrate      # Run database migrations
npm run dev          # Start dev server (hot reload)
npm start            # Start production server
npm run seed         # Seed test data (if available)
```

### Frontend
```bash
npm install          # Install dependencies
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build
```

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Find and kill process
lsof -i :5000
kill -9 <PID>

# Or use different port
PORT=5001 npm run dev
```

### Database Connection Failed
```bash
# Check PostgreSQL status
psql -U postgres -c "SELECT version();"

# Verify .env credentials
cat backend/.env
```

### CORS Error
```
Update backend/.env:
CORS_ORIGIN=http://localhost:3000

Restart backend server
```

### Module Not Found
```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## 📊 Dashboard Features

### Pages
- **Dashboard**: Stats and charts
- **Users**: User management
- **Files**: File listing
- **Storage**: Storage analysis
- **Analytics**: Advanced analytics
- **Activity**: Audit logs
- **Settings**: Configuration

### Stats Displayed
- Total users
- Active users
- Total files
- Storage used
- Average per user
- Daily activity

---

## 🔒 Security Tips

1. **Change JWT_SECRET** in production
2. **Use strong database password**
3. **Enable HTTPS** on production
4. **Rotate AWS credentials** regularly
5. **Keep dependencies updated**: `npm update`
6. **Check for vulnerabilities**: `npm audit`
7. **Enable database backups**
8. **Monitor activity logs** regularly

---

## 📦 Build & Deploy

### Production Build
```bash
# Frontend
cd frontend
npm run build

# Creates dist/ folder
```

### Deploy to Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway up
```

### Deploy Frontend to Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd frontend
vercel --prod
```

---

## 📊 Database Backup

### Backup
```bash
pg_dump -U dbox_admin -h localhost admin_dashboard > backup.sql
```

### Restore
```bash
psql -U dbox_admin -h localhost admin_dashboard < backup.sql
```

### Compressed Backup
```bash
pg_dump -U dbox_admin admin_dashboard | gzip > backup.sql.gz
```

---

## 🎨 UI Components

### Usage Examples

```jsx
// Button
<Button variant="primary" onClick={handleClick}>Click Me</Button>

// Input
<Input label="Email" value={email} onChange={setEmail} />

// Card
<Card>Content here</Card>

// Badge
<Badge status="success">Active</Badge>

// Modal
<Modal title="Confirm" onClose={handleClose}>Content</Modal>
```

---

## 🔄 Common Workflows

### Add New User
1. Navigate to Users page
2. Use registration API
3. Change role to ADMIN (optional)

### Ban a User
1. Go to Users page
2. Find user
3. Click Ban button
4. Confirm action

### Upload File
1. User uploads via frontend
2. File stored in S3
3. Metadata stored in database
4. Listed in Files page

### View Analytics
1. Navigate to Analytics page
2. View charts and stats
3. Export data if needed

---

## 📞 Support Resources

| Resource | Location |
|----------|----------|
| Setup Guide | docs/SETUP.md |
| API Docs | docs/API.md |
| Database Docs | docs/DATABASE.md |
| Deployment Guide | docs/DEPLOYMENT.md |
| Main README | README.md |

---

## ✅ Pre-Production Checklist

- [ ] All .env variables set
- [ ] Database migrations run
- [ ] S3 bucket configured
- [ ] JWT_SECRET changed
- [ ] SSL certificate obtained
- [ ] Backups configured
- [ ] Error logging set up
- [ ] Monitoring enabled
- [ ] Team trained
- [ ] Documentation reviewed

---

## 🚀 Production Deployment Steps

```bash
# 1. Backend
cd backend
npm install --production
# Set production .env
npm run migrate

# 2. Frontend
cd frontend
npm run build

# 3. Deploy
railway up  # or vercel --prod
```

---

## 💡 Tips & Tricks

- **Search is real-time**: Start typing to filter users
- **Pagination loads 20 items**: Adjust in code if needed
- **Soft delete recoverable**: Files marked deleted_at can be recovered
- **Activity logs audit trail**: Never deleted, always searchable
- **Storage quotas enforceable**: Configured per user
- **Role-based UI**: Only SUPER_ADMIN sees admin pages

---

## 🔗 Quick Links

- GitHub: `https://github.com/yourusername/admin-dashboard`
- Railway: `https://railway.app`
- Vercel: `https://vercel.com`
- PostgreSQL: `https://www.postgresql.org`
- AWS S3: `https://aws.amazon.com/s3`
- React Docs: `https://react.dev`
- Express Docs: `https://expressjs.com`

---

## 📝 File Naming Convention

```
Frontend:
- Pages: PascalCase.jsx (DashboardPage.jsx)
- Components: PascalCase.jsx (DataTable.jsx)
- Hooks: camelCase.js (useAsync.js)
- Services: camelCase.js (api.js)

Backend:
- Controllers: camelCase.js (userController.js)
- Routes: camelCase.js (userRoutes.js)
- Models: PascalCase.js (User.js)
- Utilities: camelCase.js (jwt.js)
```

---

## 🎯 What's Included

✅ Full backend API  
✅ Complete frontend UI  
✅ Database schema  
✅ Authentication system  
✅ Role-based access control  
✅ AWS S3 integration  
✅ Activity logging  
✅ Comprehensive documentation  
✅ Security best practices  
✅ Production-ready code  

---

## 🚀 Ready to Start?

1. Follow SETUP.md
2. Run npm install (both folders)
3. Configure .env
4. Run migrations
5. Start servers
6. Login and explore!

---

**Version**: 1.0.0  
**Last Updated**: January 2024  
**Status**: Production Ready ✅
