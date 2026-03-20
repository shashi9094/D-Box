const express = require("express");
const router = express.Router();
const passport = require("passport");
const authController = require("../controllers/authController");

// Normal signup
router.post("/signup", authController.signup);

// Normal login
router.post("/login", authController.login);

// Google login start
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google callback
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login.html" }),
  (req, res) => {
    req.session.user = {
      id: req.user.id,
      email: req.user.email,
    };

    res.redirect("/dashboard.html");
  }
);

module.exports = router;
