require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const path = require('path');

const db = require('./db/connection');

require('./config/googleAuth'); // Google Strategy load
const passport = require('passport');
const session = require('express-session');

// Routes
const authRoutes = require('./routes/authRoutes');
const boxRoutes = require('./routes/boxRoutes');

// CORS
app.use(cors({
    origin: true,
    credentials: true
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
app.use(session({
    secret: 'secretKey',
    resave: false,
    saveUninitialized: false
}));

// ⭐ VERY IMPORTANT (Google Login ke liye)
app.use(passport.initialize());
app.use(passport.session());

// Static
app.use(express.static(path.join(__dirname, 'Public')));
app.use("/uploads", express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/box', boxRoutes);

// Auth middleware
function isAuth(req, res, next) {
    if (req.session && req.session.user) {
        next();
    } else {
        res.redirect('/login.html');
    }
}

// Private Pages
app.get('/dashboard', isAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'private', 'dashboard.html'));
});

app.get('/createbox', isAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'private', 'createbox.html'));
});

app.get('/userbox', isAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'private', 'userbox.html'));
});

app.get('/home', isAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'private', 'home.html'));
});

// Start
app.listen(5000, () => {
    console.log('Server is running on port 5000');
});