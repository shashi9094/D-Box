require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const path = require('path');
const crypto = require('crypto');

// db connection will be required after session store setup
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

// Use Postgres-backed session store in production to avoid MemoryStore warning
const PgSession = require('connect-pg-simple')(session);
const db = require('./db/connection');

ensureUploadDirectories();
logUploadsStorageWarning();

// Routes
const authRoutes = require('./routes/authRoutes');
const boxRoutes = require('./routes/boxRoutes');
const fileRoutes = require('./routes/fileRoutes');
const boxController = require('./controllers/boxController');
const { signup } = require('./controllers/authController');
const { sendEmail, verifyInviteToken, consumeInviteToken, peekInviteToken } = require('./utils/emailService');
const { preparePasswordForStorage, comparePassword, getPasswordMode } = require('./utils/passwordAuth');
const otpRoutes = require('./routes/otpRoutes');
const passwordResetRoutes = require('./routes/passwordResetRoutes');

const apiSessionTokens = new Map();

function cleanupApiSessionTokens() {
    const now = Date.now();
    for (const [token, value] of apiSessionTokens.entries()) {
        if (!value || now >= Number(value.expiresAt || 0)) {
            apiSessionTokens.delete(token);
        }
    }
}

function issueApiSessionToken(sessionUser) {
    cleanupApiSessionTokens();
    const token = crypto.randomBytes(32).toString('hex');
    apiSessionTokens.set(token, {
        userId: Number(sessionUser.id),
        email: String(sessionUser.email || '').trim().toLowerCase(),
        expiresAt: Date.now() + SESSION_MAX_AGE_MS
    });
    return token;
}

function getApiSessionFromBearer(req) {
    const authHeader = String(req.headers.authorization || '').trim();
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
        return null;
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
        return null;
    }

    const sessionToken = apiSessionTokens.get(token);
    if (!sessionToken) {
        return null;
    }

    if (Date.now() >= Number(sessionToken.expiresAt || 0)) {
        apiSessionTokens.delete(token);
        return null;
    }

    return {
        token,
        userId: Number(sessionToken.userId),
        email: String(sessionToken.email || '').trim().toLowerCase()
    };
}

function saveSession(req) {
    return new Promise((resolve, reject) => {
        if (!req.session || typeof req.session.save !== 'function') {
            resolve();
            return;
        }

        req.session.save((err) => {
            if (err) {
                reject(err);
                return;
            }

            resolve();
        });
    });
}

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
if (isProduction && !process.env.SESSION_SECRET) {
    console.error('SESSION_SECRET must be set in production. Aborting startup.');
    process.exit(1);
}

const sessionOptions = {
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: SESSION_MAX_AGE_MS,
        secure: isProduction,        // require HTTPS in production
        httpOnly: true,
        sameSite: isProduction ? 'lax' : 'lax'
    }
};

if (isProduction) {
    const store = new PgSession({
        pool: db.pool,
        tableName: 'session'
    });

    store.on('error', (error) => {
        console.error('Session store error:', error.message || error);
    });

    sessionOptions.store = store;
} else {
    console.warn('Using in-memory session store in development. Set NODE_ENV=production to use PostgreSQL session storage.');
}

app.use(session(sessionOptions));

// ⭐ VERY IMPORTANT (Google Login ke liye)
app.use(passport.initialize());
app.use(passport.session());

app.post('/signup', async (req, res) => {
    console.log('POST /signup hit');

    try {
        return await signup(req, res);
    } catch (error) {
        console.error('POST /signup unexpected error:', error.message || error);
        return res.status(500).json({
            success: false,
            message: 'Signup failed',
            error: error.message || String(error)
        });
    }
});

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

app.use('/scripts', express.static(path.join(__dirname, 'private', 'scripts'), {
    setHeaders(res) {
        setNoStore(res);
    }
}));

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

