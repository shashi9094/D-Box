/**
 * Database Migration Script - Admin Invites
 * Creates admin_invites table for admin invitation system
 * Handles secure token-based admin user registration
 */

const db = require('../db/connection');

async function runMigration() {
  try {
    console.log('🔄 Starting Admin Invites migration...');

    const sql = db.promise();

    // Create admin_invites table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS admin_invites (
        id SERIAL PRIMARY KEY,
        token_hash VARCHAR(255) NOT NULL UNIQUE,
        plain_token VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK(role IN ('admin', 'manager', 'employee')),
        invited_by_user_id INTEGER NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        is_used BOOLEAN DEFAULT FALSE,
        used_at TIMESTAMP NULL,
        used_by_user_id INTEGER NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT fk_invited_by 
          FOREIGN KEY (invited_by_user_id) 
          REFERENCES users(id) ON DELETE CASCADE,
        
        CONSTRAINT fk_used_by 
          FOREIGN KEY (used_by_user_id) 
          REFERENCES users(id) ON DELETE SET NULL
      );
    `;

    // Create indexes for performance
    const createIndexesQuery = `
      CREATE INDEX IF NOT EXISTS idx_admin_invites_token_hash ON admin_invites(token_hash);
      CREATE INDEX IF NOT EXISTS idx_admin_invites_email ON admin_invites(email);
      CREATE INDEX IF NOT EXISTS idx_admin_invites_expires_at ON admin_invites(expires_at);
      CREATE INDEX IF NOT EXISTS idx_admin_invites_is_used ON admin_invites(is_used);
      CREATE INDEX IF NOT EXISTS idx_admin_invites_invited_by ON admin_invites(invited_by_user_id);
    `;

    // Add role column to users table if it doesn't exist
    const addRoleColumnQuery = `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) 
      DEFAULT 'employee' 
      CHECK(role IN ('admin', 'manager', 'employee'));
    `;

    // Add is_admin column to users table if it doesn't exist (for backward compatibility)
    const addIsAdminColumnQuery = `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
    `;

    // Execute migrations
    console.log('📋 Creating admin_invites table...');
    await sql.query(createTableQuery);
    console.log('✅ admin_invites table created');

    console.log('📇 Creating indexes...');
    await sql.query(createIndexesQuery);
    console.log('✅ Indexes created');

    console.log('👤 Adding role column to users table...');
    await sql.query(addRoleColumnQuery);
    console.log('✅ Role column added to users table');

    console.log('👤 Adding is_admin column to users table...');
    await sql.query(addIsAdminColumnQuery);
    console.log('✅ is_admin column added to users table');

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 New Tables/Columns:');
    console.log('   - admin_invites table (with token_hash, email, role, expiry)');
    console.log('   - users.role column (admin, manager, employee)');
    console.log('   - users.is_admin column (boolean for backward compatibility)');
    console.log('\n💡 Next steps:');
    console.log('   1. Restart your server');
    console.log('   2. Test admin invite endpoints');
    console.log('   3. Check README for integration steps');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run migration
runMigration();
