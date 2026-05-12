const db = require(`../db/connection`);
const bcrypt = require("bcryptjs");
const crypto = require('crypto');
const boxController = require('./boxController');
const { logLoginHistory, isNewDeviceLogin } = require('../utils/loginHistory');
const { createNotification } = require('../utils/notifications');
const { sendOTP } = require('../utils/mailer');
const {
    buildSessionUser,
} = require('../utils/profileVerification');
const {
    comparePassword,
    getPasswordMode,
    preparePasswordForStorage,
} = require('../utils/passwordAuth');

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);
const OTP_RESEND_COOLDOWN_MS = Number(process.env.OTP_RESEND_COOLDOWN_MS || 30 * 1000);

function generateSixDigitOtp() {
    return String(crypto.randomInt(100000, 1000000));
}

function saveSession(req) {
    return new Promise((resolve, reject) => {
        if (!req.session || typeof req.session.save !== 'function') {
            return resolve();
        }

        req.session.save((err) => {
            if (err) {
                return reject(err);
            }

            return resolve();
        });
    });
}

function getRemainingCooldown(sentAtValue, cooldownMs = OTP_RESEND_COOLDOWN_MS) {
    if (!sentAtValue) {
        return 0;
    }

    const sentAt = new Date(sentAtValue).getTime();
    if (!Number.isFinite(sentAt)) {
        return 0;
    }

    const remainingMs = (sentAt + cooldownMs) - Date.now();
    return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

// SIGNUP
exports.signup = async (req, res) => {
    console.log('SIGNUP HIT');
    console.log('BODY:', req.body);

    try {
        const {
            fullname,
            dob,
            email,
            country,
            capacity,
            purpose,
            password,
            inviteBoxId,
            inviteToken
        } = req.body;

        const safeInviteBoxId = Number(inviteBoxId);
        const redirectUrl = '/dashboard';

        const normalizedEmail = String(email || '').trim().toLowerCase();
        const normalizedFullName = String(fullname || '').trim();
        const normalizedPassword = String(password || '');

        if (!normalizedFullName || !normalizedEmail) {
            return res.status(400).json({ message: 'Full name and email are required' });
        }

        if (!normalizedPassword) {
            return res.status(400).json({ message: 'Password is required' });
        }

        if (normalizedPassword.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters' });
        }

        const sql = db.promise();

        const [existingRows] = await sql.query(
            'SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
            [normalizedEmail]
        );

        if (existingRows.length > 0) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        const hashedPassword = await preparePasswordForStorage(normalizedPassword);
        const verificationOtp = generateSixDigitOtp();
        const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
        const otpSentAt = new Date();
        const [insertResult] = await sql.query(
            `INSERT INTO users
             (fullname, dob, email, country, capacity, purpose, role, password, is_verified, isprofilecomplete, verification_otp, otp_expires, verification_otp_attempts, verification_otp_sent_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             RETURNING id, fullname AS "fullName", email, dob, country, capacity, purpose, role, is_verified, isprofilecomplete, verification_otp, otp_expires`,
            [normalizedFullName, dob || null, normalizedEmail, country || null, capacity || null, purpose || null, 'User', hashedPassword, false, false, verificationOtp, otpExpiresAt, 0, otpSentAt]
        );

        const createdUser = Array.isArray(insertResult?.rows) ? insertResult.rows[0] : insertResult;

        if (!createdUser || !createdUser.id) {
            console.error('Signup insert did not return a user:', insertResult);
            return res.status(500).json({ message: 'Signup failed', error: 'Unable to create user' });
        }

        console.log('Signup created user:', {
            id: createdUser.id,
            email: createdUser.email,
            redirectUrl,
        });

        try {
            await boxController.acceptPendingInvitesForUser(createdUser.id, normalizedEmail, inviteToken || null);
        } catch (inviteErr) {
            console.error('Pending invite sync failed after signup:', inviteErr.message);
        }

        const authState = buildSessionUser({
            ...createdUser,
            email: normalizedEmail,
            fullName: normalizedFullName,
            isVerified: Boolean(createdUser.is_verified),
            isProfileComplete: Boolean(createdUser.isprofilecomplete),
            profilePending: !Boolean(createdUser.is_verified),
        }, {
            loginAt: Date.now(),
        });

        req.session.user = authState;
        req.session.cookie.maxAge = SESSION_MAX_AGE_MS;

        await saveSession(req);

        delete createdUser.verification_otp;
        delete createdUser.otp_expires;

        return res.status(201).json({
            message: 'Signup successful',
            success: true,
            user: createdUser,
            redirectUrl,
            authReady: true,
            profilePending: true,
            profileStatus: 'pending',
        });
    } catch (err) {
        console.error('Signup failed:', {
            message: err.message || err,
            code: err.code || null,
            detail: err.detail || null,
            hint: err.hint || null,
        });
        return res.status(500).json({ message: 'Signup failed', error: err.message || err });
    }
};



// LOGIN
exports.login = async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const inviteBoxId = Number(req.body.inviteBoxId);
    const inviteToken = String(req.body.inviteToken || '').trim();
    const redirectUrl = '/dashboard';

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }

    const sql = "SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1";

    db.query(sql, [email], async (err, results) => {
        if (err) {
            console.error('Login query failed:', {
                code: err.code || null,
                message: err.message || null,
                detail: err.detail || null,
                hint: err.hint || null,
            });
            return res.status(500).json({
                message: "DB error",
                errorCode: err.code || null,
                error: err.message || err
            });
        }

        if (results.length === 0) {
            return res.status(400).json({ message: "User not found" });
        }

        const user = results[0];

        const passwordMode = getPasswordMode(user.password);

        if (passwordMode === 'google') {
            return res.status(403).json({ message: 'Please continue with Google login' });
        }

        if (passwordMode !== 'bcrypt') {
            return res.status(401).json({ message: 'Invalid password' });
        }

        const isMatch = await comparePassword(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: "Invalid password" });
        }

        try {
            await boxController.acceptPendingInvitesForUser(user.id, user.email, inviteToken || null);
        } catch (inviteErr) {
            console.error('Pending invite sync failed after login:', inviteErr.message);
        }

        const authState = buildSessionUser({
            ...user,
            isVerified: Boolean(user.is_verified),
            isProfileComplete: Boolean(user.isprofilecomplete),
            profilePending: !Boolean(user.is_verified),
        }, {
            loginAt: Date.now(),
        });

        let shouldNotifyNewDevice = false;
        try {
            shouldNotifyNewDevice = await isNewDeviceLogin({ userId: user.id, req });
        } catch (deviceErr) {
            console.warn('Unable to evaluate device novelty:', deviceErr.message);
        }

        // SESSION SET KARO (MOST IMPORTANT)
        req.session.user = authState;

        req.session.cookie.maxAge = SESSION_MAX_AGE_MS;

        // Save session before responding so next protected route sees authenticated state.
        req.session.save((saveErr) => {
            if (saveErr) {
                return res.status(500).json({ message: "Session save failed" });
            }

            logLoginHistory({
                userId: user.id,
                email: user.email,
                req
            });

            if (shouldNotifyNewDevice) {
                const ipAddress = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim()
                    || req?.ip
                    || req?.socket?.remoteAddress
                    || 'Unknown IP';

                const userAgent = String(req?.headers?.['user-agent'] || '').trim() || 'Unknown device';

                createNotification({
                    userId: user.id,
                    type: 'new_device_login',
                    title: 'New device login detected',
                    message: 'Your account was logged in from a new device/browser.',
                    details: {
                        ipAddress,
                        userAgent,
                        email: String(user.email || '').trim().toLowerCase(),
                    },
                }).catch((notifyErr) => {
                    console.warn('New device notification failed:', notifyErr.message);
                });
            }

            return res.json({
                message: "Login successful",
                redirectUrl,
                profilePending: authState.profilePending,
                isVerified: authState.isVerified,
            });
        });
    });
};

