const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const db = require("../db/connection");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/auth/google/callback",
    },
    (accessToken, refreshToken, profile, done) => {
      const email = profile.emails[0].value;
      const name = profile.displayName;

      // CHECK USER
      db.query(
        "SELECT * FROM users WHERE email = ?",
        [email],
        (err, results) => {
          if (err) return done(err);

          if (results.length > 0) {
            // Existing user → login
            return done(null, results[0]);
          }

          // NEW GOOGLE USER → INSERT
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

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

module.exports = passport;