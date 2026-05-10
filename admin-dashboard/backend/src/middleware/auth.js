import { verifyToken } from '../utils/jwt.js';
import User from '../models/User.js';

export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7).trim()
      : null;

    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (user.is_banned) {
      return res.status(403).json({ success: false, message: 'User is banned' });
    }

    const { password, ...safeUser } = user;
    req.user = { userId: user.id, role: user.role, ...safeUser };
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

export const superAdminMiddleware = (req, res, next) => {
  if (req.user?.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ success: false, message: 'Access denied. Only SUPER_ADMIN can access this.' });
  }
  next();
};

export const adminMiddleware = (req, res, next) => {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: 'Access denied. Only ADMIN can access this.' });
  }
  next();
};
