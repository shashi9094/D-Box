function requireSixDigitOtp(fieldName = 'code') {
    return (req, res, next) => {
        const raw = String(req.body?.[fieldName] || '').trim();
        if (!/^[0-9]{6}$/.test(raw)) {
            return res.status(400).json({ message: `Invalid ${fieldName} format` });
        }

        req.body[fieldName] = raw;
        return next();
    };
}

module.exports = {
    requireSixDigitOtp,
};
