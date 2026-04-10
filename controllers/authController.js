const db = require(`../db/connection`);
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");    
const boxController = require('./boxController');

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

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
            inviteBoxId
        } = req.body;

        const safeInviteBoxId = Number(inviteBoxId);
        const redirectUrl = Number.isFinite(safeInviteBoxId) && safeInviteBoxId > 0
            ? `/uploads?boxId=${safeInviteBoxId}`
            : '/home';

        const fullName = fullname; // Just to maintain the same variable name as before

        // Step 1 → Pehle check karo ki email already exist to nahi karta
        const checkSql = "SELECT * FROM users WHERE email = ?";
        db.query(checkSql, [email], async (err, results) => {
            if (err) {
                return res.status(500).json({
                    message: "Database error",
                    error: err
                });
            }

            if (results.length > 0) {
                return res.status(400).json({
                    message: "Email already exists"
                });
            }

            // Step 2 → Password hash karo
            const hashedPassword = await bcrypt.hash(password, 10);

            // Step 3 → Database me insert karo
            const insertSql = `
                INSERT INTO users 
                (fullName, dob, email, country, capacity, purpose, password) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            db.query(
                insertSql,
                [fullName, dob, email, country, capacity, purpose, hashedPassword],
                async (err, result) => {
                    if (err) {
                        return res.status(500).json({
                            message: "Signup failed",
                            error: err
                        });
                    }

                    try {
                        await boxController.acceptPendingInvitesForUser(result.insertId, email);
                    } catch (inviteErr) {
                        console.error('Pending invite sync failed after signup:', inviteErr.message);
                    }

                    req.session.user = {
                        id: result.insertId,
                        email: email,
                        loginAt: Date.now()
                    };

                    req.session.cookie.maxAge = SESSION_MAX_AGE_MS;

                    req.session.save((saveErr) => {
                        if (saveErr) {
                            return res.status(500).json({
                                message: "Session save failed",
                                error: saveErr
                            });
                        }

                        res.json({
                            message: "Signup successful",
                            redirectUrl
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
    const redirectUrl = Number.isFinite(inviteBoxId) && inviteBoxId > 0
        ? `/uploads?boxId=${inviteBoxId}`
        : '/home';

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }

    const sql = "SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1";

    db.query(sql, [email], async (err, results) => {
        if (err) {
            return res.status(500).json({
                message: "DB error",
                errorCode: err.code || null,
                error: err
            });
        }

        if (results.length === 0) {
            return res.status(400).json({ message: "User not found" });
        }

        const user = results[0];

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
            await boxController.acceptPendingInvitesForUser(user.id, user.email);
        } catch (inviteErr) {
            console.error('Pending invite sync failed after login:', inviteErr.message);
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

            return res.json({
                message: "Login successful",
                redirectUrl
            });
        });
    });
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

// Accept invite from link for currently logged-in user.
exports.acceptInviteForSession = async (req, res) => {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.id || !sessionUser.email) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    const inviteBoxId = Number(req.body && req.body.inviteBoxId);
    const inviteEmail = String(req.body && req.body.inviteEmail || '').trim().toLowerCase();
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
        await boxController.acceptPendingInvitesForUser(sessionUser.id, sessionUser.email);

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
