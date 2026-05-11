# D-Box - Complete Technical Information

**Last Updated**: May 11, 2026  
**Project Status**: ✅ Production Ready  
**Version**: 1.0.0

---

## 📋 Executive Summary

**D-Box** is a full-stack **cloud storage SaaS platform** with a production-ready Super Admin Dashboard. It enables users to create "boxes" (shared folders), upload files, manage access, and includes comprehensive admin controls with analytics, user management, and file tracking.

### Key Statistics
- **Total Lines of Code**: ~4,500+
- **Backend Files**: 28 files
- **Frontend Files**: 24 files
- **API Endpoints**: 28+ endpoints
- **Database Tables**: 6+ tables
- **UI Components**: 15+ components
- **Deployment Ready**: ✅ Yes

---

## 🏗️ Architecture Overview

### Multi-Application Structure

```
D-Box Project
│
├── Main D-Box Application (Root directory)
│   └── File sharing, boxes, user profiles
│
└── Admin Dashboard (`/admin-dashboard`)
    └── Super admin management, analytics, user control
```

### Technology Stack

#### **Backend**
- **Runtime**: Node.js 20+ (ES Modules for main, CommonJS for admin)
- **Framework**: Express.js 5.2.1 / 4.18.2
- **Database**: PostgreSQL 12+
- **Authentication**: JWT + Passport.js + Google OAuth
- **Cloud Storage**: AWS S3
- **Email**: Nodemailer + AWS SES
- **Security**: Helmet, CORS, Rate Limiting, bcrypt

#### **Frontend** (Admin Dashboard)
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Charts**: Recharts
- **UI Components**: Lucide React
- **HTTP**: Axios
- **Notifications**: React Hot Toast

#### **Deployment Platforms**
- **Backend**: Railway or Render
- **Frontend**: Vercel or Railway
- **Database**: PostgreSQL (Railway/AWS RDS)
- **Storage**: AWS S3 (eu-north-1)
- **Email**: AWS SES

---

## 📁 Project Structure

### Root Directory Structure

```
/
├── admin-dashboard/                    # Super Admin Dashboard (React + Node)
│   ├── backend/                        # Express API
│   │   ├── server.js
│   │   └── src/
│   │       ├── controllers/            # 6 controllers
│   │       ├── routes/                 # 6 route files
│   │       ├── models/                 # 5 data models
│   │       ├── middleware/             # Auth middleware
│   │       ├── utils/                  # JWT, password, S3 utilities
│   │       ├── config/                 # Configuration
│   │       └── db/                     # Database connection & schema
│   │
│   └── frontend/                       # React dashboard UI
│       ├── src/
│       │   ├── App.jsx
│       │   └── components/             # 15+ React components
│       ├── vite.config.js
│       ├── tailwind.config.js
│       └── package.json
│
├── config/                             # Configuration files
│   ├── googleAuth.js
│   └── s3.js
│
├── controllers/                        # Business logic (Main app)
│   ├── authController.js
│   ├── boxController.js
│   ├── fileController.js
│   ├── imageController.js
│   └── ...
│
├── db/                                 # Database layer
│   └── connection.js
│
├── middleware/                         # Express middleware
│   ├── imageUpload.js
│   └── upload.js
│
├── models/                             # Data models
│   ├── boxes.js
│   ├── users.js
│   └── imageModel.js
│
├── routes/                             # API routes
│   ├── authRoutes.js
│   ├── boxRoutes.js
│   ├── fileRoutes.js
│   └── imageRoutes.js
│
├── services/                           # Business services
│   └── s3SignedUrl.js                 # Signed URL generation
│
├── utils/                              # Utility functions
│   ├── auth.js
│   ├── emailService.js
│   ├── googleOAuthConfig.js
│   ├── passwordAuth.js
│   ├── profileVerification.js
│   └── uploadPaths.js
│
├── private/                            # Protected frontend pages
│   ├── pages/
│   │   ├── createbox.html
│   │   ├── dashboard.html
│   │   ├── home.html
│   │   ├── profile.html
│   │   └── uploads.html
│   └── scripts/
│       ├── ask-admin.js
│       ├── auth-guard.js
│       ├── fileUrlService.js
│       ├── s3-upload-helper.js
│       └── uploads-view.js
│
├── Public/                             # Public frontend
│   ├── pages/
│   │   ├── index.html
│   │   ├── login.html
│   │   ├── signup.html
│   │   └── complete-profile.html
│   └── style.css
│
├── scripts/                            # Utility scripts
│   ├── backfillBoxContents.js
│   ├── cleanupStaleUploads.js
│   ├── migrateMysqlToPostgres.js
│   ├── syncBoxFilesFromContents.js
│   ├── syncUserRoles.js
│   └── sql/
│
├── uploads/                            # Local upload storage
│   └── boxes/
│
├── server.js                           # Main Express app entry
├── emailService.js                     # Email service
├── package.json                        # Dependencies
├── .env.example                        # Environment template
└── README files & Docs                 # Documentation

```

