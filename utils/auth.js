const jwt = require("jsonwebtoken");
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

module.exports = (req, res, next) => {
    if (req.session?.user) {
        const loginAt = Number(req.session.user.loginAt || 0);
        const isExpired = !Number.isFinite(loginAt) || (Date.now() - loginAt) > SESSION_MAX_AGE_MS;

        if (isExpired) {
            return req.session.destroy(() => {
                res.clearCookie("connect.sid");
                return res.status(401).json({ message: "Session expired. Please login again." });
            });
        }

        req.user = req.session.user;
        return next();
    }

    const token = req.header("Authorization")?.split(" ")[1];
    if (!token) {
        return res.status(401).json({ message: "Access denied. No token provided." });
    }

    if (!process.env.JWT_SECRET) {
        return res.status(500).json({ message: "JWT secret is not configured." });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: "Invalid token." });
        }
        req.user = user;
        next();
    });
};      
