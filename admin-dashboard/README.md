# D-Box Super Admin Dashboard

A production-ready, full-stack Super Admin Dashboard for a cloud storage SaaS web app built with React, Node.js, PostgreSQL, and AWS S3.

## 🚀 Features

### Authentication & Security
- ✅ Secure JWT-based authentication
- ✅ Bcrypt password hashing
- ✅ Role-based access control (SUPER_ADMIN, ADMIN, USER)
- ✅ Protected API routes
- ✅ Session validation
- ✅ Activity logging

### Super Admin Features
- 👥 View and manage all users
- 🔍 Global search (email, username, user ID)
- 🚫 Ban/unban users instantly
- 👤 Change user roles dynamically
- 📁 View all uploaded files
- 🗑️ Delete any file
- 🔑 Login as user (for support/debugging)
- 📊 Analytics dashboard
- 📋 Complete activity logging
- ⚙️ System settings management
- 💾 Storage management
- 📈 Detailed statistics and charts

### Database Schema
- **Users**: Complete user management with roles and storage limits
- **Files**: File upload tracking with S3 integration
- **Activity Logs**: Comprehensive admin action tracking
- **Login History**: User login tracking
- **Settings**: System-wide configuration

### Frontend
- 🎨 Modern, responsive admin UI
- 📱 Mobile-friendly design
- 📊 Beautiful charts and analytics
- 🔄 Real-time data updates
- 🎯 Intuitive navigation
- 🌙 Dark/Light mode ready

## 📋 Tech Stack

### Backend
- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT + bcrypt
- **Cloud Storage**: AWS S3
- **Security**: Helmet, CORS, Rate Limiting

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Charts**: Recharts
- **UI Icons**: Lucide React
- **Notifications**: React Hot Toast
- **HTTP Client**: Axios

### Deployment
- **Backend**: Railway
- **Frontend**: Vercel / Railway
- **Database**: PostgreSQL (Railway or AWS RDS)
- **Storage**: AWS S3

## 🛠️ Prerequisites

- Node.js 16+ and npm
- PostgreSQL 12+
- AWS Account (for S3)
- Git

## 📦 Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/admin-dashboard.git
cd admin-dashboard
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Configure environment variables
# Edit .env with your database and AWS credentials

# Run database migrations
npm run migrate

# Start development server
npm run dev

# Start production server
npm start
```

#### Backend .env Configuration

```env
PORT=5000
NODE_ENV=development

# Database
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=admin_dashboard

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRY=7d

# CORS
CORS_ORIGIN=http://localhost:3000

# AWS S3
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env file (optional)
# The app uses /api proxy to backend

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### 4. Database Initialization

```bash
cd backend

# Run migrations to create tables
npm run migrate

# Optional: Seed test data
npm run seed
```

## 🔐 Default Credentials

For development, create a super admin user:

```sql
INSERT INTO users (name, username, email, password, role)
VALUES (
  'Super Admin',
  'admin',
  'admin@dbox.com',
  'hashed_password_here',
  'SUPER_ADMIN'
);
```

Use bcrypt to hash the password, or register via the API and manually set the role.

## 📚 API Documentation

### Authentication

```bash
# Login
POST /api/auth/login
{
  "email": "admin@dbox.com",
  "password": "password123"
}

# Register
POST /api/auth/register
{
  "name": "User Name",
  "username": "username",
  "email": "email@example.com",
  "password": "password123"
}

# Logout
POST /api/auth/logout
```

### Users Management (SUPER_ADMIN only)

```bash
# Get all users
GET /api/admin/users?limit=20&offset=0&search=email

# Get user by ID
GET /api/admin/users/:userId

# Get user by email
GET /api/admin/users/email/:email

# Ban user
PATCH /api/admin/users/:userId/ban

# Unban user
PATCH /api/admin/users/:userId/unban

# Change user role
PATCH /api/admin/users/:userId/role
{ "role": "ADMIN" }

# Update storage limit
PATCH /api/admin/users/:userId/storage
{ "storageLimit": 10737418240 }

# Login as user
PATCH /api/admin/users/:userId/login-as

# Delete user
DELETE /api/admin/users/:userId
```

### Files Management

```bash
# Get all files
GET /api/admin/files?limit=50&offset=0

# Get user's files
GET /api/admin/files/user/:userId

# Delete file
DELETE /api/admin/files/:fileId
```

### Analytics

```bash
# Get statistics
GET /api/admin/analytics/stats

# Get dashboard metrics
GET /api/admin/analytics/metrics
```

### Activity Logs

```bash
# Get activity logs
GET /api/admin/activity?limit=50&offset=0&action=USER_BANNED

# Get user's activity logs
GET /api/admin/activity/user/:userId
```

### Settings

```bash
# Get all settings
GET /api/admin/settings

# Get specific setting
GET /api/admin/settings/:key

# Update settings
PATCH /api/admin/settings
{
  "settings": {
    "site_name": "D-Box",
    "maintenance_mode": "false"
  }
}
```

## 🎯 Project Structure

