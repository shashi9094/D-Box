const express = require("express");
const router = express.Router();
const passport = require("passport");
const authController = require("../controllers/authController");

function isValidGoogleClientId(value) {
  return /^\d+-[a-z0-9-]+\.apps\.googleusercontent\.com$/i.test(String(value || '').trim());
}

function maskClientId(value) {
  const id = String(value || '').trim();
  if (!id) return '(empty)';
  if (id.length <= 18) return `${id.slice(0, 4)}...`;
  return `${id.slice(0, 10)}...${id.slice(-18)}`;
}

const googleClientId = String(process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_iD || '').trim();
const googleClientSecret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
const googleCallbackUrl = String(process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback').trim();

const googleAuthEnabled = Boolean(
  isValidGoogleClientId(googleClientId) &&
  googleClientSecret
);

// Normal signup
router.post("/signup", authController.signup);

// Normal login
router.post("/login", authController.login);

router.get("/session", (req, res) => {
  res.json({
    authenticated: !!req.session?.user,
    user: req.session?.user || null,
  });
});

router.get("/google/status", (req, res) => {
  res.json({
    googleAuthEnabled,
    clientIdMasked: maskClientId(googleClientId),
    validClientIdFormat: isValidGoogleClientId(googleClientId),
    hasClientSecret: Boolean(googleClientSecret),
    callbackURL: googleCallbackUrl,
  });
});

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Logout failed" });
    }

    res.clearCookie("connect.sid");
    return res.json({ message: "Logout successful" });
  });
});

router.post('/accept-invite', authController.acceptInviteForSession);

// Google login start
router.get("/google", (req, res, next) => {
  if (!googleAuthEnabled) {
    return res.redirect("/login.html?google=disabled");
  }

  return passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

// Google callback
router.get("/google/callback", (req, res, next) => {
  if (!googleAuthEnabled) {
    return res.redirect("/login.html?google=disabled");
  }

  return passport.authenticate("google", { failureRedirect: "/login.html" })(req, res, next);
},
  (req, res) => {
    req.session.user = {
      id: req.user.id,
      email: req.user.email,
    };

    res.redirect("/home");
  }
);

module.exports = router;
