-- Migration: Add persistent users.role and sync values from box ownership
-- Safe to run multiple times.

USE dbox;

SET @db_name := DATABASE();

-- 1) Ensure users.role exists
SET @has_role := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'role'
);

SET @sql_role := IF(
  @has_role = 0,
  "ALTER TABLE users ADD COLUMN role ENUM('User','Admin') NOT NULL DEFAULT 'User' AFTER purpose",
  "SELECT 'users.role already exists' AS info"
);

PREPARE stmt_role FROM @sql_role;
EXECUTE stmt_role;
DEALLOCATE PREPARE stmt_role;

-- 2) Ensure users.created_at exists (older schemas may miss this)
SET @has_created_at := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'created_at'
);

SET @sql_created_at := IF(
  @has_created_at = 0,
  "ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER password",
  "SELECT 'users.created_at already exists' AS info"
);

PREPARE stmt_created_at FROM @sql_created_at;
EXECUTE stmt_created_at;
DEALLOCATE PREPARE stmt_created_at;

-- 3) Sync role from ownership state
UPDATE users u
SET role = 'Admin'
WHERE EXISTS (
  SELECT 1
  FROM boxes b
  WHERE b.user_id = u.id
);

UPDATE users u
SET role = 'User'
WHERE NOT EXISTS (
  SELECT 1
  FROM boxes b
  WHERE b.user_id = u.id
);

-- 4) Verification output
SELECT id, fullName, email, role
FROM users
ORDER BY id DESC;
