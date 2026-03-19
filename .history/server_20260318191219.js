require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const db = require('./db/connection');
const path = require('path');

require('./config/googleAuth'); // Import Google OAuth configuration
const passport = require('passport');
const session = require('express-session');

// Routes
const authRoutes = require('./routes/authRoutes');
const boxRoutes = require('./routes/boxRoutes');

// CORS middleware (NO app.options("*") needed)
app.use(cors({
    origin: "http://127.0.0.1:5500",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

// Session middleware
app.use(session({
    secret: 'secretKey',
    resave: false,
    saveUninitialized: true
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//uploads folder for storing uploaded files
app.use("/uploads", express.static(path.join(__dirname, 'uploads')));
// Root route
app.use('/api/auth', authRoutes);
app.use('/api/box', boxRoutes);

//middleware function to check if user is authenticated
function isAuth(req, res, next) {
    if (req.session && req.session.user) {
        next();
    } else {
        res.redirect('/login.html');
    }
}

app.get('/dashboard', isAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'private', 'dashboard.html'));
});

app.get('/createbox', isAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'private', 'createbox.html'));
});

app.get('/userbox', isAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'private', 'Userbox.html'));
});

app.get('/home', isAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'private', 'home.html'));
});


// Start server
app.listen(5000, () => {
    console.log('Server is running on port 5000');
});
module.exports = app;

