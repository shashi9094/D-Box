require('dotenv').config();
const { Pool } = require('pg');

const connectionString = String(
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.PG_CONNECTION_STRING ||
    ''
).trim();

const parseBoolean = (value, fallback = false) => {
    if (value === undefined || value === null || value === '') return fallback;
    return ['1', 'true', 'yes', 'required', 'on'].includes(String(value).trim().toLowerCase());
};

const parseBooleanNegated = (value, fallback = false) => {
    if (value === undefined || value === null || value === '') return fallback;
    return !['0', 'false', 'no', 'off'].includes(String(value).trim().toLowerCase());
};

const isProduction = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
const dbSslEnabled = (() => {
    if (process.env.DB_SSL !== undefined) {
        return parseBoolean(process.env.DB_SSL, false);
    }

    if (process.env.PGSSLMODE) {
        return !['disable', 'allow', 'prefer'].includes(String(process.env.PGSSLMODE).trim().toLowerCase());
    }

    return isProduction || Boolean(connectionString);
})();

const dbSslRejectUnauthorized = parseBooleanNegated(process.env.DB_SSL_REJECT_UNAUTHORIZED, false);

const poolConfig = connectionString
    ? {
        connectionString,
        max: Number(process.env.DB_POOL_SIZE || 10),
        idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
        connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000),
        ssl: dbSslEnabled
            ? {
                rejectUnauthorized: dbSslRejectUnauthorized
            }
            : false,
    }
    : {
        host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
        user: process.env.PGUSER || process.env.DB_USER || 'postgres',
        password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
        database: process.env.PGDATABASE || process.env.DB_NAME || 'dbox',
        port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
        max: Number(process.env.DB_POOL_SIZE || 10),
        idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
        connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000),
        ssl: dbSslEnabled
            ? {
                rejectUnauthorized: dbSslRejectUnauthorized
            }
            : false,
    };

const pool = new Pool(poolConfig);

const translatePlaceholders = (sqlText) => {
    let index = 0;
    return String(sqlText || '').replace(/\?/g, () => `$${++index}`);
};

const isReadQuery = (command, sqlText) => {
    const safeCommand = String(command || '').toUpperCase();
    if (safeCommand === 'SELECT' || safeCommand === 'WITH') {
        return true;
    }

    return /^\s*(SELECT|WITH)\b/i.test(String(sqlText || ''));
};

const normalizeWriteResult = (result) => {
    const firstRow = Array.isArray(result.rows) ? result.rows[0] : null;
    const firstId = firstRow && Object.prototype.hasOwnProperty.call(firstRow, 'id')
        ? firstRow.id
        : firstRow && Object.prototype.hasOwnProperty.call(firstRow, 'insertId')
            ? firstRow.insertId
            : null;

    return {
        command: result.command,
        rowCount: Number(result.rowCount || 0),
        affectedRows: Number(result.rowCount || 0),
        insertId: firstId === null || firstId === undefined ? null : Number(firstId) || firstId,
        rows: Array.isArray(result.rows) ? result.rows : []
    };
};

const executeQuery = async (sqlText, values = []) => {
    const translatedSql = translatePlaceholders(sqlText);
    const queryValues = Array.isArray(values) ? values : [values];
    const result = await pool.query(translatedSql, queryValues);

    if (isReadQuery(result.command, sqlText)) {
        return [result.rows, result.fields];
    }

    return [normalizeWriteResult(result), result.fields];
};

const query = (sqlText, values, callback) => {
    let params = values;
    let done = callback;

    if (typeof values === 'function') {
        done = values;
        params = [];
    }

    const promise = executeQuery(sqlText, params);

    if (typeof done === 'function') {
        promise
            .then(([rowsOrResult, fields]) => done(null, rowsOrResult, fields))
            .catch((error) => done(error));
        return undefined;
    }

    return promise;
};

async function ensureCoreTables() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
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
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS boxes (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT NULL,
            capacity INT NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query('CREATE INDEX IF NOT EXISTS idx_boxes_user_id ON boxes(user_id)');
}

const promise = () => ({
    query: executeQuery,
    end: () => pool.end(),
});

const end = () => pool.end();

pool.query('SELECT 1')
    .then(() => ensureCoreTables())
    .then(() => {
        console.log('Database connected successfully.');
        console.log('Core tables are ready.');
    })
    .catch((error) => {
        console.error('Database connection failed:', {
            code: error.code,
            message: error.message,
            host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
            database: process.env.PGDATABASE || process.env.DB_NAME || 'dbox'
        });
    });

module.exports = {
    query,
    promise,
    end,
    getConnection: (callback) => {
        pool.connect()
            .then((client) => {
                client.release();
                callback(null, {
                    release: () => {}
                });
            })
            .catch((error) => callback(error));
    }
};