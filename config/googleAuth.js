const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const db = require("../db/connection");

const clientID = String(process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_iD || '').trim();
const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
const callbackURL = String(process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback').trim();

function isValidGoogleClientId(value) {
  return /^\d+-[a-z0-9-]+\.apps\.googleusercontent\.com$/i.test(String(value || '').trim());
}

function maskClientId(value) {
  const id = String(value || '').trim();
  if (!id) return '(empty)';
  if (id.length <= 18) return `${id.slice(0, 4)}...`;
  return `${id.slice(0, 10)}...${id.slice(-18)}`;
}

if (clientID && clientSecret && isValidGoogleClientId(clientID)) {
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
  console.warn(
    `Google OAuth is disabled. clientId=${maskClientId(clientID)} validClientId=${isValidGoogleClientId(clientID)} hasSecret=${Boolean(clientSecret)} callbackURL=${callbackURL}`
  );
}

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

module.exports = passport;