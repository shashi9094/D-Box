const db = require(`../db/connection`);
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");    

// SIGNUP
exports.signup = async (req, res) => {
    try {
        const {
            fullname,
            dob,
            email,
            country,
            capacity,
            purpose,
            password
        } = req.body;

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
                (fullname, dob, email, country, capacity, purpose, password) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            db.query(
                insertSql,
                [fullname, dob, email, country, capacity, purpose, hashedPassword],
                (err, result) => {
                    if (err) {
                        return res.status(500).json({
                            message: "Signup failed",
                            error: err
                        });
                    }
                    res.json({ message: "Signup successful" });
                }
            );
        });

    } catch (err) {
        res.status(500).json({ message: "Signup failed", error: err });
    }
};



// LOGIN


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
