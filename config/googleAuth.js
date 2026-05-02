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
      (accessToken, refreshToken, profile, done) => {
        const email = profile.emails[0].value;
        const name = profile.displayName;
        const googleId = String(profile.id || '').trim();

        db.query(
          "SELECT * FROM users WHERE email = ?",
          [email],
          (err, results) => {
            if (err) return done(err);

            if (results.length > 0) {
              const existing = results[0];
              // Ensure googleid is stored for this user
              if (googleId && !existing.googleid) {
                db.query(
                  'UPDATE users SET googleid = ? WHERE email = ?',
                  [googleId, email],
                  (updateErr) => {
                    if (updateErr) console.warn('Unable to update user googleid:', updateErr.message || updateErr);
                    return done(null, existing);
                  }
                );
              } else {
                return done(null, existing);
              }
            }

            const sql = `
              INSERT INTO users
              (fullName, dob, email, country, capacity, purpose, role, password, googleid)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              RETURNING id
            `;

            db.query(
              sql,
              [
                name,
                "2000-01-01",
                email,
                "Google",
                "Solo",
                "Google Login",
                "User",
                "google_auth",
                googleId || null,
              ],
              (err, result) => {
                if (err) {
                  console.log("GOOGLE INSERT ERROR:", err);
                  return done(err);
                }

                const newId = result && (result.insertId || result.rows?.[0]?.id);
                return done(null, {
                  id: newId,
                  email: email,
                  fullName: name,
                });
              }
            );
          }
        );
      }
    )
  );
} else {
  console.warn(
    `Google OAuth is disabled. source=${googleConfig.source} clientId=${googleConfig.maskedClientId} validClientId=${googleConfig.validClientIdFormat} hasSecret=${googleConfig.hasClientSecret} callbackURL=${callbackURL}`
  );
}

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

module.exports = passport;