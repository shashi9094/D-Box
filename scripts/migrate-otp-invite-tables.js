/**
 * Database Migration: Add OTP and Invite tables
 * Run this script to set up required database tables
 * Usage: node scripts/migrate-otp-invite-tables.js
 */

const db = require('../db/connection');

const OTP_TABLE = `
  CREATE TABLE IF NOT EXISTS otps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    otp_hash VARCHAR(255) NOT NULL,
    purpose VARCHAR(50) NOT NULL DEFAULT 'verification',
    expires_at DATETIME NOT NULL,
    attempts INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_purpose (purpose),
    INDEX idx_expires_at (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const INVITE_TABLE = `
  CREATE TABLE IF NOT EXISTS invites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token VARCHAR(64) NOT NULL UNIQUE,
    invited_email VARCHAR(255) NOT NULL,
    invited_by_user_id INT NOT NULL,
    box_id INT,
    expires_at DATETIME NOT NULL,
    status ENUM('pending', 'accepted', 'expired', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_token (token),
    INDEX idx_email (invited_email),
    INDEX idx_status (status),
    INDEX idx_expires_at (expires_at),
    FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (box_id) REFERENCES boxes(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const USERS_ALTER = `
  ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS reset_token_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS reset_token_expiry DATETIME,
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
`;

async function runMigration() {
  const sql = db.promise();

  try {
    console.log('Starting database migration for OTP and Invite tables...');

    // Create OTP table
    console.log('Creating otps table...');
    await sql.query(OTP_TABLE);
    console.log('✓ otps table created successfully');

    // Create Invite table
    console.log('Creating invites table...');
    await sql.query(INVITE_TABLE);
    console.log('✓ invites table created successfully');

    // Alter users table
    console.log('Altering users table...');
    await sql.query(USERS_ALTER);
    console.log('✓ users table altered successfully');

    console.log('\n✅ Database migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
