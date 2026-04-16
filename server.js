require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const path = require('path');

const db = require('./db/connection');

require('./config/googleAuth'); // Google Strategy load
const passport = require('passport');
const session = require('express-session');
const isProduction = process.env.NODE_ENV === 'production';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

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

// Render and other managed hosts run behind a reverse proxy
app.set('trust proxy', 1);

// Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'secretKey',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: SESSION_MAX_AGE_MS,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax'
    }
}));

// ⭐ VERY IMPORTANT (Google Login ke liye)
app.use(passport.initialize());
app.use(passport.session());

function setNoStore(res) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
}

function hasInviteQuery(req) {
    return Boolean(req.query && (req.query.invite || req.query.email || req.query.token));
}

app.get('/scripts/back-nav.js', isAuth, (req, res) => {
    setNoStore(res);
    return res.sendFile(path.join(__dirname, 'private', 'scripts', 'back-nav.js'));
});

app.get('/scripts/auth-guard.js', isAuth, (req, res) => {
    setNoStore(res);
    return res.sendFile(path.join(__dirname, 'private', 'scripts', 'auth-guard.js'));
});

app.get('/', (req, res) => {
    if (req.session && req.session.user) {
        return res.redirect('/home');
    }

    setNoStore(res);
    return res.sendFile(path.join(__dirname, 'Public', 'pages', 'index.html'));
});

app.get('/index.html', (req, res) => {
    if (req.session && req.session.user) {
        return res.redirect('/home');
    }

    setNoStore(res);
    return res.sendFile(path.join(__dirname, 'Public', 'pages', 'index.html'));
});

app.get('/login.html', (req, res) => {
    if (req.session && req.session.user && !hasInviteQuery(req)) {
        return res.redirect('/home');
    }

    setNoStore(res);
    return res.sendFile(path.join(__dirname, 'Public', 'pages', 'login.html'));
});

app.get('/signup.html', (req, res) => {
    if (req.session && req.session.user && !hasInviteQuery(req)) {
        return res.redirect('/home');
    }

    setNoStore(res);
    return res.sendFile(path.join(__dirname, 'Public', 'pages', 'signup.html'));
});

// Static
app.use(express.static(path.join(__dirname, 'Public')));
app.use("/uploads", express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/box', boxRoutes);

// Auth middleware
function isAuth(req, res, next) {
    if (req.session && req.session.user) {
        const loginAt = Number(req.session.user.loginAt || 0);
        const isExpired = !Number.isFinite(loginAt) || (Date.now() - loginAt) > SESSION_MAX_AGE_MS;

        if (isExpired) {
            return req.session.destroy(() => {
                res.clearCookie('connect.sid');
                return res.redirect('/login.html?reason=session-expired');
            });
        }

        next();
    } else {
        res.redirect('/login.html');
    }
}

// Private Pages
app.get('/dashboard', isAuth, (req, res) => {
    setNoStore(res);
    res.sendFile(path.join(__dirname, 'private', 'pages', 'dashboard.html'));
});

app.get('/createbox', isAuth, (req, res) => {
    setNoStore(res);
    res.sendFile(path.join(__dirname, 'private', 'pages', 'createbox.html'));
});

app.get('/home', isAuth, (req, res) => {
    setNoStore(res);
    res.sendFile(path.join(__dirname, 'private', 'pages', 'home.html'));
});

app.get('/uploads', isAuth, (req, res) => {
    setNoStore(res);
    res.sendFile(path.join(__dirname, 'private', 'pages', 'uploads.html'));
});

// Start
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});