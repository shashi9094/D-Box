require('dotenv').config();
const { Pool } = require('pg');

const connectionString = String(process.env.DATABASE_URL || '').trim();
const connectionTimeoutMillis = Number(process.env.PG_CONNECT_TIMEOUT_MS || 10000);

if (!connectionString) {
    console.error('❌ DATABASE_URL is not set. PostgreSQL connection will fail until this is configured.');
}

const getConnectionTarget = () => {
    if (connectionString && connectionString.includes('@')) {
        return connectionString.split('@')[1];
    }

    const host = process.env.PGHOST || 'localhost';
    const port = process.env.PGPORT || '5432';
    const db = process.env.PGDATABASE || process.env.DB_NAME || 'dbox';
    return `${host}:${port}/${db}`;
};

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis
});

pool.on('error', (error) => {
    console.error('❌ PostgreSQL pool error:', {
        code: error && error.code,
        message: (error && error.message) || 'Unknown pool error'
    });
});

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
            fullname TEXT NOT NULL,
            dob DATE NULL,
            email TEXT NOT NULL UNIQUE,
            country TEXT NULL,
            googleid TEXT NULL UNIQUE,
            capacity TEXT NULL,
            purpose TEXT NULL,
            role TEXT NULL DEFAULT 'User',
            password TEXT NOT NULL,
            is_verified BOOLEAN NOT NULL DEFAULT FALSE,
            isprofilecomplete BOOLEAN NOT NULL DEFAULT FALSE,
            verification_otp VARCHAR(6) NULL,
            otp_expires TIMESTAMP NULL,
            profilephoto TEXT NULL,
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

async function ensureUsersOAuthSchema() {
    const columnResult = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'users'
    `);

    const columnRows = Array.isArray(columnResult.rows) ? columnResult.rows : [];
    const columnNames = new Set(columnRows.map((row) => String(row.column_name || '')));
    const renameOrDropLegacyColumn = async (legacyName, canonicalName) => {
        const hasLegacy = columnNames.has(legacyName);
        const hasCanonical = columnNames.has(canonicalName);

        if (hasLegacy && !hasCanonical) {
            await pool.query(`ALTER TABLE users RENAME COLUMN "${legacyName}" TO ${canonicalName}`);
            columnNames.delete(legacyName);
            columnNames.add(canonicalName);
            return;
        }

        if (hasLegacy && hasCanonical) {
            await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS "${legacyName}"`);
            columnNames.delete(legacyName);
        }
    };

    await renameOrDropLegacyColumn('fullName', 'fullname');
    await renameOrDropLegacyColumn('googleId', 'googleid');
    await renameOrDropLegacyColumn('profilePhoto', 'profilephoto');
    await renameOrDropLegacyColumn('isProfileComplete', 'isprofilecomplete');

    await pool.query('ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS fullname TEXT NULL');
    await pool.query('ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS googleid TEXT NULL');
    await pool.query('ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS profilephoto TEXT NULL');
    await pool.query('ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS isprofilecomplete BOOLEAN NOT NULL DEFAULT FALSE');
    await pool.query('ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE');
    await pool.query('ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS verification_otp VARCHAR(6) NULL');
    await pool.query('ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS otp_expires TIMESTAMP NULL');
    await pool.query('ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS verification_otp_attempts INT NOT NULL DEFAULT 0');
    await pool.query('ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS verification_otp_sent_at TIMESTAMP NULL');
    await pool.query('ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS reset_otp VARCHAR(6) NULL');
    await pool.query('ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS reset_otp_expires TIMESTAMP NULL');
    await pool.query('ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS reset_otp_attempts INT NOT NULL DEFAULT 0');
    await pool.query('ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS reset_otp_sent_at TIMESTAMP NULL');
    await pool.query("ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS status TEXT NULL DEFAULT 'active'");
    await pool.query('ALTER TABLE IF EXISTS users DROP COLUMN IF EXISTS verification_token');
    await pool.query('ALTER TABLE IF EXISTS users DROP COLUMN IF EXISTS token_expires');
    await pool.query(`
        UPDATE users
        SET password = 'google_auth'
        WHERE password IS NULL
    `);
    await pool.query('ALTER TABLE IF EXISTS users ALTER COLUMN password SET DEFAULT \'google_auth\'');
    await pool.query('ALTER TABLE IF EXISTS users ALTER COLUMN password SET NOT NULL');
    await pool.query('ALTER TABLE IF EXISTS users ALTER COLUMN capacity DROP NOT NULL');
    await pool.query('ALTER TABLE IF EXISTS users ALTER COLUMN purpose DROP NOT NULL');
    await pool.query('ALTER TABLE IF EXISTS users ALTER COLUMN role DROP NOT NULL');
    await pool.query('ALTER TABLE IF EXISTS users ALTER COLUMN is_verified SET DEFAULT FALSE');
    await pool.query('ALTER TABLE IF EXISTS users ALTER COLUMN isprofilecomplete SET DEFAULT FALSE');
    await pool.query('ALTER TABLE IF EXISTS users ALTER COLUMN verification_otp_attempts SET DEFAULT 0');
    await pool.query('ALTER TABLE IF EXISTS users ALTER COLUMN reset_otp_attempts SET DEFAULT 0');
    await pool.query('UPDATE users SET verification_otp_attempts = COALESCE(verification_otp_attempts, 0)');
    await pool.query('UPDATE users SET reset_otp_attempts = COALESCE(reset_otp_attempts, 0)');
    await pool.query('UPDATE users SET isprofilecomplete = COALESCE(isprofilecomplete, FALSE)');

    const duplicateGoogleIdsResult = await pool.query(`
        SELECT googleid
        FROM users
        WHERE googleid IS NOT NULL AND googleid <> ''
        GROUP BY googleid
        HAVING COUNT(*) > 1
        LIMIT 1
    `);

    const duplicateGoogleIds = Array.isArray(duplicateGoogleIdsResult.rows) ? duplicateGoogleIdsResult.rows : [];

    if (!duplicateGoogleIds.length) {
        await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_googleid ON users(googleid)');
    } else {
        console.warn('Skipping unique googleid index because duplicate googleid values already exist.');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_users_googleid ON users(googleid)');
    }
}

const promise = () => ({
    query: executeQuery,
    end: () => pool.end(),
});

const end = () => pool.end();

pool.connect()
    .then((client) => {
        client.release();
        console.log('✅ PostgreSQL connected');
        return ensureCoreTables();
    })
    .then(() => ensureUsersOAuthSchema())
    .then(() => {
        console.log('✅ Core tables are ready.');
    })
    .catch((error) => {
        const target = getConnectionTarget();
        console.error('❌ Database connection failed:', error.message || 'Connection refused');
        console.error('DB connection details:', {
            code: error && error.code,
            target,
            hasDatabaseUrl: Boolean(connectionString)
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

// Export the raw pg Pool so it can be reused (eg. by session store)
module.exports.pool = pool;