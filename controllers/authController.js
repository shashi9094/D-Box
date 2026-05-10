const db = require(`../db/connection`);
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");    
const crypto = require('crypto');
const boxController = require('./boxController');
const { logLoginHistory, isNewDeviceLogin } = require('../utils/loginHistory');
const { createNotification } = require('../utils/notifications');
const { sendEmail } = require('../emailService');
const {
    comparePassword,
    getPasswordMode,
    preparePasswordForStorage,
} = require('../utils/passwordAuth');

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function getAppBaseUrl(req) {
    const configured = String(process.env.APP_BASE_URL || process.env.PUBLIC_URL || '').trim().replace(/\/+$/, '');
    if (configured) {
        return configured;
    }

    const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
    const host = String(req.get('host') || '').trim();
    return `${proto}://${host}`.replace(/\/+$/, '');
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

function buildVerificationEmail(fullName, verificationUrl) {
    const safeName = String(fullName || '').trim() || 'there';
    return {
        subject: 'Verify Your D-Box Account',
        text: [
            `Hi ${safeName},`,
            '',
            'Please verify your D-Box account by clicking the link below:',
            verificationUrl,
            '',
            'This verification link expires in 1 hour.',
            '',
            'If you did not create this account, you can safely ignore this email.'
        ].join('\n')
    };
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
        const redirectUrl = Number.isFinite(safeInviteBoxId) && safeInviteBoxId > 0
            ? '/dashboard'
            : '/complete-profile';

        const normalizedEmail = String(email || '').trim().toLowerCase();
        const normalizedFullName = String(fullname || '').trim();
        const normalizedPassword = String(password || '');
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

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
        const [insertResult] = await sql.query(
            `INSERT INTO users
             (fullname, dob, email, country, capacity, purpose, role, password, verification_token, is_verified, token_expires)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             RETURNING id, fullname AS "fullName", email, dob, country, capacity, purpose, role, is_verified, isprofilecomplete`,
            [normalizedFullName, dob || null, normalizedEmail, country || null, capacity || null, purpose || null, 'User', hashedPassword, verificationToken, false, tokenExpiresAt]
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

        const verificationUrl = `${getAppBaseUrl(req)}/verify-email?token=${verificationToken}`;
        const emailBody = buildVerificationEmail(normalizedFullName, verificationUrl);
        const emailResult = await sendEmail(normalizedEmail, emailBody.subject, emailBody.text);

        if (!emailResult.success) {
            console.error('Verification email send failed after signup:', emailResult.error);

            await sql.query('DELETE FROM users WHERE id = ?', [createdUser.id]);

            return res.status(500).json({
                message: 'Signup failed while sending verification email',
                error: emailResult.error
            });
        }

        req.session.user = {
            id: Number(createdUser.id),
            email: normalizedEmail,
            loginAt: Date.now(),
            isProfileComplete: Boolean(createdUser.isprofilecomplete),
        };
        req.session.cookie.maxAge = SESSION_MAX_AGE_MS;

        await saveSession(req);

        return res.status(201).json({
            message: 'Signup successful. Verification email sent.',
            success: true,
            user: createdUser,
            redirectUrl,
            authReady: true
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
    const redirectUrl = Number.isFinite(inviteBoxId) && inviteBoxId > 0
        ? '/dashboard'
        : '/home';

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

        if (!user.is_verified) {
            return res.status(403).json({
                message: 'Please verify your email before logging in.'
            });
        }

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

        let shouldNotifyNewDevice = false;
        try {
            shouldNotifyNewDevice = await isNewDeviceLogin({ userId: user.id, req });
        } catch (deviceErr) {
            console.warn('Unable to evaluate device novelty:', deviceErr.message);
        }

        // SESSION SET KARO (MOST IMPORTANT)
        req.session.user = {
            id: user.id,
            email: user.email,
            loginAt: Date.now()
        };

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
                redirectUrl
            });
        });
    });
};

exports.verifyEmail = async (req, res) => {
    const token = String(req.query?.token || '').trim();

    if (!token) {
        return res.status(400).json({
            success: false,
            error: 'Verification token is required'
        });
    }

    try {
        const [rows] = await db.promise().query(
            'SELECT id, email, verification_token, token_expires, is_verified FROM users WHERE verification_token = ? LIMIT 1',
            [token]
        );

        if (!rows.length) {
            return res.status(400).json({
                success: false,
                error: 'Invalid verification token'
            });
        }

        const user = rows[0];
        const expiresAt = user.token_expires ? new Date(user.token_expires).getTime() : NaN;

        if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
            return res.status(400).json({
                success: false,
                error: 'Verification token has expired'
            });
        }

        await db.promise().query(
            `UPDATE users
             SET is_verified = TRUE,
                 verification_token = NULL,
                 token_expires = NULL
             WHERE id = ?`,
            [user.id]
        );

        return res.json({
            success: true,
            message: 'Email verified successfully. You can now log in.'
        });
    } catch (error) {
        console.error('verifyEmail failed:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Unable to verify email'
        });
    }
};

