# Complete Setup Guide - D-Box Admin Dashboard

Step-by-step guide to set up the complete project locally.

## ⚙️ System Requirements

- **Node.js**: 16.0.0 or higher
- **npm**: 7.0.0 or higher
- **PostgreSQL**: 12 or higher
- **Git**: 2.0 or higher
- **RAM**: Minimum 2GB
- **Disk Space**: Minimum 1GB

## 🔍 Verify Prerequisites

```bash
# Check Node.js version
node --version  # Should be >= 16.0.0

# Check npm version
npm --version   # Should be >= 7.0.0

# Check PostgreSQL version
psql --version  # Should be >= 12

# Check Git version
git --version
```

## 📥 Step 1: Clone Repository

```bash
# Clone the project
git clone https://github.com/yourusername/admin-dashboard.git

# Navigate to project
cd admin-dashboard

# Verify structure
ls -la
```

Expected structure:
```
admin-dashboard/
├── backend/
├── frontend/
├── docs/
└── README.md
```

## 🔧 Step 2: Backend Setup

### 2.1 Navigate to Backend

```bash
cd backend
pwd  # Should show /path/to/admin-dashboard/backend
```

### 2.2 Install Dependencies

```bash
npm install

# Wait for installation to complete
# Should see "added X packages"
```

### 2.3 Create Environment File

```bash
# Copy example env file
cp .env.example .env

# Open and edit
nano .env  # or use your editor
```

### 2.4 Configure Environment Variables

Edit `.env`:

```env
# Server
PORT=5000
NODE_ENV=development

# Database Configuration
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_HOST=localhost
DB_PORT=5432
DB_NAME=admin_dashboard

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters_long
JWT_EXPIRY=7d

# CORS
CORS_ORIGIN=http://localhost:3000

# AWS S3 (Get from AWS Console)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name-lowercase
```

**Important**: Keep JWT_SECRET secure and unique!

### 2.5 Set Up PostgreSQL

#### Windows (PostgreSQL installed via installer)

```bash
# Open pgAdmin web interface or use psql

# In psql:
psql -U postgres

# Create database
CREATE DATABASE admin_dashboard;

# Create user
CREATE USER dbox_admin WITH PASSWORD 'your_password';

# Grant privileges
ALTER ROLE dbox_admin WITH LOGIN;
GRANT ALL PRIVILEGES ON DATABASE admin_dashboard TO dbox_admin;

# Quit psql
\q
```

#### macOS (Using Homebrew)

```bash
# Install PostgreSQL if not installed
brew install postgresql@14

# Start PostgreSQL service
brew services start postgresql@14

# Connect as default user
psql postgres

# Create database
CREATE DATABASE admin_dashboard;

# Create user
CREATE USER dbox_admin WITH PASSWORD 'your_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE admin_dashboard TO dbox_admin;

# Quit
\q
```

#### Linux (Ubuntu/Debian)

```bash
# Install PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql

# Connect
sudo -u postgres psql

# Create database
CREATE DATABASE admin_dashboard;

# Create user
CREATE USER dbox_admin WITH PASSWORD 'your_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE admin_dashboard TO dbox_admin;

# Quit
\q
```

### 2.6 Verify Database Connection

```bash
# Test connection with new user
psql -U dbox_admin -h localhost -d admin_dashboard -W

# Should connect without errors
# Type \q to exit
```

### 2.7 Run Database Migrations

```bash
# From backend directory
npm run migrate

# Should see: "✅ Database migration completed successfully!"
```

### 2.8 Create Initial Super Admin

```bash
# Connect to database
psql -U dbox_admin -h localhost -d admin_dashboard -W

# Create super admin user
-- First, get bcrypt hash of your password
-- Use this command in Node.js:
-- const hash = require('bcryptjs').hashSync('password123', 10);

INSERT INTO users (name, username, email, password, role, created_at)
VALUES (
  'Super Admin',
  'admin',
  'admin@dbox.com',
  '$2b$10$NORBszlwiN4Rnlt4OeaH0OJHK9J8s1L5K3H8Q2V9W0X1Y2Z3A4B5C',
  'SUPER_ADMIN',
  NOW()
);

# Verify user created
SELECT * FROM users;

# Exit psql
\q
```

### 2.9 Start Backend Server

```bash
# Make sure you're in backend directory
cd backend

# Start development server with auto-reload
npm run dev

# Should see:
# 🚀 Server running on http://localhost:5000
# ✅ Database connected successfully
```

### 2.10 Test Backend

Open in browser or use curl:

```bash
# Health check
curl http://localhost:5000/health

# Expected response:
# {"success":true,"message":"Server is running"}

# Test login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dbox.com","password":"password123"}'
```

## 🎨 Step 3: Frontend Setup

### 3.1 Open New Terminal & Navigate to Frontend

```bash
cd frontend
pwd  # Should show /path/to/admin-dashboard/frontend
```

### 3.2 Install Dependencies

```bash
npm install

# Wait for installation
```

### 3.3 Create Environment File (Optional)

```bash
# Create .env file if needed
cat > .env << EOF
VITE_API_URL=http://localhost:5000/api
EOF
```

### 3.4 Update Vite Config (Already Done)

Check `vite.config.js` includes:

```javascript
proxy: {
  '/api': {
    target: 'http://localhost:5000',
    changeOrigin: true,
  }
}
```

### 3.5 Start Frontend Development Server

```bash
npm run dev

# Should see:
# ➜  Local:   http://localhost:5000
# ➜  press h to show help
```

### 3.6 Access Frontend

Open browser and go to: `http://localhost:3000`

## 🧪 Step 4: Test the Application

### 4.1 Login

