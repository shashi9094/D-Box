# Database Schema - D-Box Admin Dashboard

Complete documentation of the PostgreSQL database schema.

## Database Overview

**Database Name**: `admin_dashboard`
**Engine**: PostgreSQL 12+
**Character Set**: UTF8
**Timezone**: UTC

## Tables

### 1. Users Table

Stores all user accounts and their information.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'USER',
  is_banned BOOLEAN DEFAULT FALSE,
  storage_limit BIGINT DEFAULT 10737418240,
  storage_used BIGINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  last_login TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
```

**Columns:**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(255) | User full name |
| username | VARCHAR(100) | Unique username |
| email | VARCHAR(255) | Unique email address |
| password | VARCHAR(255) | Bcrypt hash for local users, `google_auth` for Google-linked users |
| role | VARCHAR(50) | USER, ADMIN, or SUPER_ADMIN |
| is_banned | BOOLEAN | Account ban status |
| storage_limit | BIGINT | Max storage in bytes (default: 10GB) |
| storage_used | BIGINT | Current storage usage in bytes |
| created_at | TIMESTAMP | Account creation date |
| updated_at | TIMESTAMP | Last update date |
| last_login | TIMESTAMP | Last login timestamp |

**Indexes:**
- `idx_users_email` - Fast email lookup
- `idx_users_username` - Fast username lookup
- `idx_users_role` - Query by role

**Sample Queries:**

```sql
-- Create super admin (password must be a bcrypt hash)
INSERT INTO users (name, username, email, password, role)
VALUES ('Admin', 'admin', 'admin@dbox.com', 
  '$2b$10$NORBszlwiN4Rnlt4OeaH0OJHK9J8s1L5K3H8Q2V9W0X1Y2Z3A4B5C', 
  'SUPER_ADMIN');

-- Create a Google-linked account
INSERT INTO users (name, username, email, password, role)
VALUES ('Google User', 'google-user', 'google@example.com', 'google_auth', 'USER');

-- Find user by email
SELECT * FROM users WHERE email = 'user@example.com';

-- Get all active users
SELECT * FROM users WHERE is_banned = FALSE;

-- Get storage stats
SELECT username, storage_used, storage_limit, 
  ROUND((storage_used::FLOAT / storage_limit) * 100, 2) as usage_percent
FROM users
ORDER BY storage_used DESC;

-- Ban a user
UPDATE users SET is_banned = TRUE WHERE id = 'user-id';

-- Update storage used
UPDATE users SET storage_used = storage_used + 1024 
WHERE id = 'user-id';
```

---

### 2. Files Table

Stores information about uploaded files with soft delete support.

```sql
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_files_user_id ON files(user_id);
CREATE INDEX idx_files_deleted_at ON files(deleted_at);
CREATE INDEX idx_files_uploaded_at ON files(uploaded_at);
```

**Columns:**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to users |
| file_name | VARCHAR(255) | Original filename |
| file_url | TEXT | S3 file URL |
| file_size | BIGINT | File size in bytes |
| mime_type | VARCHAR(100) | MIME type (e.g., image/png) |
| uploaded_at | TIMESTAMP | Upload timestamp |
| deleted_at | TIMESTAMP | Soft delete timestamp (NULL = not deleted) |

**Indexes:**
- `idx_files_user_id` - Query files by user
- `idx_files_deleted_at` - Soft delete filtering
- `idx_files_uploaded_at` - Time-based queries

**Sample Queries:**

```sql
-- Get non-deleted files
SELECT * FROM files WHERE deleted_at IS NULL;

-- Get user's files
SELECT * FROM files WHERE user_id = 'user-id' AND deleted_at IS NULL;

-- Soft delete a file
UPDATE files SET deleted_at = NOW() WHERE id = 'file-id';

-- Get total user storage
SELECT user_id, SUM(file_size) as total_size
FROM files
WHERE deleted_at IS NULL
GROUP BY user_id;

-- Find large files
SELECT * FROM files 
WHERE deleted_at IS NULL 
AND file_size > 1073741824
ORDER BY file_size DESC;

-- Get total storage by user
SELECT u.email, COUNT(f.id) as file_count, 
  SUM(f.file_size) as total_size
FROM users u
LEFT JOIN files f ON u.id = f.user_id AND f.deleted_at IS NULL
GROUP BY u.id, u.email
ORDER BY total_size DESC;
```

---

### 3. Activity Logs Table

Audit trail for all admin actions.

```sql
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  target_user UUID REFERENCES users(id) ON DELETE SET NULL,
  target_file UUID REFERENCES files(id) ON DELETE SET NULL,
  description TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_admin_id ON activity_logs(admin_id);
