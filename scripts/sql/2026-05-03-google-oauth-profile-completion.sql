-- Google OAuth profile completion migration for PostgreSQL.
-- Run this against the production database once.

-- Add googleid column if missing
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS googleid TEXT NULL;

-- Add isprofilecomplete column if missing
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS isprofilecomplete BOOLEAN NOT NULL DEFAULT FALSE;

-- Make password nullable for Google OAuth users
ALTER TABLE IF EXISTS users ALTER COLUMN password DROP NOT NULL;

-- Make capacity nullable
ALTER TABLE IF EXISTS users ALTER COLUMN capacity DROP NOT NULL;

-- Make purpose nullable
ALTER TABLE IF EXISTS users ALTER COLUMN purpose DROP NOT NULL;

-- Ensure isprofilecomplete has correct default
ALTER TABLE IF EXISTS users ALTER COLUMN isprofilecomplete SET DEFAULT FALSE;

-- Update any NULL isprofilecomplete to FALSE
UPDATE users SET isprofilecomplete = FALSE WHERE isprofilecomplete IS NULL;

-- Create index for faster Google ID lookups
CREATE INDEX IF NOT EXISTS idx_users_googleid ON users(googleid);