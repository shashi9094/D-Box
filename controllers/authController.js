const db = require(`../db/connection`);
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");    
const crypto = require('crypto');
const boxController = require('./boxController');
const { logLoginHistory, isNewDeviceLogin } = require('../utils/loginHistory');
const { createNotification } = require('../utils/notifications');
const { sendEmail } = require('../emailService');

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
    console.log("SIGNUP HIT");
    console.log("BODY:", req.body);
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
            ? `/uploads?boxId=${safeInviteBoxId}`
            : '/home';

        const fullName = fullname; // Just to maintain the same variable name as before
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const normalizedFullName = String(fullName || '').trim();
        const normalizedPassword = String(password || '');
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

        if (!normalizedFullName || !normalizedEmail) {
            return res.status(400).json({ message: 'Full name and email are required' });
        }

        if (!normalizedPassword) {
            return res.status(400).json({ message: 'Password is required' });
        }

        // Step 1 → Pehle check karo ki email already exist to nahi karta
        const checkSql = "SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1";
        db.query(checkSql, [normalizedEmail], async (err, results) => {
            if (err) {
                console.error('Signup email check failed:', {
                    code: err.code || null,
                    message: err.message || null,
                    detail: err.detail || null,
                    hint: err.hint || null,
                });
                return res.status(500).json({
                    message: "Database error",
                    error: err.message || err,
                    code: err.code || null
                });
            }

            if (results.length > 0) {
                return res.status(400).json({
                    message: "Email already exists"
                });
            }

            // Step 2 → Password hash karo
            const hashedPassword = await bcrypt.hash(normalizedPassword, 10);

            // Step 3 → Database me insert karo
            const insertSql = `
                INSERT INTO users 
                (fullname, dob, email, country, capacity, purpose, role, password, verification_token, is_verified, token_expires) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (email) DO NOTHING
                RETURNING id
            `;

            db.query(
                insertSql,
                [normalizedFullName, dob || null, normalizedEmail, country || null, capacity || null, purpose || null, 'User', hashedPassword, verificationToken, false, tokenExpiresAt],
                async (err, result) => {
                    if (err) {
                        console.error('Signup insert failed:', {
                            code: err.code || null,
                            message: err.message || null,
                            detail: err.detail || null,
                            hint: err.hint || null,
                        });
                        return res.status(500).json({
                            message: "Signup failed",
                            error: err.message || err,
                            code: err.code || null
                        });
                    }

                    if (!result || !result.insertId) {
                        return res.status(400).json({
                            message: 'Email already exists'
                        });
                    }

                    try {
                        await boxController.acceptPendingInvitesForUser(result.insertId, email, inviteToken);
                    } catch (inviteErr) {
                        console.error('Pending invite sync failed after signup:', inviteErr.message);
                    }

                    // Create session so new users are treated as logged-in immediately
                    try {
                        req.session.user = {
                            id: result.insertId,
                            email: normalizedEmail,
                            loginAt: Date.now()
                        };
                        req.session.cookie.maxAge = SESSION_MAX_AGE_MS;
                    } catch (sessErr) {
                        console.warn('Unable to create session after signup:', sessErr && sessErr.message ? sessErr.message : sessErr);
                    }

                    const verificationUrl = `${getAppBaseUrl(req)}/verify-email?token=${verificationToken}`;
                    const emailBody = buildVerificationEmail(normalizedFullName, verificationUrl);

                    const emailResult = await sendEmail(normalizedEmail, emailBody.subject, emailBody.text);
                    if (!emailResult.success) {
                        console.error('Verification email send failed after signup:', emailResult.error);

                        // best-effort cleanup: if email fails, rollback the user so system remains consistent
                        db.query('DELETE FROM users WHERE id = ?', [result.insertId], () => {});

                        return res.status(500).json({
                            message: 'Signup failed while sending verification email',
                            error: emailResult.error
                        });
                    }

                    // Respond with redirect to home (or invite target) so frontend can continue flow
                    return req.session.save((saveErr) => {
                        if (saveErr) {
                            console.warn('Session save after signup failed:', saveErr && saveErr.message ? saveErr.message : saveErr);
                        }

                        return res.status(201).json({
                            message: 'Signup successful. Verification email sent.',
                            success: true,
                            redirectUrl: redirectUrl
                        });
                    });
                }
            );
        });

    } catch (err) {
        res.status(500).json({ message: "Signup failed", error: err });
    }
};



// LOGIN
exports.login = async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const inviteBoxId = Number(req.body.inviteBoxId);
    const inviteToken = String(req.body.inviteToken || '').trim();
    const redirectUrl = Number.isFinite(inviteBoxId) && inviteBoxId > 0
        ? `/uploads?boxId=${inviteBoxId}`
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

        let isMatch = false;

        // Support both bcrypt-hashed and legacy plain-text passwords.
        if (typeof user.password === "string" && user.password.startsWith("$2")) {
            isMatch = await bcrypt.compare(password, user.password);
        } else {
            isMatch = password === user.password;
            if (isMatch) {
                const upgradedHash = await bcrypt.hash(password, 10);
                db.query("UPDATE users SET password = ? WHERE email = ?", [upgradedHash, email], () => {
                    // Best effort migration; login should continue even if update fails.
                });
            }
        }

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