exports.verifyEmail = async (_req, res) => {
    return res.status(410).json({
        message: 'Email link verification is no longer supported. Use OTP verification instead.'
    });
};

async function issueVerificationOtp(req, res) {
    try {
        const userId = Number(req.user?.id || req.session?.user?.id || 0);
        const sessionEmail = String(req.user?.email || req.session?.user?.email || '').trim().toLowerCase();
        if (!Number.isFinite(userId) || userId <= 0) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        const sql = db.promise();
        const [rows] = await sql.query(
            'SELECT id, email, is_verified, verification_otp_sent_at FROM users WHERE id = ? LIMIT 1',
            [userId]
        );
        const user = rows[0] || null;
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.is_verified) return res.status(400).json({ message: 'Already verified' });

        const recipientEmail = sessionEmail || String(user.email || '').trim().toLowerCase();
        if (!recipientEmail) {
            return res.status(500).json({ message: 'Unable to determine verification email' });
        }

        const cooldownSeconds = getRemainingCooldown(user.verification_otp_sent_at);
        if (cooldownSeconds > 0) {
            const wait = cooldownSeconds;
            return res.status(429).json({ message: 'Too many requests', retryAfterSeconds: wait });
        }

        // Generate 6-digit OTP
        const otp = generateSixDigitOtp();
        const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MS);

        // Save OTP and expiry
        await sql.query(
            `UPDATE users
             SET verification_otp = ?,
                 otp_expires = ?,
                 verification_otp_attempts = 0,
                 verification_otp_sent_at = ?
             WHERE id = ?`,
            [otp, otpExpiry, new Date(), userId]
        );

        // Send email
        const emailResult = await sendOTP(recipientEmail, otp);

        if (!emailResult.success) {
            console.error('sendOtp: email send failed', emailResult);
            return res.status(500).json({
                message: 'Unable to send OTP email',
                error: emailResult.error,
                code: emailResult.code || null,
                response: emailResult.response || null,
                stack: emailResult.stack || null,
            });
        }

        return res.json({
            success: true,
            message: 'OTP sent',
            cooldownSeconds: Math.ceil(OTP_RESEND_COOLDOWN_MS / 1000),
            expiresInSeconds: Math.floor(OTP_EXPIRY_MS / 1000),
        });
    } catch (error) {
        console.error('sendOtp failed:', error);
        return res.status(500).json({
            message: 'Unable to send OTP email',
            error: error.message,
            code: error.code || null,
            stack: error.stack || null,
        });
    }
}

