const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const db = require("../db/connection");
const { loadGoogleOAuthConfig } = require("../utils/googleOAuthConfig");

const googleConfig = loadGoogleOAuthConfig();
const { clientID, clientSecret, callbackURL } = googleConfig;

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
            `SELECT id, fullName, email, googleid, capacity, purpose, isProfileComplete
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
            if (!existing.googleid) {
              await sql.query('UPDATE users SET googleid = ? WHERE id = ?', [googleId, existing.id]);
              existing.googleid = googleId;
            }

            return done(null, {
              id: Number(existing.id),
              email: String(existing.email || email).trim().toLowerCase(),
              fullName: String(existing.fullName || name).trim(),
              googleid: googleId,
              capacity: existing.capacity ?? null,
              purpose: existing.purpose ?? null,
              isProfileComplete: Boolean(existing.isprofilecomplete ?? existing.isProfileComplete),
            });
          }

          const [insertResult] = await sql.query(
            `INSERT INTO users
             (fullName, dob, email, country, googleid, capacity, purpose, role, password, isProfileComplete)
             VALUES (?, NULL, ?, NULL, ?, NULL, NULL, 'User', NULL, FALSE)
             RETURNING id, fullName, email, googleid, capacity, purpose, isProfileComplete`,
            [name, email, googleId]
          );

          const created = insertResult.rows?.[0] || insertResult;

          return done(null, {
            id: Number(created.id),
            email: String(created.email || email).trim().toLowerCase(),
            fullName: String(created.fullName || name).trim(),
            googleid: googleId,
            capacity: created.capacity ?? null,
            purpose: created.purpose ?? null,
            isProfileComplete: Boolean(created.isprofilecomplete ?? created.isProfileComplete),
          });
        } catch (error) {
          console.log('GOOGLE AUTH ERROR:', error);
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
      return done(null, false);
    }

    const [rows] = await db.promise().query(
      `SELECT id, fullName, email, googleid, capacity, purpose, role, isProfileComplete
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    if (!rows.length) {
      return done(null, false);
    }

    const user = rows[0];
    return done(null, {
      id: Number(user.id),
      email: String(user.email || '').trim().toLowerCase(),
      fullName: String(user.fullName || '').trim(),
      googleid: user.googleid || null,
      capacity: user.capacity ?? null,
      purpose: user.purpose ?? null,
      role: String(user.role || 'User'),
      isProfileComplete: Boolean(user.isprofilecomplete ?? user.isProfileComplete),
    });
  } catch (error) {
    return done(error);
  }
});

module.exports = passport;