---

## 🔐 Authentication System

### Multi-Auth Strategy

#### 1. **Email/Password Authentication**
- Local user registration and login
- Bcrypt password hashing (10 salt rounds)
- Password validation with strength requirements

#### 2. **Google OAuth 2.0**
- Integration via Passport.js
- Automatic user creation on first login
- Profile completion workflow for OAuth users

#### 3. **JWT Tokens**
- Token expiry: 7 days
- Secure HTTP-only cookies in production
- Session-based authentication with PostgreSQL store

### User Roles

```
┌─────────────────────────────────────────────────────────────┐
│                      USER ROLES                             │
├─────────────────────────────────────────────────────────────┤
│ SUPER_ADMIN     │ Full system access, user management       │
│ ADMIN           │ Limited admin capabilities                │
│ USER            │ Standard user with storage limits         │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Database Schema

### Main Tables

#### 1. **users** - User accounts
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,           -- Bcrypt hash or 'google_auth'
  role VARCHAR(50) DEFAULT 'USER',          -- USER, ADMIN, SUPER_ADMIN
  is_banned BOOLEAN DEFAULT FALSE,
  storage_limit BIGINT DEFAULT 10737418240, -- 10 GB in bytes
  storage_used BIGINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  last_login TIMESTAMP,
  dob VARCHAR(255),
  country VARCHAR(255),
  capacity VARCHAR(255),
  purpose VARCHAR(255),
  isprofilecomplete BOOLEAN
);
```

**Indexes**: email, username, role

#### 2. **files** - Uploaded files with soft delete
```sql
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP                      -- NULL = not deleted (soft delete)
);
```

**Indexes**: user_id, deleted_at, uploaded_at

#### 3. **boxes** - Shared folders/collections
```sql
CREATE TABLE boxes (
  id UUID PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  capacity VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);
```

#### 4. **activity_logs** - Audit trail
```sql
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  target_user_id UUID REFERENCES users(id),
  target_file_id UUID REFERENCES files(id),
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 5. **login_history** - Session tracking
```sql
CREATE TABLE login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  ip_address VARCHAR(50),
  user_agent TEXT,
  logged_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 6. **settings** - System configuration
```sql
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 7. **session** - Express sessions (PostgreSQL store)
```sql
CREATE TABLE "session" (
  sid varchar NOT NULL COLLATE "default",
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);
CREATE UNIQUE INDEX "IDX_session_sid" on "session" ("sid" COLLATE "default");
```

---

## 🔌 Core API Endpoints

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login (email + password) |
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/logout` | Logout user |
| GET | `/auth/google` | Google OAuth redirect |
| GET | `/auth/google/callback` | Google OAuth callback |

### User Management Endpoints (Admin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/users` | List all users (pagination, search) |
| GET | `/admin/users/:id` | Get user details |
| PUT | `/admin/users/:id` | Update user |
| DELETE | `/admin/users/:id` | Delete user (with cleanup) |
| POST | `/admin/users/:id/ban` | Ban user |
| POST | `/admin/users/:id/unban` | Unban user |
| PUT | `/admin/users/:id/role` | Change user role |
| PUT | `/admin/users/:id/storage` | Set storage limit |
| POST | `/admin/users/:id/login-as` | Login as user (support) |

### File Management Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/files/upload` | Upload file to S3 |
| GET | `/api/files` | List user's files |
| GET | `/api/files/:id` | Get file details |
| GET | `/api/files/:id/signed-url` | Get temporary signed URL |
| DELETE | `/api/files/:id` | Delete file (soft delete) |
| GET | `/admin/files` | List all files (admin) |
| DELETE | `/admin/files/:id` | Delete file (admin) |

