const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('../db/connection'); // Import the database connection

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/api/auth/google/callback"
},
(accessToken, refreshToken, profile, done) => {
  return done(null, profile);
}));

const email = profile.emails[0].value;
const name = profile.displayName;

// Check if user already exists in the database
db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
  if (err) {
    return done(err);
  }
  if (results.length > 0) {
    // User already exists
    return done(null, results[0]); //
  } else {
    // User does not exist, create a new one
    db.query('INSERT INTO users (email, name) VALUES (?, ?)', [email, name], (err, result) => {
      if (err) {
        return done(err);
      }
      return done(null, { id: result.insertId, email, name });
    });
  }
});


passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));
