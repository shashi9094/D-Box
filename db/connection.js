require('dotenv').config();
const mysql = require('mysql2');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'dbox',
    port: Number(process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
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