### Box Management Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/boxes` | Create new box |
| GET | `/api/boxes` | List user's boxes |
| GET | `/api/boxes/:id` | Get box details |
| PUT | `/api/boxes/:id` | Update box |
| DELETE | `/api/boxes/:id` | Delete box |
| POST | `/api/boxes/:id/members` | Add member to box |
| DELETE | `/api/boxes/:id/members/:userId` | Remove member |
| GET | `/api/boxes/:id/contents` | Get box files |

### Analytics Endpoints (Admin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/analytics/stats` | Overall statistics |
| GET | `/admin/analytics/metrics` | Detailed metrics |
| GET | `/admin/analytics/activity` | Activity trends |

### Settings Endpoints (Admin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/settings` | Get all settings |
| GET | `/admin/settings/:key` | Get specific setting |
| PUT | `/admin/settings/:key` | Update setting |

### Activity Log Endpoints (Admin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/activity` | Get activity logs (paginated) |
| GET | `/admin/activity/:userId` | Get user's activity |

---

## 📦 Key Features

### User Features
- ✅ Register with email or Google OAuth
- ✅ Complete profile (DOB, Country, Capacity, Purpose)
- ✅ Create unlimited "boxes" (shared collections)
- ✅ Upload files to S3 with progress tracking
- ✅ Share files via boxes with access control
- ✅ View upload history
- ✅ Download files via signed URLs
- ✅ Profile management
- ✅ Storage usage tracking
- ✅ Email notifications

### Admin Features
- ✅ User management (view, edit, ban, delete)
- ✅ File management (view, delete, track)
- ✅ Activity audit logging
- ✅ Login history tracking
- ✅ Analytics dashboard
- ✅ Storage management
- ✅ Role-based access control
- ✅ Login-as-user for support
- ✅ System settings management
- ✅ User search and filters

### Security Features
- ✅ JWT authentication with expiry
- ✅ Bcrypt password hashing (10 rounds)
- ✅ Session management with PostgreSQL store
- ✅ HTTPS-only cookies in production
- ✅ CORS protection
- ✅ Rate limiting
- ✅ Helmet security headers
- ✅ AWS S3 signed URLs (1-hour expiry)
- ✅ Access control per box
- ✅ Soft delete for files

### AWS S3 Integration
- ✅ File uploads to S3 bucket
- ✅ Signed URL generation (presigned URLs)
- ✅ 1-hour URL expiry
- ✅ MIME type tracking
- ✅ File size tracking
- ✅ Automatic cleanup on file deletion
- ✅ Region: eu-north-1
- ✅ Bucket: d-box-2026

---

## 🔧 Backend Dependencies

### Core Dependencies

```json
{
  "express": "^5.2.1",              // Web framework
  "pg": "^8.20.0",                  // PostgreSQL driver
  "jsonwebtoken": "^9.0.2",         // JWT tokens
  "bcryptjs": "^3.0.3",             // Password hashing
  "passport": "^0.7.0",             // Authentication
  "passport-google-oauth20": "^2.0.0", // Google OAuth
  "cors": "^2.8.5",                 // CORS middleware
  "multer": "^2.1.1",               // File uploads
  "multer-s3": "^3.0.1",            // S3 file uploads
  "@aws-sdk/client-s3": "^3.1044.0", // AWS S3
  "@aws-sdk/s3-request-presigner": "^3.1044.0", // Signed URLs
  "@aws-sdk/client-ses": "^3.1042.0", // AWS SES email
  "nodemailer": "^6.10.1",          // Email service
  "express-session": "^1.19.0",     // Session management
  "connect-pg-simple": "^10.0.0",   // PostgreSQL session store
  "dotenv": "^17.2.4",              // Environment variables
  "sharp": "^0.34.5"                // Image processing
}
```

---

## 🎨 Frontend Dependencies (Admin Dashboard)

```json
{
  "react": "^18.2.0",               // UI framework
  "react-router-dom": "^6.20.0",    // Routing
  "axios": "^1.6.2",                // HTTP client
  "zustand": "^4.4.1",              // State management
  "recharts": "^2.10.3",            // Charts/graphs
  "lucide-react": "^0.304.0",       // Icons
  "react-hot-toast": "^2.4.1",      // Notifications
  "tailwindcss": "^3.3.6",          // CSS framework
  "vite": "^5.0.8"                  // Build tool
}
```

