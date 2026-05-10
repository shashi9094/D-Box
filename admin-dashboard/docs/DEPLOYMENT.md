# Deployment Guide - D-Box Admin Dashboard

Complete guide to deploy the Super Admin Dashboard to production.

## 🚀 Pre-Deployment Checklist

- [ ] All environment variables configured
- [ ] Database migrations completed
- [ ] AWS S3 bucket created and configured
- [ ] JWT_SECRET changed to strong random value
- [ ] HTTPS enabled
- [ ] Backups configured
- [ ] Monitoring set up
- [ ] Error logging configured

## 📦 Backend Deployment (Railway)

### 1. Prepare Backend for Production

```bash
cd backend

# Install dependencies
npm install --production

# Create .env file with production variables
```

### 2. Create railway.toml

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npm start"
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 10
```

### 3. Deploy to Railway

#### Option A: Railway Dashboard
1. Go to [railway.app](https://railway.app)
2. Create new project
3. Connect GitHub repository
4. Add PostgreSQL plugin
5. Set environment variables
6. Deploy

#### Option B: Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Create new project
railway init

# Link project
railway link

# Set environment variables
railway variables set DB_USER=postgres
railway variables set DB_PASSWORD=your_password
railway variables set DB_HOST=your_host
railway variables set DB_PORT=5432
railway variables set DB_NAME=admin_dashboard
railway variables set JWT_SECRET=your_strong_secret_key
railway variables set AWS_ACCESS_KEY_ID=your_key
railway variables set AWS_SECRET_ACCESS_KEY=your_secret
railway variables set AWS_REGION=us-east-1
railway variables set AWS_S3_BUCKET=your_bucket

# Deploy
railway up
```

### 4. Run Migrations on Production

```bash
# SSH into Railway container or use Railway CLI
railway run npm run migrate
```

## 🎨 Frontend Deployment (Vercel or Railway)

### Option A: Deploy to Vercel

1. Install Vercel CLI
```bash
npm install -g vercel
```

2. Deploy frontend
```bash
cd frontend
vercel --prod
```

3. Configure environment (in Vercel dashboard)
```
VITE_API_URL=https://your-backend-url.railway.app/api
```

4. Update vite.config.js
```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  }
})
```

### Option B: Deploy to Railway

1. Create Dockerfile in frontend directory

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
```

2. Deploy to Railway
```bash
# Push code to GitHub
git add .
git commit -m "Add deployment files"
git push

# In Railway dashboard:
# - New Project
# - GitHub repo
# - Add environment variables
# - Deploy
```

## 🗄️ Database Setup

### 1. Create PostgreSQL Database

#### Using Railway
1. In Railway project, add PostgreSQL plugin
2. Copy connection string
3. Use in backend .env

#### Using AWS RDS
```bash
# Create RDS instance
# Use security groups to restrict access
# Enable automated backups
# Enable Multi-AZ for production
```

### 2. Run Migrations

```bash
# Local
npm run migrate

# Production (via Railway)
railway run npm run migrate
```

### 3. Create Super Admin User

```sql
-- Connect to production database

-- Create super admin user
INSERT INTO users (name, username, email, password, role, created_at)
VALUES (
  'Super Admin',
  'admin',
  'admin@dbox.com',
  '$2b$10$...', -- bcrypt hash of password
  'SUPER_ADMIN',
  NOW()
);
```

## 🪣 AWS S3 Setup

### 1. Create S3 Bucket

```bash
# Via AWS CLI
aws s3 mb s3://your-bucket-name --region us-east-1
```

### 2. Configure Bucket

```bash
# Enable versioning
aws s3api put-bucket-versioning \
  --bucket your-bucket-name \
  --versioning-configuration Status=Enabled

# Set CORS
aws s3api put-bucket-cors \
  --bucket your-bucket-name \
  --cors-configuration file://cors.json
```

### 3. Create cors.json

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://yourdomain.com"],
      "AllowedMethods": ["GET", "POST", "DELETE"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

### 4. Create IAM User

```bash
# Create policy
aws iam create-policy \
  --policy-name S3AdminPolicy \
  --policy-document file://s3-policy.json

