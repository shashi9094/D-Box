import pool from './connection.js';
import { initializeTables } from './schema.js';

async function migrate() {
  try {
    console.log('🔧 Starting database migration...');
    
    await pool.query(initializeTables);
    
    console.log('✅ Database migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
