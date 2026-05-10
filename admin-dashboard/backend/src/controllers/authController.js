import User from '../models/User.js';
import LoginHistory from '../models/LoginHistory.js';
import { comparePassword, getPasswordMode } from '../utils/password.js';
import { generateToken } from '../utils/jwt.js';

export const login = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const user = await User.findAuthByEmail(email);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.is_banned) {
      return res.status(403).json({ success: false, message: 'Your account has been banned' });
    }

    const passwordMode = getPasswordMode(user.password);

    if (passwordMode === 'google') {
      return res.status(403).json({
        success: false,
        message: 'Please continue with Google login',
      });
    }

    if (passwordMode !== 'bcrypt') {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isPasswordMatch = await comparePassword(password, user.password);

    if (!isPasswordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Create login history
    const loginRecord = await LoginHistory.create({
      userId: user.id,
      ipAddress,
      userAgent,
    });

    // Update last login
    await User.updateLastLogin(user.id, loginRecord.id);

    const token = generateToken(user.id, user.role);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        storageUsed: user.storage_used,
        storageLimit: user.storage_limit,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const logout = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (userId) {
      await LoginHistory.recordLogout(userId);
    }

    return res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const register = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const username = String(req.body.username || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const authProvider = String(req.body.authProvider || req.body.provider || 'local').trim().toLowerCase();
    const isGoogleSignup = authProvider === 'google';

    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required' });
    }

    if (!isGoogleSignup) {
      if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required' });
      }

      if (password.length < 8) {
        return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
      }
    }

    const generatedUsername = isGoogleSignup && !username
      ? `${email.split('@')[0]}-${Date.now().toString(36)}`
      : username;

    if (!generatedUsername) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    const existingUsername = await User.findByUsername(username);
    if (existingUsername) {
      return res.status(400).json({ success: false, message: 'Username already exists' });
    }

    const user = await User.create({
      name,
      username: generatedUsername,
      email,
      password: isGoogleSignup ? 'google_auth' : password,
      role: 'USER',
      authProvider: isGoogleSignup ? 'google' : 'local',
    });

    const token = generateToken(user.id, user.role);

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
