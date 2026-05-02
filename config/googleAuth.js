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

        db.query(
          "SELECT * FROM users WHERE email = ?",
          [email],
          (err, results) => {
            if (err) return done(err);

            if (results.length > 0) {
              return done(null, results[0]);
            }

            const sql = `
              INSERT INTO users
              (fullName, dob, email, country, capacity, purpose, role, password)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
              ],
              (err, result) => {
                if (err) {
                  console.log("GOOGLE INSERT ERROR:", err);
                  return done(err);
                }

                return done(null, {
                  id: result.insertId || result.rows?.[0]?.id,
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