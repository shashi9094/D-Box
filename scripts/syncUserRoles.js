require('dotenv').config();
const db = require('../db/connection');

(async () => {
  const sql = db.promise();

  try {
    await sql.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'User'");
  } catch (_) {
    // Column may already exist.
  }

  await sql.query("UPDATE users u SET role = 'Admin' WHERE EXISTS (SELECT 1 FROM boxes b WHERE b.user_id = u.id)");
  await sql.query("UPDATE users u SET role = 'User' WHERE NOT EXISTS (SELECT 1 FROM boxes b WHERE b.user_id = u.id)");

  const [rows] = await sql.query('SELECT id, fullName, email, role FROM users ORDER BY id DESC LIMIT 20');
  console.table(rows);

  await sql.end();
})().catch((error) => {
  console.error('SYNC_ERROR', error.code || '', error.message);
  process.exit(1);
});
