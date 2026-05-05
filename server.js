require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const path = require('path');

const db = require('./db/connection');
const {
    uploadsRoot,
    defaultUploadsRoot,
    ensureUploadDirectories,
    logUploadsStorageWarning
} = require('./utils/uploadPaths');

require('./config/googleAuth'); // Google Strategy load
const passport = require('passport');
const session = require('express-session');
const isProduction = process.env.NODE_ENV === 'production';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

ensureUploadDirectories();
logUploadsStorageWarning();

// Routes
const authRoutes = require('./routes/authRoutes');
const boxRoutes = require('./routes/boxRoutes');
const fileRoutes = require('./routes/fileRoutes');

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
        secure: false,
        sameSite: 'lax'
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

function isProfileCompleteRow(row) {
    if (!row) return false;

    const dob = String(row.dob || '').trim();
    const country = String(row.country || '').trim();
    const capacity = String(row.capacity || '').trim();
    const purpose = String(row.purpose || '').trim();
    const explicitFlag = row.isprofilecomplete;

    if (typeof explicitFlag === 'boolean') {
        return explicitFlag;
    }

    if (explicitFlag === 1 || explicitFlag === 't' || explicitFlag === 'true') {
        return true;
    }

    return Boolean(dob && country && capacity && purpose);
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

app.get('/complete-profile', (req, res) => {
    if (!req.session?.user?.id) {
        return res.redirect('/login.html');
    }

    const loginAt = Number(req.session.user.loginAt || 0);
    const isExpired = !Number.isFinite(loginAt) || (Date.now() - loginAt) > SESSION_MAX_AGE_MS;
    if (isExpired) {
        return req.session.destroy(() => {
            res.clearCookie('connect.sid');
            return res.redirect('/login.html?reason=session-expired');
        });
    }

    db.query(
        'SELECT id, dob, country, capacity, purpose, isprofilecomplete FROM users WHERE id = ? LIMIT 1',
        [req.session.user.id],
        (err, rows) => {
            if (err) {
                return res.status(500).send('Unable to load profile completion page');
            }

            const user = rows[0] || null;
            if (isProfileCompleteRow(user)) {
                return res.redirect('/dashboard');
            }

            setNoStore(res);
            return res.sendFile(path.join(__dirname, 'Public', 'pages', 'complete-profile.html'));
        }
    );
});

// Static
app.use(express.static(path.join(__dirname, 'Public')));
app.use("/uploads", express.static(uploadsRoot));
if (path.resolve(uploadsRoot) !== path.resolve(defaultUploadsRoot)) {
    app.use("/uploads", express.static(defaultUploadsRoot));
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/box', boxRoutes);
app.use('/api/files', fileRoutes);

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

app.post('/api/complete-profile', (req, res, next) => {
    if (req.isAuthenticated && req.isAuthenticated() && req.user) {
        return next();
    }

    return res.status(401).json({ message: 'Not authenticated' });
}, async (req, res) => {
    console.log('complete-profile req.user:', req.user);

    const userId = Number(req.user?.id);
    const dob = String(req.body?.dob || '').trim();
    const country = String(req.body?.country || '').trim();
    const capacity = String(req.body?.capacity || '').trim();
    const purpose = String(req.body?.purpose || '').trim();

    if (!req.user || !Number.isFinite(userId) || userId <= 0) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    if (!dob || !country || !capacity || !purpose) {
        return res.status(400).json({ message: 'DOB, country, capacity, and purpose are required' });
    }

    try {
        const [rows] = await db.promise().query(
            `UPDATE users
             SET dob = ?, country = ?, capacity = ?, purpose = ?, isprofilecomplete = TRUE
             WHERE id = ?
             RETURNING id, fullname AS "fullName", email, dob, country, capacity, purpose, isprofilecomplete`,
            [dob, country, capacity, purpose, userId]
        );

        const updated = rows[0];
        if (!updated) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (req.session?.user) {
            req.session.user = {
                ...req.session.user,
                dob: updated.dob,
                country: updated.country,
                capacity: updated.capacity,
                purpose: updated.purpose,
                isProfileComplete: true,
            };
        }

        if (req.user) {
            req.user = {
                ...req.user,
                dob: updated.dob,
                country: updated.country,
                capacity: updated.capacity,
                purpose: updated.purpose,
                isProfileComplete: true,
            };
        }

        return res.json({
            success: true,
            message: 'Profile completed successfully',
            redirectUrl: '/dashboard'
        });
    } catch (error) {
        return res.status(500).json({
            message: 'Unable to complete profile',
            error: error.message,
        });
    }
});

// Start
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
