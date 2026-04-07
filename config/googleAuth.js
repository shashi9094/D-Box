const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const db = require("../db/connection");

const clientID = String(process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_iD || '').trim();
const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();

if (clientID && clientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL: "/api/auth/google/callback",
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
              (fullName, dob, email, country, capacity, purpose, password)
              VALUES (?, ?, ?, ?, ?, ?, ?)
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
                "google_auth",
              ],
              (err, result) => {
                if (err) {
                  console.log("GOOGLE INSERT ERROR:", err);
                  return done(err);
                }

                return done(null, {
                  id: result.insertId,
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
  console.warn("Google OAuth is disabled because GOOGLE_CLIENT_ID/GOOGLE_CLIENT_iD or GOOGLE_CLIENT_SECRET is missing.");
}

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

module.exports = passport;