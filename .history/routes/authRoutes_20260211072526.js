const express = require('express');
const router = express.Router();
const passport = require('passport');

const authController = require('../controllers/authController');

//Signup ROUTE
router.post('/signup', authController.signup);

//Login ROUTE
router.post('/login', authController.login);


//Logout ROUTE
router.post('/logout', (req, res) => {
    return res.status(200).json({message: "Logout successful"});
});

//Password Reset ROUTE
router.post('/reset-password', authController.resetPassword);

//Google OAuth ROUTE
router.get("/google", 
    passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get("/google/callback", 
    passport.authenticate("google", { failureRedirect: "/login.html" }),
    (req, res) => {
        // Successful authentication, redirect to home page or send a response
        res.redirect("/UserBox.html"); // Redirect to UserBox.html       after successful login
    }
);

module.exports = router;