1. Go to `http://localhost:3000`
2. Enter credentials:
   - Email: `admin@dbox.com`
   - Password: `password123`
3. Click "Login"
4. Should be redirected to dashboard

### 4.2 Test Dashboard

- [ ] Dashboard loads
- [ ] Stats cards show data
- [ ] Charts render properly
- [ ] Navigation works

### 4.3 Test Users Page

- [ ] Users list displays
- [ ] Search functionality works
- [ ] Pagination works
- [ ] Can view user details

### 4.4 Test API

From a new terminal:

```bash
# Get all users
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/admin/users

# Get analytics
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/admin/analytics/stats
```

## 📝 Step 5: Configure AWS S3 (Optional but Recommended)

### 5.1 Create AWS Account

Go to [aws.amazon.com](https://aws.amazon.com)

### 5.2 Create S3 Bucket

```bash
# Via AWS CLI
aws s3 mb s3://dbox-storage-dev --region us-east-1
```

### 5.3 Create IAM User

1. Go to IAM console
2. Create new user: `dbox-app`
3. Attach policy: `AmazonS3FullAccess`
4. Generate access keys
5. Save keys securely

### 5.4 Update Backend .env

```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=dbox-storage-dev
```

### 5.5 Test S3 Integration

```bash
# Backend will use S3 for file storage
# Test by uploading a file through the UI
```

## 🐛 Troubleshooting

### PostgreSQL Connection Error

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql  # Linux
brew services list | grep postgres  # macOS

# Start PostgreSQL
sudo systemctl start postgresql
brew services start postgresql@14
```

### Port Already in Use

```
Error: listen EADDRINUSE: address already in use :::5000
```

**Solution:**
```bash
# Find process using port
lsof -i :5000

# Kill process
kill -9 <PID>

# Or use different port
PORT=5001 npm run dev
```

### Module Not Found

```
Error: Cannot find module 'express'
```

**Solution:**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Database Migration Failed

```
Error: relation "users" already exists
```

**Solution:**
```bash
# Drop existing database and recreate
psql -U postgres -c "DROP DATABASE admin_dashboard;"
psql -U postgres -c "CREATE DATABASE admin_dashboard;"

# Run migrations again
npm run migrate
```

### CORS Error

```
Access to XMLHttpRequest has been blocked by CORS policy
```

**Solution:**
```bash
# Update backend .env
CORS_ORIGIN=http://localhost:3000

# Restart backend server
npm run dev
```

## 🚀 Development Workflow

### Running Both Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### Making Changes

1. Edit code
2. Save file
3. Page auto-refreshes (Hot Module Replacement)
4. Test changes

### Adding New Features

1. Create API route in backend
2. Create corresponding frontend components
3. Test both together

### Debugging

**Frontend:**
- Open DevTools: F12
- Check Console tab
- Use React DevTools extension

**Backend:**
- Check terminal logs
- Add console.log statements
- Use Postman/Insomnia for API testing

## 📚 Project Structure

```
backend/
├── src/
│   ├── controllers/
│   │   ├── authController.js       # Login, register, logout
│   │   ├── userController.js       # User management
│   │   ├── fileController.js       # File management
│   │   ├── analyticsController.js  # Analytics
│   │   ├── settingsController.js   # Settings
│   │   └── activityController.js   # Activity logs
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── userRoutes.js
│   │   ├── fileRoutes.js
│   │   ├── analyticsRoutes.js
│   │   ├── settingsRoutes.js
│   │   └── activityRoutes.js
│   ├── models/
│   │   ├── User.js
│   │   ├── File.js
│   │   ├── ActivityLog.js
│   │   ├── LoginHistory.js
│   │   └── Settings.js
│   ├── middleware/
│   │   ├── auth.js                # JWT auth middleware
│   │   └── errorHandler.js
│   ├── utils/
│   │   ├── jwt.js
│   │   ├── password.js
│   │   └── s3.js
│   ├── config/
│   ├── db/
│   │   ├── connection.js
│   │   ├── schema.js
│   │   └── migrate.js
│   └── ...
├── server.js                       # Express app entry
├── package.json
├── .env.example
└── .gitignore

frontend/
├── src/
│   ├── components/
│   │   ├── UI.jsx                 # Button, Input, Card, etc.
│   │   ├── Layout.jsx             # Sidebar, Header
│   │   └── DataDisplay.jsx        # Table, Cards
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── DashboardPage.jsx
│   │   ├── UsersPage.jsx
│   │   ├── UserDetailPage.jsx
│   │   ├── FilesPage.jsx
│   │   ├── StoragePage.jsx
│   │   ├── AnalyticsPage.jsx
│   │   ├── ActivityPage.jsx
│   │   └── SettingsPage.jsx
│   ├── services/
│   │   └── api.js                 # API calls
│   ├── context/
│   │   └── authStore.js           # Zustand store
│   ├── hooks/
│   │   └── useAsync.js            # Custom hooks
│   ├── utils/
│   │   └── helpers.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── .gitignore
```

## ✅ Next Steps

1. **Familiarize yourself with codebase**
   - Read README.md
   - Explore project structure
   - Understand data models

2. **Test all features**
   - Login/logout
   - User management
   - File operations
   - Analytics

3. **Configure for your needs**
   - Customize branding
   - Update settings
   - Configure AWS S3
   - Set up email notifications

4. **Prepare for deployment**
   - Read DEPLOYMENT.md
   - Set up production database
   - Configure environment variables
   - Set up CI/CD pipeline

## 📞 Need Help?

- Check docs folder
- Review code comments
- Check GitHub issues
- Ask in discussion forums

---

**Setup Complete! 🎉**

Your admin dashboard is ready for development.

Start both servers and visit `http://localhost:3000`
