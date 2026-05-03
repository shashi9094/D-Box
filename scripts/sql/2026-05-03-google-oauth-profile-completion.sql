-- Google OAuth profile completion migration for PostgreSQL.
-- Run this against the production database once.

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = current_schema()
			AND table_name = 'users'
			AND column_name = 'fullName'
	) THEN
		IF NOT EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = current_schema()
				AND table_name = 'users'
				AND column_name = 'fullname'
		) THEN
			EXECUTE 'ALTER TABLE users RENAME COLUMN "fullName" TO fullname';
		ELSE
			EXECUTE 'ALTER TABLE users DROP COLUMN IF EXISTS "fullName"';
		END IF;
	END IF;

	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = current_schema()
			AND table_name = 'users'
			AND column_name = 'googleId'
	) THEN
		IF NOT EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = current_schema()
				AND table_name = 'users'
				AND column_name = 'googleid'
		) THEN
			EXECUTE 'ALTER TABLE users RENAME COLUMN "googleId" TO googleid';
		ELSE
			EXECUTE 'ALTER TABLE users DROP COLUMN IF EXISTS "googleId"';
		END IF;
	END IF;

	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = current_schema()
			AND table_name = 'users'
			AND column_name = 'profilePhoto'
	) THEN
		IF NOT EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = current_schema()
				AND table_name = 'users'
				AND column_name = 'profilephoto'
		) THEN
			EXECUTE 'ALTER TABLE users RENAME COLUMN "profilePhoto" TO profilephoto';
		ELSE
			EXECUTE 'ALTER TABLE users DROP COLUMN IF EXISTS "profilePhoto"';
		END IF;
	END IF;

	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = current_schema()
			AND table_name = 'users'
			AND column_name = 'isProfileComplete'
	) THEN
		IF NOT EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = current_schema()
				AND table_name = 'users'
				AND column_name = 'isprofilecomplete'
		) THEN
			EXECUTE 'ALTER TABLE users RENAME COLUMN "isProfileComplete" TO isprofilecomplete';
		ELSE
			EXECUTE 'ALTER TABLE users DROP COLUMN IF EXISTS "isProfileComplete"';
		END IF;
	END IF;
END $$;

ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS fullname TEXT NULL;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS googleid TEXT NULL;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS profilephoto TEXT NULL;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS isprofilecomplete BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE IF EXISTS users ALTER COLUMN password DROP NOT NULL;
ALTER TABLE IF EXISTS users ALTER COLUMN capacity DROP NOT NULL;
ALTER TABLE IF EXISTS users ALTER COLUMN purpose DROP NOT NULL;
ALTER TABLE IF EXISTS users ALTER COLUMN role DROP NOT NULL;

ALTER TABLE IF EXISTS users ALTER COLUMN isprofilecomplete SET DEFAULT FALSE;
UPDATE users SET isprofilecomplete = COALESCE(isprofilecomplete, FALSE);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_googleid ON users(googleid);