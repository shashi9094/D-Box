const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const db = require("../db/connection");
const { loadGoogleOAuthConfig } = require("../utils/googleOAuthConfig");
const { GOOGLE_AUTH_PASSWORD } = require("../utils/passwordAuth");

const googleConfig = loadGoogleOAuthConfig();
const { clientID, clientSecret, callbackURL } = googleConfig;

function normalizeUserRow(row, fallbackName, fallbackEmail, fallbackGoogleId) {
  return {
    id: Number(row?.id),
    email: String(row?.email || fallbackEmail || '').trim().toLowerCase(),
    fullName: String(row?.fullName || row?.fullname || fallbackName || '').trim(),
    googleid: String(row?.googleid || fallbackGoogleId || '').trim() || null,
    dob: row?.dob ?? null,
    country: row?.country ?? null,
    capacity: row?.capacity ?? null,
    purpose: row?.purpose ?? null,
    role: String(row?.role || 'User'),
    isProfileComplete: Boolean(row?.isprofilecomplete ?? row?.isProfileComplete),
  };
}

if (googleConfig.enabled) {
  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
      },
      async (accessToken, refreshToken, profile, done) => {
        const email = String(profile?.emails?.[0]?.value || '').trim().toLowerCase();
        const name = String(profile?.displayName || '').trim() || email;
        const googleId = String(profile?.id || '').trim();

        if (!email || !googleId) {
          return done(new Error('Google profile is missing email or Google ID'));
        }

        try {
          const sql = db.promise();
          const [existingRows] = await sql.query(
            `SELECT id, fullname AS "fullName", email, password, googleid, dob, country, capacity, purpose, role, isprofilecomplete
             FROM users
             WHERE LOWER(email) = LOWER(?) OR googleid = ?
             ORDER BY CASE
               WHEN googleid = ? THEN 0
               WHEN LOWER(email) = LOWER(?) THEN 1
               ELSE 2
             END
             LIMIT 1`,
            [email, googleId, googleId, email]
          );

          if (existingRows.length > 0) {
            const existing = existingRows[0];
            if (!existing.googleid || existing.password !== GOOGLE_AUTH_PASSWORD) {
              await sql.query('UPDATE users SET googleid = ?, password = ?, is_verified = TRUE WHERE id = ?', [googleId, GOOGLE_AUTH_PASSWORD, existing.id]);
              existing.googleid = googleId;
              existing.password = GOOGLE_AUTH_PASSWORD;
              existing.is_verified = true;
            }

            return done(null, normalizeUserRow(existing, name, email, googleId));
          }

          const [insertResult] = await sql.query(
            `INSERT INTO users
             (fullname, email, googleid, password, is_verified)
             VALUES (?, ?, ?, ?, TRUE)
             ON CONFLICT (email)
             DO UPDATE SET
               googleid = COALESCE(users.googleid, EXCLUDED.googleid),
               fullname = COALESCE(NULLIF(users.fullname, ''), EXCLUDED.fullname),
               password = EXCLUDED.password,
               is_verified = COALESCE(users.is_verified, TRUE)
             RETURNING id, fullname AS "fullName", email, googleid, dob, country, capacity, purpose, role, isprofilecomplete`,
            [name, email, googleId, GOOGLE_AUTH_PASSWORD]
          );

          const created = insertResult.rows?.[0] || insertResult;

          return done(null, normalizeUserRow(created, name, email, googleId));
        } catch (error) {
          console.error('GOOGLE AUTH ERROR:', {
            code: error.code || null,
            message: error.message || null,
            detail: error.detail || null,
            constraint: error.constraint || null,
            table: error.table || null,
          });
          return done(error);
        }
      }
    )
  );
} else {
  console.warn(
    `Google OAuth is disabled. source=${googleConfig.source} clientId=${googleConfig.maskedClientId} validClientId=${googleConfig.validClientIdFormat} hasSecret=${googleConfig.hasClientSecret} callbackURL=${callbackURL}`
  );
}

passport.serializeUser((user, done) => {
  done(null, Number(user?.id));
});

passport.deserializeUser(async (id, done) => {
  try {
    const userId = Number(id);

    if (!Number.isFinite(userId) || userId <= 0) {
      console.warn('deserializeUser: invalid userId', id);
      return done(null, false);
    }

    let rows = [];
    try {
      // Try fetching with isprofilecomplete column (new schema)
      [rows] = await db.promise().query(
        `SELECT id, fullname AS "fullName", email, googleid, dob, country, capacity, purpose, role, isprofilecomplete
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [userId]
      );
    } catch (queryErr) {
      console.warn('deserializeUser: first query failed, trying without isprofilecomplete:', queryErr.message);
      // Fallback for old schema without isprofilecomplete column
      try {
        [rows] = await db.promise().query(
          `SELECT id, fullname AS "fullName", email, googleid, dob, country, capacity, purpose, role
           FROM users
           WHERE id = ?
           LIMIT 1`,
          [userId]
        );
      } catch (fallbackErr) {
        console.error('deserializeUser: both queries failed:', fallbackErr.message);
        return done(fallbackErr);
      }
    }

    if (!rows.length) {
      console.warn('deserializeUser: user not found', userId);
      return done(null, false);
    }

    const user = rows[0];
    const userObj = {
      id: Number(user.id),
      email: String(user.email || '').trim().toLowerCase(),
      fullName: String(user.fullName || user.fullname || '').trim(),
      googleid: user.googleid || null,
      dob: user.dob ?? null,
      country: user.country ?? null,
      capacity: user.capacity ?? null,
      purpose: user.purpose ?? null,
      role: String(user.role || 'User'),
      isProfileComplete: Boolean(user.isprofilecomplete),
    };

    return done(null, userObj);
  } catch (error) {
    console.error('deserializeUser error:', error.message);
    return done(error);
  }
});

module.exports = passport;