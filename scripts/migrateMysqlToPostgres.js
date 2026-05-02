require('dotenv').config();

const mysql = require('mysql2/promise');
const { Pool } = require('pg');

const requiredMysqlVars = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE'];

const missingMysqlVars = requiredMysqlVars.filter((key) => !String(process.env[key] || '').trim());

if (missingMysqlVars.length) {
  console.error(`Missing MySQL env vars: ${missingMysqlVars.join(', ')}`);
  process.exit(1);
}

const mysqlConfig = {
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE,
  ssl: String(process.env.MYSQL_SSL || '').toLowerCase() === 'true'
    ? { rejectUnauthorized: String(process.env.MYSQL_SSL_REJECT_UNAUTHORIZED || 'false').toLowerCase() === 'true' }
    : undefined,
};

const pgConfig = {
  connectionString: String(process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim() || undefined,
  host: process.env.PGHOST || undefined,
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || undefined,
  password: process.env.PGPASSWORD || undefined,
  database: process.env.PGDATABASE || undefined,
  ssl: String(process.env.PGSSL || '').toLowerCase() === 'true'
    ? { rejectUnauthorized: String(process.env.PGSSL_REJECT_UNAUTHORIZED || 'false').toLowerCase() === 'true' }
    : false,
};

const sourceTables = [
  'users',
  'boxes',
  'box_members',
  'box_invites',
  'box_contents',
  'box_files',
  'notifications',
  'login_history',
];

const pgSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      fullName TEXT NOT NULL,
      dob DATE NULL,
      email TEXT NOT NULL UNIQUE,
      country TEXT NULL,
      capacity TEXT NULL,
      purpose TEXT NULL,
      role TEXT NOT NULL DEFAULT 'User',
      password TEXT NOT NULL,
      profilePhoto TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT users_role_check CHECK (role IN ('User', 'Admin'))
    )`,
  `CREATE TABLE IF NOT EXISTS boxes (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NULL,
      capacity INT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  `CREATE TABLE IF NOT EXISTS box_members (
      id BIGSERIAL PRIMARY KEY,
      box_id BIGINT NOT NULL,
      user_id BIGINT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      added_by BIGINT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT box_members_role_check CHECK (role IN ('admin', 'member')),
      UNIQUE (box_id, user_id)
    )`,
  `CREATE TABLE IF NOT EXISTS box_invites (
      id BIGSERIAL PRIMARY KEY,
      box_id BIGINT NOT NULL,
      email VARCHAR(255) NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      invited_by BIGINT NOT NULL,
      invite_token VARCHAR(128) NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      accepted_by BIGINT NULL,
      accepted_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT box_invites_role_check CHECK (role IN ('admin', 'member')),
      CONSTRAINT box_invites_status_check CHECK (status IN ('pending', 'accepted', 'revoked')),
      UNIQUE (box_id, email, status)
    )`,
  `CREATE TABLE IF NOT EXISTS box_contents (
      id BIGSERIAL PRIMARY KEY,
      box_id BIGINT NOT NULL,
      uploaded_by BIGINT NOT NULL,
      content_type TEXT NOT NULL DEFAULT 'file',
      file_name VARCHAR(255) NULL,
      file_path VARCHAR(500) NULL,
      original_name VARCHAR(255) NULL,
      note_text TEXT NULL,
      admin_note VARCHAR(300) NULL,
      folder_path VARCHAR(500) NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT box_contents_content_type_check CHECK (content_type IN ('file', 'note', 'video'))
    )`,
  `CREATE TABLE IF NOT EXISTS box_files (
      id BIGSERIAL PRIMARY KEY,
      box_id BIGINT NOT NULL,
      user_id BIGINT NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_size BIGINT NOT NULL,
      file_type VARCHAR(128) NOT NULL,
      file_path VARCHAR(1024) NULL,
      uploaded_at TIMESTAMPTZ NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT box_files_ibfk_1 FOREIGN KEY (box_id) REFERENCES boxes(id) ON DELETE CASCADE
    )`,
  `CREATE TABLE IF NOT EXISTS notifications (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      type VARCHAR(80) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      details_json TEXT NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  `CREATE TABLE IF NOT EXISTS login_history (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      email VARCHAR(255) NOT NULL,
      login_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ip_address VARCHAR(100) NULL,
      user_agent TEXT NULL,
      device_type VARCHAR(50) NULL,
      browser VARCHAR(100) NULL,
      os VARCHAR(100) NULL
    )`,
  `CREATE INDEX IF NOT EXISTS idx_boxes_user_id ON boxes(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read)`,
  `CREATE INDEX IF NOT EXISTS idx_login_history_user_login_at ON login_history(user_id, login_at)`,
];

const fieldListForTable = async (mysqlConnection, tableName) => {
  const [rows] = await mysqlConnection.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [process.env.MYSQL_DATABASE, tableName]
  );

  return rows.map((row) => row.COLUMN_NAME);
};

const copyTable = async ({ mysqlConnection, pgPool, tableName, columnMap, orderBy = 'id' }) => {
  const availableColumns = await fieldListForTable(mysqlConnection, tableName);
  if (!availableColumns.length) {
    console.log(`[skip] ${tableName} not found in source database`);
    return;
  }

  const selectedColumns = columnMap.filter(({ source }) => availableColumns.includes(source));
  if (!selectedColumns.length) {
    console.log(`[skip] ${tableName} has no matching columns to copy`);
    return;
  }

  const sourceSelect = selectedColumns.map(({ source }) => `\`${source}\``).join(', ');
  const [rows] = await mysqlConnection.query(`SELECT ${sourceSelect} FROM \`${tableName}\` ORDER BY \`${orderBy}\``);

  if (!rows.length) {
    console.log(`[skip] ${tableName} is empty`);
    return;
  }

  const targetColumns = selectedColumns.map(({ target }) => target);
  const placeholders = targetColumns.map((_, index) => `$${index + 1}`).join(', ');
  const conflictTarget = tableName === 'users' ? 'id' : 'id';

  for (const row of rows) {
    const values = selectedColumns.map(({ source, transform }) => {
      const value = row[source];
      return transform ? transform(value, row) : value;
    });

    const assignments = targetColumns
      .filter((column) => column !== 'id')
      .map((column, index) => `${column} = EXCLUDED.${column}`)
      .join(', ');

    const sql = `
      INSERT INTO ${tableName} (${targetColumns.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT (${conflictTarget}) DO UPDATE SET
        ${assignments || 'id = EXCLUDED.id'}
    `;

    await pgPool.query(sql, values);
  }

  console.log(`[copied] ${tableName}: ${rows.length} row(s)`);
};