---

## 🚀 Deployment Configuration

### Environment Variables

**Production (.env template)**
```env
# Server
NODE_ENV=production
PORT=5000
SESSION_SECRET=your-secret-key

# Database
DB_HOST=your-db-host.railway.app
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your-password
DB_NAME=d_box

# AWS S3
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=eu-north-1
AWS_BUCKET_NAME=d-box-2026

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=https://your-app.railway.app/auth/google/callback

# Email (AWS SES)
AWS_SES_REGION=eu-north-1
EMAIL_FROM=noreply@dbox.com

# Frontend
REACT_APP_API_URL=https://your-backend.railway.app/api
```

### Railway Deployment

**Procfile:**
```
web: node server.js
release: node src/db/migrate.js
```

**railway.toml:**
- Auto-detects Node.js
- Sets environment variables from Railway dashboard
- Configures PostgreSQL plugin
- Health checks on PORT 5000

### Database Migrations

**Migration scripts:**
- `scripts/migrateMysqlToPostgres.js` - Migrate from MySQL
- `scripts/syncBoxFilesFromContents.js` - Sync file data
- `scripts/cleanupStaleUploads.js` - Cleanup old uploads
- `scripts/backfillBoxContents.js` - Backfill data

**Run migrations:**
```bash
npm run migrate:mysql-to-postgres
npm run sync:boxfiles
npm run cleanup:uploads:dry        # Dry run
npm run cleanup:uploads            # Apply
```

---

## 📡 Session Management

### Session Store: PostgreSQL

```javascript
// Production: Uses connect-pg-simple
// Creates 'session' table in PostgreSQL
// Session expires after 7 days (604,800,000 ms)

// Development: Uses in-memory store (with warning)
```

### Session Cookie

```javascript
{
  maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
  secure: true,                      // HTTPS only
  httpOnly: true,                    // No JS access
  sameSite: 'lax'                    // CSRF protection
}
```

---

## 🔐 AWS S3 Signed URLs

### How It Works

1. **File Upload**: User uploads → Stored in S3 with object key
2. **Database**: Only S3 key stored (not full URL)
3. **Retrieve**: User requests signed URL via `/api/files/:id/signed-url`
4. **Generate**: Server generates presigned URL (1-hour valid)
5. **Download**: User receives temporary URL, downloads directly from S3

### Signed URL Generation

```javascript
// services/s3SignedUrl.js
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Generates 1-hour valid URLs
// URLs include AWS signature
// URLs expire after 1 hour
```

### Security

- ✅ URLs don't contain credentials
- ✅ URLs include AWS signature
- ✅ URLs expire automatically (1 hour)
- ✅ Only box members can request URLs
- ✅ S3 bucket policy restricts access

---

## 📧 Email Service

### Setup

**Provider**: AWS SES (Simple Email Service)

```javascript
// utils/emailService.js
// Sends emails via AWS SES
// Supports HTML and text emails
// Queue-based delivery
```

### Email Types

- Welcome emails on registration
- Password reset emails
- Box invitation emails
- File upload notifications
- Admin activity alerts

---

## 🧪 Testing & Verification

### Verification Script

```bash
node verify-s3-implementation.js
```

**Tests 12 components:**
- S3 client initialization
- Database connection
- Signed URL generation
- Route registration
- Error handling
- Access control

### Manual Testing

```bash
# Upload test file
curl -X POST http://localhost:5000/api/files/upload \
  -F "file=@test.pdf"

# Get signed URL
curl http://localhost:5000/api/files/1/signed-url

# Download via signed URL
curl -L -o downloaded.pdf "https://s3-url-here"
```

---

## 🔄 Data Flow Diagrams

### Authentication Flow

```
User Registration/Login
         ↓
Email + Password / Google OAuth
         ↓
    Passport.js
         ↓
  Create/Validate JWT
         ↓
 Set Session Cookie
         ↓
   Redirect to Dashboard
```

### File Upload Flow

```
User Selects File
        ↓
Multer Middleware
        ↓
Upload to AWS S3
        ↓
Store S3 Key in Database
        ↓
Return File Metadata
```