// Send OTP to currently authenticated user's email for inline verification
exports.sendOtp = async (req, res) => issueVerificationOtp(req, res);

exports.resendOtp = async (req, res) => issueVerificationOtp(req, res);

// Verify OTP submitted by authenticated user
exports.verifyOtp = async (req, res) => {
    try {
        const userId = Number(req.user?.id || req.session?.user?.id || 0);
        if (!Number.isFinite(userId) || userId <= 0) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        const code = String(req.body?.code || '').trim();
        if (!/^[0-9]{6}$/.test(code)) {
            return res.status(400).json({ message: 'Invalid code format' });
        }

        const sql = db.promise();
        const [rows] = await sql.query(
            'SELECT id, email, verification_otp, otp_expires, verification_otp_attempts FROM users WHERE id = ? LIMIT 1',
            [userId]
        );
        const user = rows[0] || null;
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (!user.verification_otp || !user.otp_expires) return res.status(400).json({ message: 'No OTP requested' });

        if (Number(user.verification_otp_attempts || 0) >= OTP_MAX_ATTEMPTS) {
            return res.status(429).json({ message: 'Maximum OTP attempts exceeded. Request a new OTP.' });
        }

        const now = Date.now();
        const expiry = user.otp_expires ? new Date(user.otp_expires).getTime() : 0;
        if (!expiry || now > expiry) {
            await sql.query(
                'UPDATE users SET verification_otp = NULL, otp_expires = NULL, verification_otp_attempts = 0, verification_otp_sent_at = NULL WHERE id = ?',
                [userId]
            );
            return res.status(400).json({ message: 'OTP expired' });
        }

        if (String(user.verification_otp || '').trim() !== code) {
            await sql.query(
                'UPDATE users SET verification_otp_attempts = COALESCE(verification_otp_attempts, 0) + 1 WHERE id = ?',
                [userId]
            );
            return res.status(400).json({ message: 'Invalid code' });
        }

        // Success: clear OTP and mark verified
        await sql.query(
            `UPDATE users
             SET is_verified = TRUE,
                 isprofilecomplete = TRUE,
                 verification_otp = NULL,
                 otp_expires = NULL,
                 verification_otp_attempts = 0,
                 verification_otp_sent_at = NULL,
                 status = ?
             WHERE id = ?`,
            ['active', userId]
        );

        // Update session if present
        if (req.session?.user) {
            req.session.user = {
                ...req.session.user,
                isVerified: true,
                isProfileComplete: true,
                profilePending: false,
            };
            if (typeof req.session.save === 'function') {
                await saveSession(req);
            }
        }

        return res.json({ success: true, message: 'Profile verified successfully', profilePending: false });
    } catch (error) {
        console.error('verifyOtp failed:', error);
        return res.status(500).json({ message: 'Unable to verify OTP', error: error.message });
    }
};

// Forgot password: issue OTP to registered email
exports.forgotPassword = async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const sql = db.promise();
        const [rows] = await sql.query(
            'SELECT id, email, reset_otp_sent_at FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
            [email]
        );

        if (!rows.length) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = rows[0];
        const cooldownSeconds = getRemainingCooldown(user.reset_otp_sent_at);
        if (cooldownSeconds > 0) {
            return res.status(429).json({ message: 'Too many requests', retryAfterSeconds: cooldownSeconds });
        }

        const otp = generateSixDigitOtp();
        const expiry = new Date(Date.now() + OTP_EXPIRY_MS);
        const sentAt = new Date();

        await sql.query(
            `UPDATE users
             SET reset_otp = ?,
                 reset_otp_expires = ?,
                 reset_otp_attempts = 0,
                 reset_otp_sent_at = ?
             WHERE id = ?`,
            [otp, expiry, sentAt, user.id]
        );

        const sent = await sendOTP(user.email, otp);
        if (!sent.success) {
            console.error('forgotPassword: email send failed', sent);
            return res.status(500).json({
                message: 'Unable to send OTP email',
                error: sent.error,
                code: sent.code || null,
                response: sent.response || null,
                stack: sent.stack || null,
            });
        }

        return res.status(200).json({
            success: true,
            message: 'OTP sent to registered email',
            cooldownSeconds: Math.ceil(OTP_RESEND_COOLDOWN_MS / 1000),
            expiresInSeconds: Math.floor(OTP_EXPIRY_MS / 1000),
        });
    } catch (error) {
        console.error('forgotPassword failed:', error);
        return res.status(500).json({
            message: 'Unable to process forgot password',
            error: error.message,
            code: error.code || null,
            stack: error.stack || null,
        });
    }
};