CREATE INDEX idx_activity_target_user ON activity_logs(target_user);
CREATE INDEX idx_activity_created_at ON activity_logs(created_at);
CREATE INDEX idx_activity_action ON activity_logs(action);
```

**Columns:**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| admin_id | UUID | Admin who performed action |
| action | VARCHAR(100) | Action type |
| target_user | UUID | User affected by action |
| target_file | UUID | File affected by action |
| description | TEXT | Detailed description |
| ip_address | VARCHAR(45) | Admin's IP address |
| user_agent | TEXT | Admin's user agent |
| created_at | TIMESTAMP | Action timestamp |

**Valid Actions:**
- `USER_BANNED`
- `USER_UNBANNED`
- `USER_DELETED`
- `ROLE_CHANGED`
- `STORAGE_LIMIT_CHANGED`
- `FILE_DELETED`
- `LOGIN_AS_USER`
- `SETTINGS_UPDATED`

**Indexes:**
- `idx_activity_admin_id` - Logs by admin
- `idx_activity_target_user` - Logs for user
- `idx_activity_created_at` - Time-based queries
- `idx_activity_action` - Query by action

**Sample Queries:**

```sql
-- Get recent activity
SELECT * FROM activity_logs
ORDER BY created_at DESC
LIMIT 50;

-- Get user's activity
SELECT * FROM activity_logs
WHERE target_user = 'user-id' OR admin_id = 'user-id'
ORDER BY created_at DESC;

-- Get action statistics
SELECT action, COUNT(*) as count
FROM activity_logs
GROUP BY action
ORDER BY count DESC;

-- Audit trail for specific user
SELECT a.action, u.email as admin_email, a.description, a.created_at
FROM activity_logs a
JOIN users u ON a.admin_id = u.id
WHERE a.target_user = 'user-id'
ORDER BY a.created_at DESC;

-- Get daily activity count
SELECT DATE(created_at) as date, COUNT(*) as activity_count
FROM activity_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

### 4. Login History Table

Tracks user login and logout sessions.

```sql
CREATE TABLE login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  logout_at TIMESTAMP
);

CREATE INDEX idx_login_history_user_id ON login_history(user_id);
CREATE INDEX idx_login_history_login_at ON login_history(login_at);
```

**Columns:**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | User who logged in |
| ip_address | VARCHAR(45) | Login IP address |
| user_agent | TEXT | Browser user agent |
| login_at | TIMESTAMP | Login timestamp |
| logout_at | TIMESTAMP | Logout timestamp |

**Sample Queries:**

```sql
-- Get current active sessions
SELECT * FROM login_history
WHERE logout_at IS NULL
ORDER BY login_at DESC;

-- Get user login history
SELECT * FROM login_history
WHERE user_id = 'user-id'
ORDER BY login_at DESC
LIMIT 10;

-- Get session duration
SELECT user_id,
  EXTRACT(EPOCH FROM (logout_at - login_at))/60 as duration_minutes,
  login_at, logout_at
FROM login_history
WHERE logout_at IS NOT NULL
ORDER BY login_at DESC;

-- Get unique IPs for user
SELECT DISTINCT ip_address FROM login_history
WHERE user_id = 'user-id'
ORDER BY ip_address;
```

---

### 5. Storage Usage Table

Historical storage usage tracking.

```sql
CREATE TABLE storage_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_used BIGINT NOT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_storage_usage_user_id ON storage_usage(user_id);
CREATE INDEX idx_storage_usage_recorded_at ON storage_usage(recorded_at);
```

**Columns:**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | User's storage |
| storage_used | BIGINT | Storage in bytes |
| recorded_at | TIMESTAMP | Snapshot timestamp |

**Sample Queries:**

```sql
-- Get storage trend for user
SELECT DATE(recorded_at), storage_used
FROM storage_usage
WHERE user_id = 'user-id'
AND recorded_at >= NOW() - INTERVAL '30 days'
ORDER BY recorded_at;

-- Latest storage snapshot per user
SELECT DISTINCT ON (user_id) user_id, storage_used, recorded_at
FROM storage_usage
ORDER BY user_id, recorded_at DESC;
```

---

### 6. Settings Table

System-wide configuration.

```sql
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO settings (key, value) VALUES
  ('site_name', 'D-Box Admin Dashboard'),
  ('max_upload_size', '10737418240'),
  ('maintenance_mode', 'false'),
  ('daily_backup', 'true')
ON CONFLICT (key) DO NOTHING;
```

**Columns:**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| key | VARCHAR(100) | Setting key |
| value | TEXT | Setting value |
| created_at | TIMESTAMP | Creation date |
| updated_at | TIMESTAMP | Last update |

**Sample Queries:**

```sql
-- Get specific setting
SELECT value FROM settings WHERE key = 'site_name';

-- Get all settings as JSON
SELECT jsonb_object_agg(key, value) as settings
FROM settings;

-- Update setting
UPDATE settings SET value = 'New Value', updated_at = NOW()
WHERE key = 'site_name';
```

---

## Relationships