### File Download Flow

```
User Requests File
        ↓
Verify User is Box Member
        ↓
Generate Signed URL (1-hour)
        ↓
Return URL to Frontend
        ↓
Frontend Downloads from S3
        ↓
Browser Opens File
```

### Admin Activity Flow

```
Admin Performs Action
        ↓
Execute Action (ban user, delete file, etc.)
        ↓
Log to activity_logs table
        ↓
Store: admin_id, action, target, timestamp
        ↓
Available in Admin Dashboard
```

---

## 📋 Development Commands

### Main Application

```bash
npm start           # Production mode
npm run dev         # Development with nodemon

# Database migrations
npm run migrate:mysql-to-postgres
npm run sync:boxfiles
npm run cleanup:uploads:dry
npm run cleanup:uploads
```

### Admin Dashboard Backend

```bash
cd admin-dashboard/backend
npm install
npm start           # Production
npm run dev         # Development
npm run migrate     # Run migrations
npm run seed        # Seed database
```

### Admin Dashboard Frontend

```bash
cd admin-dashboard/frontend
npm install
npm run dev         # Development server on localhost:5173
npm run build       # Production build
npm run preview     # Preview build
```

---

## 🐛 Known Issues & Solutions

### Issue: Files Don't Open
**Cause**: S3 bucket policy blocks access  
**Solution**: Verify AWS credentials and bucket policy

### Issue: CORS Errors
**Cause**: Frontend URL not in CORS whitelist  
**Solution**: Update CORS configuration in Express

### Issue: Session Expires Too Quickly
**Cause**: SESSION_SECRET not set in production  
**Solution**: Set SESSION_SECRET env variable

### Issue: Google OAuth Fails
**Cause**: Callback URL mismatch  
**Solution**: Update GOOGLE_CALLBACK_URL in OAuth settings

---

## 📈 Performance Optimization

### Implemented

- ✅ Signed URL caching (1-hour validity)
- ✅ Database connection pooling (pg)
- ✅ Session store in PostgreSQL (not memory)
- ✅ Image compression (sharp)
- ✅ Lazy loading in React
- ✅ Code splitting with Vite
- ✅ CSS optimization with Tailwind

### Recommended

- Add Redis caching for frequently accessed data
- Implement CDN for S3 files
- Add database query optimization
- Monitor AWS costs with CloudWatch

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Project overview |
| `admin-dashboard/README.md` | Admin dashboard guide |
| `admin-dashboard/docs/API.md` | Complete API docs |
| `admin-dashboard/docs/DATABASE.md` | Schema documentation |
| `admin-dashboard/docs/SETUP.md` | Setup instructions |
| `admin-dashboard/docs/DEPLOYMENT.md` | Deployment guide |
| `S3_INTEGRATION_GUIDE.md` | S3 setup guide |
| `RAILWAY_DEPLOYMENT.md` | Railway deployment |
| `AWS_S3_SUMMARY.md` | S3 features summary |
| `EMAIL_SETUP.md` | Email configuration |

---

## ✅ Completion Status

### Production Ready: ✅ YES

**Tested Components:**
- ✅ User authentication (email + Google OAuth)
- ✅ File uploads to S3
- ✅ Signed URL generation
- ✅ Access control
- ✅ Admin dashboard
- ✅ Database operations
- ✅ Email notifications
- ✅ Session management
- ✅ Error handling
- ✅ Security headers

**Deployment Options:**
1. **Railway** (Recommended)
   - PostgreSQL database included
   - Auto HTTPS
   - Environment variables setup
   - Cost-effective

2. **Render**
   - PostgreSQL optional
   - Auto-deploy from Git
   - Custom domains

3. **AWS/Azure**
   - Manual setup
   - Maximum control
   - Higher cost

---

## 🔗 Quick Links

- **Repository**: https://github.com/shashi9094/D-Box
- **Admin Dashboard**: `/admin-dashboard/` folder
- **API Documentation**: `admin-dashboard/docs/API.md`
- **Database Schema**: `admin-dashboard/docs/DATABASE.md`

---

## 📞 Support

For issues, feature requests, or questions:
1. Check documentation files
2. Review error logs
3. Check GitHub issues
4. Contact admin team

---

**Project maintained with ❤️**
