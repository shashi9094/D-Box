const express = require("express");
const router = express.Router();
const passport = require("passport");
const authController = require("../controllers/authController");

const googleAuthEnabled = Boolean(
  String(process.env.GOOGLE_CLIENT_ID || '').trim() &&
  String(process.env.GOOGLE_CLIENT_SECRET || '').trim()
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

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Logout failed" });
    }

    res.clearCookie("connect.sid");
    return res.json({ message: "Logout successful" });
  });
});

// Google login start
router.get("/google", (req, res, next) => {
  if (!googleAuthEnabled) {
    return res.status(503).json({ message: "Google login is not configured" });
  }

  return passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

// Google callback
router.get("/google/callback", (req, res, next) => {
  if (!googleAuthEnabled) {
    return res.status(503).json({ message: "Google login is not configured" });
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