```
users
├── files (1:Many) - user_id FK
├── activity_logs (as admin_id) - 1:Many
├── activity_logs (as target_user) - 1:Many
└── login_history - 1:Many

files
├── users (Many:1) - user_id FK
└── activity_logs (as target_file) - 1:Many

activity_logs
├── users (as admin_id) - Many:1
├── users (as target_user) - Many:1
└── files (as target_file) - Many:1

login_history
└── users - Many:1

storage_usage
└── users - Many:1
```

---

## Database Maintenance

### Backup

```bash
# Full database backup
pg_dump -U dbox_admin -h localhost admin_dashboard > backup.sql

# Compressed backup
pg_dump -U dbox_admin -h localhost admin_dashboard | gzip > backup.sql.gz

# Restore from backup
psql -U dbox_admin -h localhost admin_dashboard < backup.sql
```

### Vacuum & Analyze

```sql
-- Clean up deleted rows
VACUUM ANALYZE;

-- Check table sizes
SELECT schemaname, tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname != 'pg_catalog'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Monitoring Queries

```sql
-- Check database connections
SELECT datname, count(*) as connections
FROM pg_stat_activity
GROUP BY datname;

-- Slow queries (requires pg_stat_statements extension)
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Index usage
SELECT idx, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Table sizes
SELECT tablename, pg_size_pretty(pg_total_relation_size(tablename))
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename) DESC;
```

---

## Performance Optimization

### Recommended Indexes Already Created
- ✅ Email, username, role on users
- ✅ user_id, deleted_at on files
- ✅ admin_id, target_user, action, created_at on activity_logs
- ✅ user_id on login_history
- ✅ user_id on storage_usage

### Query Optimization Tips

```sql
-- Use EXPLAIN ANALYZE to check query performance
EXPLAIN ANALYZE
SELECT * FROM users WHERE email = 'user@example.com';

-- Use LIMIT for pagination
SELECT * FROM files LIMIT 20 OFFSET 0;

-- Use WHERE clauses to filter early
SELECT * FROM files 
WHERE user_id = 'user-id' AND deleted_at IS NULL;

-- Avoid SELECT *
SELECT id, name, email FROM users;
```

---

## Storage Calculation

```sql
-- Total storage used
SELECT SUM(file_size) as total_storage_bytes,
  ROUND(SUM(file_size)::NUMERIC / 1024 / 1024 / 1024, 2) as total_storage_gb
FROM files
WHERE deleted_at IS NULL;

-- Storage by user
SELECT u.email,
  COUNT(f.id) as file_count,
  SUM(f.file_size) as total_size_bytes,
  ROUND(SUM(f.file_size)::NUMERIC / 1024 / 1024, 2) as total_size_mb,
  ROUND((SUM(f.file_size)::NUMERIC / u.storage_limit) * 100, 2) as usage_percent
FROM users u
LEFT JOIN files f ON u.id = f.user_id AND f.deleted_at IS NULL
GROUP BY u.id, u.email, u.storage_limit
ORDER BY total_size_bytes DESC;

-- Storage distribution
SELECT
  CASE
    WHEN (storage_used::FLOAT / storage_limit) < 0.5 THEN '0-50%'
    WHEN (storage_used::FLOAT / storage_limit) < 0.7 THEN '50-70%'
    WHEN (storage_used::FLOAT / storage_limit) < 0.9 THEN '70-90%'
    ELSE '90-100%'
  END as storage_range,
  COUNT(*) as user_count
FROM users
GROUP BY storage_range;
```

---

## Disaster Recovery

### Export Data

```bash
# Export users
psql -U dbox_admin -h localhost admin_dashboard \
  -c "COPY users TO STDOUT WITH CSV HEADER" > users.csv

# Export files
psql -U dbox_admin -h localhost admin_dashboard \
  -c "COPY files TO STDOUT WITH CSV HEADER" > files.csv

# Export activity logs
psql -U dbox_admin -h localhost admin_dashboard \
  -c "COPY activity_logs TO STDOUT WITH CSV HEADER" > activity_logs.csv
```

### Scheduled Backups

```bash
#!/bin/bash
# backup.sh - Run daily via cron

BACKUP_DIR="/backup/dbox"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/admin_dashboard_$DATE.sql.gz"

mkdir -p $BACKUP_DIR

pg_dump -U dbox_admin -h localhost admin_dashboard | \
  gzip > $BACKUP_FILE

# Keep only last 30 backups
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

# Add to crontab
# 0 2 * * * /path/to/backup.sh
```

---

## Data Retention Policy

| Table | Retention | Action |
|-------|-----------|--------|
| users | Indefinite | Keep all user accounts |
| files | 90 days after delete | Hard delete soft-deleted files |
| activity_logs | 1 year | Archive/delete old logs |
| login_history | 90 days | Delete old sessions |
| storage_usage | 1 year | Delete snapshots older than 1 year |

---

**Schema Version**: 1.0
**Last Updated**: January 2024
