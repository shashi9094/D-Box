require('dotenv').config();
const mysql = require('mysql2');

const dbSslEnabled = ['1', 'true', 'yes', 'required'].includes(
    String(process.env.DB_SSL || '').trim().toLowerCase()
);

const dbSslRejectUnauthorized = !['0', 'false', 'no'].includes(
    String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true').trim().toLowerCase()
);

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
            rejectUnauthorized: dbSslRejectUnauthorized
        }
        : undefined
});

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
});

module.exports = pool;