// PASSWORD RESET
exports.resetPassword = async (req, res) => {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
        return res.status(400).json({ message: "Email and new password are required" });
    }

    try {
        // Hash new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        const sql = `UPDATE users SET password = ? WHERE email = ?`;
        db.query(sql, [hashedNewPassword, email], (err, result) => {
            if (err) {
                return res.status(500).json({ message: "Something went wrong", error: err });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "User not found" });
            }
            res.json({ message: "Password reset successful" });
        });
    } catch (err) {
        return res.status(500).json({ message: "Error hashing password", error: err });
    }
};

// Send OTP to currently authenticated user's email for inline verification
exports.sendOtp = async (req, res) => {
    try {
        const userId = Number(req.user?.id || req.session?.user?.id || 0);
        if (!Number.isFinite(userId) || userId <= 0) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        const sql = db.promise();
        const [rows] = await sql.query('SELECT id, email, is_verified, otp_sent_at, otp_attempts FROM users WHERE id = ? LIMIT 1', [userId]);
        const user = rows[0] || null;
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.is_verified) return res.status(400).json({ message: 'Already verified' });

        const now = Date.now();
        const lastSent = user.otp_sent_at ? new Date(user.otp_sent_at).getTime() : 0;
        const cooldownMs = Number(process.env.OTP_RESEND_COOLDOWN_MS || 60 * 1000);
        if (lastSent && (now - lastSent) < cooldownMs) {
            const wait = Math.ceil((cooldownMs - (now - lastSent)) / 1000);
            return res.status(429).json({ message: 'Too many requests', retryAfterSeconds: wait });
        }

        // Generate 6-digit OTP
        const otp = String(crypto.randomInt(100000, 1000000));
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        const hashedOtp = await bcrypt.hash(otp, 10);

        // Save hashed OTP and expiry
        await sql.query('UPDATE users SET otp_hash = ?, otp_expiry = ?, otp_sent_at = ?, otp_attempts = 0 WHERE id = ?', [hashedOtp, otpExpiry, new Date(), userId]);

        // Send email
        const subject = 'Your D-Box verification code';
        const body = `Your verification code is:\n\n${otp}\n\nThis code expires in 10 minutes.`;
        const emailResult = await sendEmail(user.email, subject, body);

        if (!emailResult.success) {
            console.error('sendOtp: email send failed', emailResult.error);
            return res.status(500).json({ message: 'Unable to send OTP' });
        }

        return res.json({ success: true, message: 'OTP sent', cooldownSeconds: Math.ceil(cooldownMs / 1000) });
    } catch (error) {
        console.error('sendOtp failed:', error);
        return res.status(500).json({ message: 'Unable to send OTP', error: error.message });
    }
};

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
        const [rows] = await sql.query('SELECT id, email, otp_hash, otp_expiry, otp_attempts FROM users WHERE id = ? LIMIT 1', [userId]);
        const user = rows[0] || null;
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (!user.otp_hash || !user.otp_expiry) return res.status(400).json({ message: 'No OTP requested' });

        const now = Date.now();
        const expiry = user.otp_expiry ? new Date(user.otp_expiry).getTime() : 0;
        if (!expiry || now > expiry) {
            return res.status(400).json({ message: 'OTP expired' });
        }

        const maxAttempts = Number(process.env.OTP_MAX_ATTEMPTS || 5);
        if (Number(user.otp_attempts || 0) >= maxAttempts) {
            return res.status(429).json({ message: 'Too many attempts' });
        }

        const match = await bcrypt.compare(code, String(user.otp_hash || ''));
        if (!match) {
            // increment attempts
            await sql.query('UPDATE users SET otp_attempts = COALESCE(otp_attempts,0) + 1 WHERE id = ?', [userId]);
            return res.status(400).json({ message: 'Invalid code' });
        }

        // Success: clear OTP and mark verified
        await sql.query('UPDATE users SET is_verified = TRUE, otp_hash = NULL, otp_expiry = NULL, otp_sent_at = NULL, otp_attempts = 0, status = ? WHERE id = ?', ['active', userId]);

        // Update session if present
        if (req.session?.user) {
            req.session.user.isVerified = true;
        }

        return res.json({ success: true, message: 'Email verified' });
    } catch (error) {
        console.error('verifyOtp failed:', error);
        return res.status(500).json({ message: 'Unable to verify OTP', error: error.message });
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
            redirectUrl: `/uploads?boxId=${inviteBoxId}`,
            message: 'Invite processed for current user'
        });
    } catch (error) {
        return res.status(500).json({
            message: 'Unable to process invite',
            error: error.message
        });
    }
};