app.get('/join', (req, res) => {
    setNoStore(res);
    return res.sendFile(path.join(__dirname, 'Public', 'pages', 'join.html'));
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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/box', boxRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/images', require('./routes/imageRoutes'));
app.use('/api/otp', otpRoutes);
app.use('/api/password-reset', passwordResetRoutes);
app.get('/api/uploads', isAuth, boxController.getUploadsByQuery);

app.get('/test-email', async (req, res) => {
    const to = String(req.query?.to || process.env.TEST_EMAIL_TO || process.env.SMTP_USER || '').trim();

    if (!to) {
        console.error('GET /test-email failed: no recipient provided');
        return res.status(400).json({
            success: false,
            error: 'Recipient is required. Set TEST_EMAIL_TO/SMTP_USER or pass ?to=email@example.com'
        });
    }

    try {
        console.log(`GET /test-email requested for ${to}`);

        const result = await sendEmail(
            to,
            'D-Box SES SMTP Test Email',
            'Working'
        );

        if (!result.success) {
            console.error('GET /test-email sendEmail returned failure', result.error);
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        return res.json({
            success: true,
            messageId: result.messageId
        });
    } catch (error) {
        const detail = [error.code, error.message].filter(Boolean).join(' | ');
        console.error('GET /test-email unexpected error:', detail || error.toString());
        return res.status(500).json({
            success: false,
            error: detail || 'Failed to send test email'
        });
    }
});

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

app.get('/profile', isAuth, (req, res) => {
    setNoStore(res);
    res.sendFile(path.join(__dirname, 'private', 'pages', 'profile.html'));
});

app.post('/api/complete-profile', async (req, res) => {
    const sessionUser = req.session?.user || null;
    const passportUser = req.user || null;
    const userId = Number(req.user?.id || sessionUser?.id || passportUser?.id);
    const dob = String(req.body?.dob || '').trim();
    const country = String(req.body?.country || '').trim();
    const capacity = String(req.body?.capacity || '').trim();
    const purpose = String(req.body?.purpose || '').trim();

    console.log('complete-profile request:', {
        reqUser: req.user || null,
        sessionUser: sessionUser || null,
        passportUser: passportUser || null,
        body: req.body || null,
        bodyKeys: Object.keys(req.body || {}),
    });

    if (!Number.isFinite(userId) || userId <= 0) {
        console.warn('complete-profile rejected: no authenticated user');
        return res.status(401).json({ message: 'Not authenticated' });
    }

    if (!dob || !country || !capacity || !purpose) {
        return res.status(400).json({ message: 'DOB, country, capacity, and purpose are required' });
    }

    try {
        const [result] = await db.promise().query(
            `UPDATE users
             SET dob = ?, country = ?, capacity = ?, purpose = ?, isprofilecomplete = TRUE
             WHERE id = ?
             RETURNING id, fullname AS "fullName", email, dob, country, capacity, purpose, isprofilecomplete`,
            [dob, country, capacity, purpose, userId]
        );

        console.log('complete-profile db result:', result);

        // Normalize the returned row. db.promise().query returns a normalized write result
        // for non-SELECT commands; that object contains a `rows` array. Handle both shapes.
        const updated = (result && Array.isArray(result.rows) && result.rows[0]) || (Array.isArray(result) && result[0]) || null;

        if (!updated) {
            console.error('complete-profile user update returned no rows', {
                userId,
                sessionUserId: sessionUser?.id || null,
                passportUserId: passportUser?.id || null,
                rawResult: result,
            });

            // Return 404 without an alert on the frontend; frontend will show inline message.
            return res.status(404).json({ message: 'User not found' });
        }

        if (req.session?.user) {
            req.session.user = {
                ...req.session.user,
                id: Number(updated.id || userId),
                email: String(updated.email || req.session.user.email || '').trim().toLowerCase(),
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

        console.log('complete-profile updated:', updated);

        const finishResponse = () => res.json({
            success: true,
            message: 'Profile completed successfully',
            redirectUrl: '/dashboard'
        });

        if (req.session && typeof req.session.save === 'function') {
            return req.session.save((saveErr) => {
                if (saveErr) {
                    console.warn('complete-profile session save failed:', saveErr.message || saveErr);
                }

                return finishResponse();
            });
        }

        return finishResponse();
    } catch (error) {
        console.error('Unable to complete profile:', {
            message: error.message || error,
            code: error.code || null,
            detail: error.detail || null,
            hint: error.hint || null,
        });
        return res.status(500).json({
            message: 'Unable to complete profile',
            error: error.message,
        });
    }
});

app.get('/api/check-invite', async (req, res) => {
    const token = String(req.query?.token || '').trim();
    const boxId = Number(req.query?.box);

    if (!token || !Number.isFinite(boxId) || boxId <= 0) {
        return res.status(400).json({ message: 'Token and box are required' });
    }

    const invitePreview = peekInviteToken(token, boxId);
    if (!invitePreview?.success) {
        return res.status(400).json({
            message: invitePreview?.message || 'Invalid or expired invitation'
        });
    }

    const inviteEmail = String(invitePreview.email || '').trim().toLowerCase();

    try {
        const [rows] = await db.promise().query(
            'SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
            [inviteEmail]
        );

        return res.json({
            success: true,
            email: inviteEmail,
            hasAccount: rows.length > 0
        });
    } catch (error) {
        return res.status(500).json({
            message: 'Unable to check invite',
            error: error.message
        });
    }
});

app.post('/api/signup', async (req, res) => {
    const token = String(req.body?.token || '').trim();
    const boxId = Number(req.body?.boxId);
    const email = String(req.body?.email || '').trim().toLowerCase();
    const fullName = String(req.body?.fullName || '').trim();
    const password = String(req.body?.password || '');

    if (!token || !Number.isFinite(boxId) || boxId <= 0) {
        return res.status(400).json({ message: 'Invalid invite context' });
    }

    if (!email || !fullName || !password) {
        return res.status(400).json({ message: 'Email, full name, and password are required' });
    }

    if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const invitePreview = peekInviteToken(token, boxId);
    if (!invitePreview?.success) {
        return res.status(400).json({
            message: invitePreview?.message || 'Invalid or expired invitation'
        });
    }

    const inviteEmail = String(invitePreview.email || '').trim().toLowerCase();
    if (inviteEmail !== email) {
        return res.status(403).json({ message: 'Invite email mismatch' });
    }

    try {
        const sql = db.promise();

        const [existing] = await sql.query(
            'SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
            [email]
        );

        if (existing.length > 0) {
            return res.status(409).json({ message: 'Account already exists for this email' });
        }

        const hashedPassword = await preparePasswordForStorage(password);
        const [insertResult] = await sql.query(
            `INSERT INTO users (fullname, email, password, role, is_verified, isprofilecomplete)
             VALUES (?, ?, ?, 'User', FALSE, FALSE)
             RETURNING id, fullname AS "fullName", email, is_verified, isprofilecomplete`,
            [fullName, email, hashedPassword]
        );

        const createdUser = Array.isArray(insertResult?.rows) ? insertResult.rows[0] : insertResult;
        if (!createdUser?.id) {
            return res.status(500).json({ message: 'Unable to create account' });
        }

        req.session.user = {
            id: Number(createdUser.id),
            email: String(createdUser.email || email).trim().toLowerCase(),
            fullName: String(createdUser.fullName || fullName).trim(),
            loginAt: Date.now(),
            isVerified: Boolean(createdUser.is_verified),
            isProfileComplete: Boolean(createdUser.isprofilecomplete),
            profilePending: !Boolean(createdUser.is_verified),
        };
        req.session.cookie.maxAge = SESSION_MAX_AGE_MS;
        await saveSession(req);

        const sessionToken = issueApiSessionToken(req.session.user);

        return res.status(201).json({
            success: true,
            sessionToken,
            user: {
                id: req.session.user.id,
                email: req.session.user.email,
                fullName: req.session.user.fullName
            }
        });
    } catch (error) {
        return res.status(500).json({
            message: 'Unable to create account',
            error: error.message
        });
    }
});

app.post('/api/login', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const [rows] = await db.promise().query(
            'SELECT id, fullname AS "fullName", email, password, is_verified, isprofilecomplete FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
            [email]
        );

        if (!rows.length) {
            return res.status(400).json({ message: 'User not found' });
        }

        const user = rows[0];
        const passwordMode = getPasswordMode(user.password);
        if (passwordMode !== 'bcrypt') {
            return res.status(403).json({ message: 'Please continue with Google login' });
        }

        const isMatch = await comparePassword(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid password' });
        }

        req.session.user = {
            id: Number(user.id),
            email: String(user.email || '').trim().toLowerCase(),
            fullName: String(user.fullName || '').trim(),
            loginAt: Date.now(),
            isVerified: Boolean(user.is_verified),
            isProfileComplete: Boolean(user.isprofilecomplete),
            profilePending: !Boolean(user.is_verified),
        };
        req.session.cookie.maxAge = SESSION_MAX_AGE_MS;
        await saveSession(req);

        const sessionToken = issueApiSessionToken(req.session.user);

        return res.json({
            success: true,
            sessionToken,
            user: {
                id: req.session.user.id,
                email: req.session.user.email,
                fullName: req.session.user.fullName
            }
        });
    } catch (error) {
        return res.status(500).json({
            message: 'Unable to login',
            error: error.message
        });
    }
});

app.post('/api/join', async (req, res) => {
    const token = String(req.body?.token || '').trim();
    const boxId = Number(req.body?.boxId);

    if (!token || !Number.isFinite(boxId) || boxId <= 0) {
        return res.status(400).json({ message: 'Invalid invite request' });
    }

    const authSession = getApiSessionFromBearer(req);
    if (!authSession?.userId || !authSession?.email) {
        return res.status(401).json({
            message: 'Unauthorized. Missing or invalid auth token.'
        });
    }

    const invitePreview = peekInviteToken(token, boxId);
    if (!invitePreview?.success) {
        return res.status(400).json({
            message: invitePreview?.message || 'Invalid or expired invitation'
        });
    }

    const sessionEmail = String(authSession.email || '').trim().toLowerCase();
    const inviteEmail = String(invitePreview.email || '').trim().toLowerCase();

    if (!inviteEmail || inviteEmail !== sessionEmail) {
        return res.status(403).json({
            message: 'This invitation belongs to a different email account'
        });
    }

    try {
        const sql = db.promise();

        const [existingMembership] = await sql.query(
            'SELECT role FROM box_members WHERE box_id = ? AND user_id = ? LIMIT 1',
            [boxId, authSession.userId]
        );

        if (existingMembership.length > 0) {
            consumeInviteToken(token, boxId);
            return res.json({
                success: true,
                message: 'You are already a member of this box',
                redirectUrl: '/dashboard'
            });
        }

        const [inviteRows] = await sql.query(
            `SELECT id, role, invited_by
             FROM box_invites
             WHERE box_id = ? AND LOWER(email) = LOWER(?) AND status = 'pending'
             ORDER BY id DESC
             LIMIT 1`,
            [boxId, inviteEmail]
        );

        const inviteRow = inviteRows[0] || null;
        const memberRole = inviteRow?.role === 'admin' ? 'admin' : 'member';
        const addedBy = Number(inviteRow?.invited_by) || Number(authSession.userId);

        await sql.query(
            `INSERT INTO box_members AS bm (box_id, user_id, role, added_by)
             VALUES (?, ?, ?, ?)
             ON CONFLICT (box_id, user_id) DO UPDATE SET
                role = CASE WHEN bm.role = 'admin' THEN 'admin' ELSE EXCLUDED.role END,
                added_by = EXCLUDED.added_by`,
            [boxId, authSession.userId, memberRole, addedBy]
        );

        if (inviteRow?.id) {
            await sql.query(
                `UPDATE box_invites
                 SET status = 'accepted', accepted_by = ?, accepted_at = NOW()
                 WHERE id = ?`,
                [authSession.userId, inviteRow.id]
            );
        }

        const consumeResult = consumeInviteToken(token, boxId);
        if (!consumeResult?.success) {
            return res.status(400).json({
                message: consumeResult?.message || 'Invalid or expired invitation'
            });
        }

        return res.json({
            success: true,
            message: 'Invitation accepted successfully',
            redirectUrl: '/dashboard'
        });
    } catch (error) {
        console.error('POST /api/join failed:', {
            message: error?.message || String(error),
            code: error?.code || null,
            detail: error?.detail || null,
        });

        return res.status(500).json({
            message: 'Unable to join box right now',
            error: error?.message || String(error)
        });
    }
});

// Start
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