# Create user
aws iam create-user --user-name dbox-admin

# Attach policy
aws iam attach-user-policy \
  --user-name dbox-admin \
  --policy-arn arn:aws:iam::ACCOUNT_ID:policy/S3AdminPolicy

# Create access keys
aws iam create-access-key --user-name dbox-admin
```

### 5. s3-policy.json

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-bucket-name",
        "arn:aws:s3:::your-bucket-name/*"
      ]
    }
  ]
}
```

## 🔐 Security in Production

### 1. Environment Variables

Never commit .env files. Set in deployment platform:

```
PORT=5000
NODE_ENV=production
DB_USER=postgres_prod
DB_PASSWORD=strong_random_password
DB_HOST=prod-db.railway.app
DB_PORT=5432
DB_NAME=admin_dashboard_prod
JWT_SECRET=very_long_random_secret_string
JWT_EXPIRY=7d
CORS_ORIGIN=https://yourdomain.com
AWS_ACCESS_KEY_ID=your_production_key
AWS_SECRET_ACCESS_KEY=your_production_secret
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-production-bucket
```

### 2. Enable HTTPS

Railway and Vercel automatically provide SSL certificates.

### 3. Rate Limiting

Already configured in Express app:

```javascript
// Backend server.js already has rate limiting
import rateLimit from 'express-rate-limit';
```

### 4. CORS Configuration

Update CORS_ORIGIN to production domain:

```env
CORS_ORIGIN=https://youradmin.yourcompany.com
```

### 5. Database Backups

Configure in Railway or AWS RDS:
- Daily automated backups
- 30-day retention
- Cross-region replication

### 6. Monitoring & Logging

Set up error tracking:

```bash
# Install Sentry (optional)
npm install @sentry/node

# Add to server.js
import * as Sentry from "@sentry/node";
Sentry.init({ dsn: process.env.SENTRY_DSN });
```

## 📊 Performance Monitoring

### 1. Add Application Monitoring

```bash
# New Relic or DataDog
npm install newrelic

# Add at top of server.js
require('newrelic');
```

### 2. Database Query Monitoring

```javascript
// Enable query logging
pool.on('query', (query) => {
  console.log('Query:', query.text);
});
```

### 3. Frontend Performance

```javascript
// Add to React app
import { Profiler } from 'react';

<Profiler id="Admin" onRender={logProfilingResults}>
  <App />
</Profiler>
```

## 🚨 Incident Response

### Backend Down

1. Check Railway dashboard
2. Review error logs
3. Check database connection
4. Restart application
5. Notify users

### Database Issues

1. Check connection string
2. Verify database status
3. Check backups
4. Restore if needed
5. Verify data integrity

### Performance Issues

1. Check server resources
2. Review database queries
3. Check S3 connectivity
4. Scale resources as needed

## 📈 Scaling Strategy

### Phase 1: Initial Deployment
- Single backend instance
- Single database instance
- S3 for storage

### Phase 2: Optimization
- Add Redis cache
- Implement CDN for assets
- Database read replicas
- Load balancer

### Phase 3: High Scale
- Kubernetes orchestration
- Multiple backend instances
- Database clustering
- Dedicated S3 CloudFront CDN

## 🔄 Continuous Deployment

### GitHub Actions Example

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to Railway
        run: |
          npm install -g @railway/cli
          railway up
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

## ✅ Post-Deployment Checklist

- [ ] Test login functionality
- [ ] Verify database connectivity
- [ ] Test file uploads
- [ ] Check S3 integration
- [ ] Verify email notifications (if applicable)
- [ ] Test activity logging
- [ ] Monitor error logs
- [ ] Load test the system
- [ ] Verify backups
- [ ] Document configuration
- [ ] Create runbook
- [ ] Train support team

## 🆘 Rollback Procedure

If deployment fails:

```bash
# Railway
railway rollback

# Git revert
git revert <commit-hash>
git push
```

## 📞 Support

For Railway issues: [Railway Support](https://railway.app/support)
For Vercel issues: [Vercel Support](https://vercel.com/support)
For AWS issues: [AWS Support](https://aws.amazon.com/support)

---

**Deployment Status**: ✅ Ready for Production
