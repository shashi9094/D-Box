require('dotenv').config();
const mysql = require('mysql2');

const dbSslEnabled = ['1', 'true', 'yes', 'required'].includes(
    String(process.env.DB_SSL || '').trim().toLowerCase()
);

const dbSslRejectUnauthorized = !['0', 'false', 'no'].includes(
    String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true').trim().toLowerCase()
);

const dbSslCaFromText = String(process.env.DB_SSL_CA || '').trim();
const dbSslCaFromBase64 = String(process.env.DB_SSL_CA_BASE64 || '').trim();

const resolveDbSslCa = () => {
    if (dbSslCaFromBase64) {
        try {
            return Buffer.from(dbSslCaFromBase64, 'base64').toString('utf8');
        } catch (_) {
            return '';
        }
    }

    if (!dbSslCaFromText) return '';
    return dbSslCaFromText.replace(/\\n/g, '\n');
};

const dbSslCa = resolveDbSslCa();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'dbox',
    port: Number(process.env.DB_PORT || 3306),
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: dbSslEnabled
        ? {
            rejectUnauthorized: dbSslRejectUnauthorized,
            ca: dbSslCa || undefined
        }
        : undefined
});

async function ensureCoreTables() {
    const sql = pool.promise();

    await sql.query(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            fullName VARCHAR(255) NOT NULL,
            dob DATE NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            country VARCHAR(100) NULL,
            capacity VARCHAR(100) NULL,
            purpose VARCHAR(255) NULL,
            role ENUM('User','Admin') NOT NULL DEFAULT 'User',
            password VARCHAR(255) NOT NULL,
            profilePhoto VARCHAR(1000) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    try {
        await sql.query("ALTER TABLE users ADD COLUMN role ENUM('User','Admin') NOT NULL DEFAULT 'User' AFTER purpose");
    } catch (alterErr) {
        if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
            throw alterErr;
        }
    }

    try {
        await sql.query('ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER password');
    } catch (alterErr) {
        if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
            throw alterErr;
        }
    }

    try {
        await sql.query('ALTER TABLE users ADD COLUMN profilePhoto VARCHAR(1000) NULL AFTER created_at');
    } catch (alterErr) {
        if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
            throw alterErr;
        }
    }

    await sql.query(`
        CREATE TABLE IF NOT EXISTS boxes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT NULL,
            capacity INT NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_boxes_user_id (user_id),
            CONSTRAINT boxes_ibfk_1 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    try {
        await sql.query('ALTER TABLE boxes ADD COLUMN capacity INT NOT NULL DEFAULT 1 AFTER description');
    } catch (alterErr) {
        if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
            throw alterErr;
        }
    }
}

// Validate connection once on startup for faster error feedback.
pool.getConnection((err, conn) => {
    if (err) {
        console.error('Database connection failed:', {
            code: err.code,
            errno: err.errno,
            sqlMessage: err.sqlMessage,
            host: process.env.DB_HOST || 'localhost',
            database: process.env.DB_NAME || 'dbox'
        });
        return;
    }

    conn.release();
    console.log('Database connected successfully.');

    ensureCoreTables()
        .then(() => {
            console.log('Core tables are ready.');
        })
        .catch((tableErr) => {
            console.error('Core table setup failed:', {
                code: tableErr.code,
                errno: tableErr.errno,
                sqlMessage: tableErr.sqlMessage
            });
        });
});

module.exports = pool;