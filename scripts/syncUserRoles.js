require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'dbox',
    port: Number(process.env.DB_PORT || 3306)
  });

  try {
    await connection.query("ALTER TABLE users ADD COLUMN role ENUM('User','Admin') NOT NULL DEFAULT 'User' AFTER purpose");
  } catch (_) {
    // Column may already exist.
  }

  await connection.query("UPDATE users u SET role = 'Admin' WHERE EXISTS (SELECT 1 FROM boxes b WHERE b.user_id = u.id)");
  await connection.query("UPDATE users u SET role = 'User' WHERE NOT EXISTS (SELECT 1 FROM boxes b WHERE b.user_id = u.id)");

  const [rows] = await connection.query('SELECT id, fullName, email, role FROM users ORDER BY id DESC LIMIT 20');
  console.table(rows);

  await connection.end();
})().catch((error) => {
  console.error('SYNC_ERROR', error.code || '', error.message);
  process.exit(1);
});