const main = async () => {
  const mysqlConnection = await mysql.createConnection(mysqlConfig);
  const pgPool = new Pool(pgConfig);

  try {
    for (const statement of pgSchemaStatements) {
      await pgPool.query(statement);
    }

    const tablePlans = [
      {
        tableName: 'users',
        columnMap: [
          { source: 'id', target: 'id' },
          { source: 'fullName', target: 'fullName' },
          { source: 'dob', target: 'dob' },
          { source: 'email', target: 'email', transform: (value) => String(value || '').trim().toLowerCase() },
          { source: 'country', target: 'country' },
          { source: 'capacity', target: 'capacity' },
          { source: 'purpose', target: 'purpose' },
          { source: 'role', target: 'role', transform: (value) => (String(value || '').toLowerCase() === 'admin' ? 'Admin' : 'User') },
          { source: 'password', target: 'password' },
          { source: 'profilePhoto', target: 'profilePhoto' },
          { source: 'created_at', target: 'created_at' },
        ],
      },
      {
        tableName: 'boxes',
        columnMap: [
          { source: 'id', target: 'id' },
          { source: 'user_id', target: 'user_id' },
          { source: 'title', target: 'title' },
          { source: 'description', target: 'description' },
          { source: 'capacity', target: 'capacity' },
          { source: 'created_at', target: 'created_at' },
        ],
      },
      {
        tableName: 'box_members',
        columnMap: [
          { source: 'id', target: 'id' },
          { source: 'box_id', target: 'box_id' },
          { source: 'user_id', target: 'user_id' },
          { source: 'role', target: 'role', transform: (value) => (String(value || '').toLowerCase() === 'admin' ? 'admin' : 'member') },
          { source: 'added_by', target: 'added_by' },
          { source: 'created_at', target: 'created_at' },
        ],
      },
      {
        tableName: 'box_invites',
        columnMap: [
          { source: 'id', target: 'id' },
          { source: 'box_id', target: 'box_id' },
          { source: 'email', target: 'email', transform: (value) => String(value || '').trim().toLowerCase() },
          { source: 'role', target: 'role', transform: (value) => (String(value || '').toLowerCase() === 'admin' ? 'admin' : 'member') },
          { source: 'invited_by', target: 'invited_by' },
          { source: 'invite_token', target: 'invite_token' },
          { source: 'status', target: 'status', transform: (value) => {
            const normalized = String(value || '').toLowerCase();
            return ['accepted', 'revoked'].includes(normalized) ? normalized : 'pending';
          } },
          { source: 'accepted_by', target: 'accepted_by' },
          { source: 'accepted_at', target: 'accepted_at' },
          { source: 'created_at', target: 'created_at' },
        ],
      },
      {
        tableName: 'box_contents',
        columnMap: [
          { source: 'id', target: 'id' },
          { source: 'box_id', target: 'box_id' },
          { source: 'uploaded_by', target: 'uploaded_by' },
          { source: 'content_type', target: 'content_type', transform: (value) => {
            const normalized = String(value || '').toLowerCase();
            return ['note', 'video'].includes(normalized) ? normalized : 'file';
          } },
          { source: 'file_name', target: 'file_name' },
          { source: 'file_path', target: 'file_path' },
          { source: 'original_name', target: 'original_name' },
          { source: 'note_text', target: 'note_text' },
          { source: 'admin_note', target: 'admin_note' },
          { source: 'folder_path', target: 'folder_path' },
          { source: 'created_at', target: 'created_at' },
        ],
      },
      {
        tableName: 'box_files',
        columnMap: [
          { source: 'id', target: 'id' },
          { source: 'box_id', target: 'box_id' },
          { source: 'user_id', target: 'user_id' },
          { source: 'file_name', target: 'file_name' },
          { source: 'file_size', target: 'file_size' },
          { source: 'file_type', target: 'file_type' },
          { source: 'file_path', target: 'file_path' },
          { source: 'uploaded_at', target: 'uploaded_at' },
        ],
      },
      {
        tableName: 'notifications',
        columnMap: [
          { source: 'id', target: 'id' },
          { source: 'user_id', target: 'user_id' },
          { source: 'type', target: 'type' },
          { source: 'title', target: 'title' },
          { source: 'message', target: 'message' },
          { source: 'details_json', target: 'details_json' },
          { source: 'is_read', target: 'is_read', transform: (value) => Boolean(Number(value)) },
          { source: 'created_at', target: 'created_at' },
        ],
      },
      {
        tableName: 'login_history',
        columnMap: [
          { source: 'id', target: 'id' },
          { source: 'user_id', target: 'user_id' },
          { source: 'email', target: 'email' },
          { source: 'login_at', target: 'login_at' },
          { source: 'ip_address', target: 'ip_address' },
          { source: 'user_agent', target: 'user_agent' },
          { source: 'device_type', target: 'device_type' },
          { source: 'browser', target: 'browser' },
          { source: 'os', target: 'os' },
        ],
      },
    ];

    for (const plan of tablePlans) {
      await copyTable({ mysqlConnection, pgPool, ...plan });
    }

    for (const tableName of sourceTables) {
      const [rows] = await mysqlConnection.query(`SELECT COUNT(*) AS total FROM \`${tableName}\``).catch(() => [[{ total: 0 }]]);
      console.log(`[source] ${tableName}: ${Number(rows?.[0]?.total || 0)} row(s)`);
    }

    console.log('Migration completed successfully.');
  } finally {
    await mysqlConnection.end();
    await pgPool.end();
  }
};

main().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exitCode = 1;
});