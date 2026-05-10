import User from '../models/User.js';
import File from '../models/File.js';
import ActivityLog from '../models/ActivityLog.js';
import LoginHistory from '../models/LoginHistory.js';
import { deleteFileFromS3 } from '../utils/s3.js';

export const getAllUsers = async (req, res) => {
  try {
    const { limit = 20, offset = 0, search = '' } = req.query;
    
    const users = await User.getAllUsers(parseInt(limit), parseInt(offset), search);
    const totalCount = await User.getUserCount(search);

    return res.status(200).json({
      success: true,
      data: users,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(totalCount / parseInt(limit)),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const files = await File.getFilesByUser(id, 10);
    const loginHistory = await LoginHistory.getLoginHistory(id, 5);
    const activityLogs = await ActivityLog.getLogsByTargetUser(id, 5);

    return res.status(200).json({
      success: true,
      data: {
        ...user,
        files,
        loginHistory,
        activityLogs,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserByEmail = async (req, res) => {
  try {
    const { email } = req.params;

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const files = await File.getFilesByUser(user.id, 10);
    const loginHistory = await LoginHistory.getLoginHistory(user.id, 5);
    const activityLogs = await ActivityLog.getLogsByTargetUser(user.id, 5);

    return res.status(200).json({
      success: true,
      data: {
        ...user,
        files,
        loginHistory,
        activityLogs,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const banUser = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.userId;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const updatedUser = await User.banUser(id);

    // Log activity
    await ActivityLog.create({
      adminId,
      action: 'USER_BANNED',
      targetUser: id,
      description: `User ${user.email} has been banned`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: 'User banned successfully',
      data: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const unbanUser = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.userId;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const updatedUser = await User.unbanUser(id);

    // Log activity
    await ActivityLog.create({
      adminId,
      action: 'USER_UNBANNED',
      targetUser: id,
      description: `User ${user.email} has been unbanned`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: 'User unbanned successfully',
      data: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const changeUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const adminId = req.user.userId;

    if (!['USER', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const oldRole = user.role;
    const updatedUser = await User.update(id, { role });

    // Log activity
    await ActivityLog.create({
      adminId,
      action: 'ROLE_CHANGED',
      targetUser: id,
      description: `User ${user.email} role changed from ${oldRole} to ${role}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: 'User role changed successfully',
      data: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateStorageLimit = async (req, res) => {
  try {
    const { id } = req.params;
    const { storageLimit } = req.body;
    const adminId = req.user.userId;

    if (!storageLimit || storageLimit < 0) {
      return res.status(400).json({ success: false, message: 'Invalid storage limit' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const updatedUser = await User.update(id, { storage_limit: storageLimit });

    // Log activity
    await ActivityLog.create({
      adminId,
      action: 'STORAGE_LIMIT_CHANGED',
      targetUser: id,
      description: `User ${user.email} storage limit changed to ${storageLimit} bytes`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: 'Storage limit updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.userId;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Delete all files associated with user
    const userFiles = await File.getFilesByUser(id, 1000);
    for (const file of userFiles) {
      const s3Key = file.file_url.split('/').slice(-2).join('/');
      await deleteFileFromS3(s3Key);
      await File.delete(file.id);
    }

    await User.delete(id);

    // Log activity
    await ActivityLog.create({
      adminId,
      action: 'USER_DELETED',
      targetUser: id,
      description: `User ${user.email} has been deleted`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const loginAsUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Generate token as if the user is logging in
    const { generateToken } = await import('../utils/jwt.js');
    const token = generateToken(user.id, user.role);

    // Log activity
    await ActivityLog.create({
      adminId,
      action: 'LOGIN_AS_USER',
      targetUser: userId,
      description: `Admin ${req.user.email} logged in as ${user.email}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: 'Logged in as user',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