// Reset password with OTP
exports.resetPassword = async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const otp = String(req.body?.otp || '').trim();
        const newPassword = String(req.body?.newPassword || '');

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ message: 'Email, OTP and new password are required' });
        }

        if (!/^[0-9]{6}$/.test(otp)) {
            return res.status(400).json({ message: 'Invalid OTP format' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters' });
        }

        const sql = db.promise();
        const [rows] = await sql.query(
            `SELECT id, reset_otp, reset_otp_expires, reset_otp_attempts
             FROM users
             WHERE LOWER(email) = LOWER(?)
             LIMIT 1`,
            [email]
        );

        if (!rows.length) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = rows[0];
        if (!user.reset_otp || !user.reset_otp_expires) {
            return res.status(400).json({ message: 'No OTP requested' });
        }

        if (Number(user.reset_otp_attempts || 0) >= OTP_MAX_ATTEMPTS) {
            return res.status(429).json({ message: 'Maximum OTP attempts exceeded. Request a new OTP.' });
        }

        const expiryTs = new Date(user.reset_otp_expires).getTime();
        if (!Number.isFinite(expiryTs) || Date.now() > expiryTs) {
            await sql.query(
                'UPDATE users SET reset_otp = NULL, reset_otp_expires = NULL, reset_otp_attempts = 0, reset_otp_sent_at = NULL WHERE id = ?',
                [user.id]
            );
            return res.status(400).json({ message: 'OTP expired' });
        }

        if (String(user.reset_otp || '').trim() !== otp) {
            await sql.query('UPDATE users SET reset_otp_attempts = COALESCE(reset_otp_attempts, 0) + 1 WHERE id = ?', [user.id]);
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        const hashedNewPassword = await preparePasswordForStorage(newPassword);
        await sql.query(
            `UPDATE users
             SET password = ?,
                 reset_otp = NULL,
                 reset_otp_expires = NULL,
                 reset_otp_attempts = 0,
                 reset_otp_sent_at = NULL
             WHERE id = ?`,
            [hashedNewPassword, user.id]
        );

        return res.status(200).json({ success: true, message: 'Password reset successful' });
    } catch (error) {
        return res.status(500).json({ message: 'Unable to reset password', error: error.message });
    }
};


exports.checkAccountExists = async (req, res) => {
    const email = String(req.query?.email || '').trim().toLowerCase();

    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    db.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
        [email],
        (err, rows) => {
            if (err) {
                    console.error('Account existence check failed:', {
                        code: err.code || null,
                        message: err.message || null,
                        detail: err.detail || null,
                        hint: err.hint || null,
                    });
                return res.status(500).json({ message: 'Unable to check account' });
            }

            return res.json({
                exists: rows.length > 0,
                email
            });
        }
    );
};

// Accept invite from link for currently logged-in user.
exports.acceptInviteForSession = async (req, res) => {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.id || !sessionUser.email) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    const inviteBoxId = Number(req.body && req.body.inviteBoxId);
    const inviteEmail = String(req.body && req.body.inviteEmail || '').trim().toLowerCase();
    const inviteToken = String(req.body && req.body.inviteToken || '').trim();
    const sessionEmail = String(sessionUser.email || '').trim().toLowerCase();

    if (!Number.isFinite(inviteBoxId) || inviteBoxId <= 0) {
        return res.status(400).json({ message: 'Invalid invite box id' });
    }

    if (inviteEmail && inviteEmail !== sessionEmail) {
        return res.status(403).json({
            message: 'Invite email does not match current logged-in user'
        });
    }

    try {
        const result = await boxController.acceptPendingInvitesForUser(sessionUser.id, sessionUser.email, inviteToken || null);

        if (inviteToken && (!result || result.acceptedCount === 0)) {
            return res.status(400).json({
                message: 'Invite link is invalid, expired, or the box is already full'
            });
        }

        return res.json({
            success: true,
            redirectUrl: '/dashboard',
            message: 'Invite processed for current user'
        });
    } catch (error) {
        return res.status(500).json({
            message: 'Unable to process invite',
            error: error.message
        });
    }
};
