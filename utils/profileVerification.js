const db = require('../db/connection');

function toBoolean(value) {
    if (typeof value === 'boolean') {
        return value;
    }

    if (value === 1 || value === '1' || value === 't' || value === 'true') {
        return true;
    }

    return false;
}

function isProfileCompleteRow(row) {
    if (!row) {
        return false;
    }

    const dob = String(row.dob || '').trim();
    const country = String(row.country || '').trim();
    const capacity = String(row.capacity || '').trim();
    const purpose = String(row.purpose || '').trim();
    const explicitFlag = row.isprofilecomplete ?? row.isProfileComplete;

    if (typeof explicitFlag === 'boolean') {
        return explicitFlag;
    }

    if (explicitFlag === 1 || explicitFlag === 't' || explicitFlag === 'true') {
        return true;
    }

    return Boolean(dob && country && capacity && purpose);
}

function normalizeAuthState(row) {
    if (!row) {
        return null;
    }

    const isVerified = toBoolean(row.is_verified ?? row.isVerified);
    const isProfileComplete = toBoolean(row.isprofilecomplete ?? row.isProfileComplete);

    return {
        id: Number(row.id),
        email: String(row.email || '').trim().toLowerCase(),
        fullName: String(row.fullName || row.fullname || '').trim(),
        googleid: String(row.googleid || row.googleId || '').trim() || null,
        dob: row.dob ?? null,
        country: row.country ?? null,
        capacity: row.capacity ?? null,
        purpose: row.purpose ?? null,
        role: String(row.role || 'User'),
        isVerified,
        isProfileComplete,
        profilePending: !isVerified,
        verificationOtp: String(row.verification_otp || '').trim() || null,
        otpExpires: row.otp_expires ?? null,
    };
}

function buildSessionUser(authState, extra = {}) {
    if (!authState) {
        return null;
    }

    return {
        id: Number(authState.id),
        email: String(authState.email || '').trim().toLowerCase(),
        fullName: String(authState.fullName || '').trim(),
        googleid: authState.googleid || null,
        dob: authState.dob ?? null,
        country: authState.country ?? null,
        capacity: authState.capacity ?? null,
        purpose: authState.purpose ?? null,
        role: String(authState.role || 'User'),
        isVerified: Boolean(authState.isVerified),
        isProfileComplete: Boolean(authState.isProfileComplete),
        profilePending: Boolean(authState.profilePending),
        ...extra,
    };
}

async function getUserAuthStateById(userId) {
    const numericUserId = Number(userId);

    if (!Number.isFinite(numericUserId) || numericUserId <= 0) {
        return null;
    }

    const [rows] = await db.promise().query(
        `SELECT id, fullname AS "fullName", email, googleid, dob, country, capacity, purpose, role,
                is_verified, isprofilecomplete, verification_otp, otp_expires
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [numericUserId]
    );

    return normalizeAuthState(rows[0] || null);
}

module.exports = {
    buildSessionUser,
    getUserAuthStateById,
    isProfileCompleteRow,
    normalizeAuthState,
    toBoolean,
};