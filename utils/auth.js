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
    }
            if (req.session?.user && req.session.user.id && req.session.user.email) {
                const loginAt = Number(req.session.user.loginAt || 0);
                const userId = Number(req.session.user.id);
                const isValidSession = Number.isFinite(userId) && userId > 0 && Number.isFinite(loginAt) && loginAt > 0;
                const isExpired = !isValidSession || (Date.now() - loginAt) > SESSION_MAX_AGE_MS;

    const token = req.header("Authorization")?.split(" ")[1];
    if (!token) {
        return res.status(401).json({ message: "Access denied. No token provided." });
    }

    if (!process.env.JWT_SECRET) {
        return res.status(500).json({ message: "JWT secret is not configured." });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (err) {
                console.warn(`[JWT_VERIFICATION_FAILED] Token verification failed. Error: ${err.message}`);
                return res.status(403).json({ message: "Invalid token." });
            }
            if (!user || !user.id) {
                console.warn('[JWT_INVALID_PAYLOAD] Token has invalid payload structure');
                return res.status(403).json({ message: "Invalid token." });
            }
            req.user = user;
            next();
    });
};      
