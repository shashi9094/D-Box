const express = require('express');
const router = express.Router()

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


module.exports = router;
