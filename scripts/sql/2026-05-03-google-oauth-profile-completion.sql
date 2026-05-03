-- Google OAuth profile completion migration for PostgreSQL.
-- Run this against the production database once.

ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS googleid TEXT NULL;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS isProfileComplete BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS users ALTER COLUMN password DROP NOT NULL;
ALTER TABLE IF EXISTS users ALTER COLUMN capacity DROP NOT NULL;
ALTER TABLE IF EXISTS users ALTER COLUMN purpose DROP NOT NULL;
ALTER TABLE IF EXISTS users ALTER COLUMN isProfileComplete SET DEFAULT FALSE;

UPDATE users
SET isProfileComplete = COALESCE(isProfileComplete, FALSE);

CREATE INDEX IF NOT EXISTS idx_users_googleid ON users(googleid);