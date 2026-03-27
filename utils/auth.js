const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
    if (req.session?.user) {
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