```
admin-dashboard/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Request handlers
│   │   ├── routes/          # API routes
│   │   ├── models/          # Database models
│   │   ├── middleware/      # Auth, error handling
│   │   ├── utils/           # JWT, S3, password utilities
│   │   ├── config/          # Configuration files
│   │   └── db/              # Database connection & migrations
│   ├── server.js            # Express app entry point
│   ├── package.json
│   ├── .env.example
│   └── .gitignore
│
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable React components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API service layer
│   │   ├── context/         # State management (Zustand)
│   │   ├── hooks/           # Custom React hooks
│   │   ├── utils/           # Helper functions
│   │   ├── App.jsx          # Main app component
│   │   ├── main.jsx         # React entry point
│   │   └── index.css        # Global styles
│   ├── public/              # Static assets
│   ├── index.html           # HTML template
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
│
└── docs/
    ├── SETUP.md             # Setup instructions
    ├── DEPLOYMENT.md        # Deployment guide
    ├── API.md               # API documentation
    └── DATABASE.md          # Database schema
```

## 🚀 Deployment

### Deploy Backend to Railway

1. Push code to GitHub
2. Connect GitHub repo to Railway
3. Set environment variables
4. Deploy

```bash
# Railway CLI (optional)
railway link
railway up
```

### Deploy Frontend to Vercel

```bash
# Vercel CLI
npm i -g vercel
vercel
```

### Deploy Frontend to Railway

1. Build the frontend: `npm run build`
2. Create Dockerfile in frontend directory
3. Deploy to Railway

## 📊 Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  username VARCHAR(100) UNIQUE,
  email VARCHAR(255) UNIQUE,
  password VARCHAR(255),
  role VARCHAR(50) DEFAULT 'USER',
  is_banned BOOLEAN DEFAULT FALSE,
  storage_limit BIGINT DEFAULT 10737418240,
  storage_used BIGINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  last_login TIMESTAMP
);
```

### Files Table
```sql
CREATE TABLE files (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  file_name VARCHAR(255),
  file_url TEXT,
  file_size BIGINT,
  mime_type VARCHAR(100),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);
```

### Activity Logs Table
```sql
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY,
  admin_id UUID REFERENCES users(id),
  action VARCHAR(100),
  target_user UUID REFERENCES users(id),
  target_file UUID REFERENCES files(id),
  description TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🔒 Security Features

- ✅ JWT token-based authentication
- ✅ Bcrypt password hashing
- ✅ Helmet.js for security headers
- ✅ CORS protection
- ✅ Rate limiting
- ✅ Input validation
- ✅ SQL injection protection (parameterized queries)
- ✅ XSS protection
- ✅ Activity logging for audit trail
- ✅ Protected admin routes
- ✅ Role-based access control

## 🚨 Important Security Notes

1. **Never commit `.env` files** - Add to `.gitignore`
2. **Change JWT_SECRET in production** - Use strong random string
3. **Use HTTPS in production** - Railway provides SSL by default
4. **Rotate AWS credentials regularly**
5. **Enable database backups** - Railway provides automated backups
6. **Monitor activity logs** - Check for suspicious actions
7. **Update dependencies** - Run `npm audit` regularly

## 📞 Support Features

### Login as User
Super admins can temporarily login as any user for debugging:
- No password required
- Full user account access
- All actions logged
- Useful for user support

### Activity Logging
All admin actions are logged:
- User bans/unbans
- Role changes
- File deletions
- Login as user
- Settings changes
- Storage limit changes

## 🎨 UI Components

### Reusable Components
- `Button` - Primary, secondary, danger, success variants
- `Input` - Text input with validation
- `Card` - Container component
- `Badge` - Status badges with colors
- `Modal` - Dialog component
- `LoadingSpinner` - Loading indicator
- `DataTable` - Data display with pagination
- `StatCard` - Statistics display card
- `Pagination` - Page navigation

### Hooks
- `useAsync` - Async data fetching
- `useDebounce` - Debounce search
- `usePagination` - Pagination logic
- `useLocalStorage` - Local storage management

## 🧪 Testing

### Backend Tests
```bash
# Create test suite
npm run test
```

### Frontend Tests
```bash
# Run component tests
npm run test:components
```

## 📈 Performance Optimization

- ✅ Vite for fast HMR
- ✅ Code splitting in React
- ✅ Database indexing on frequently queried columns
- ✅ Pagination for large datasets
- ✅ Image optimization
- ✅ Lazy loading components
- ✅ Redis caching (can be added)

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
# Verify DB credentials in .env
# Run migrations: npm run migrate
```

### CORS Issues
```bash
# Update CORS_ORIGIN in backend .env
# Frontend must be on same domain or whitelisted
```

### S3 Upload Failures
```bash
# Verify AWS credentials
# Check bucket permissions
# Ensure bucket CORS configuration
```

### Authentication Errors
```bash
# Verify JWT_SECRET is set
# Check token expiry time
# Clear browser localStorage
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Push to the branch
5. Create a Pull Request

## 📝 License

MIT License - feel free to use in commercial projects

## 👨‍💻 Author

Built with ❤️ for D-Box Cloud Storage SaaS

## 🙏 Acknowledgments

- React & Vite team
- Express.js community
- PostgreSQL developers
- AWS for S3 service
- All open-source contributors

---

**For detailed setup instructions, see [SETUP.md](./docs/SETUP.md)**
**For deployment guide, see [DEPLOYMENT.md](./docs/DEPLOYMENT.md)**
**For API documentation, see [API.md](./docs/API.md)**
