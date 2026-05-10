import ActivityLog from '../models/ActivityLog.js';
import User from '../models/User.js';

export const getActivityLogs = async (req, res) => {
  try {
    const { limit = 50, offset = 0, action = null } = req.query;

    let logs;
    if (action) {
      logs = await ActivityLog.getRecentLogs(parseInt(limit), parseInt(offset));
      logs = logs.filter(log => log.action === action);
    } else {
      logs = await ActivityLog.getRecentLogs(parseInt(limit), parseInt(offset));
    }

    // Enrich with user information
    const logsWithUsers = await Promise.all(
      logs.map(async (log) => {
        const admin = await User.findById(log.admin_id);
        const targetUser = log.target_user ? await User.findById(log.target_user) : null;
        return {
          ...log,
          admin: admin ? { id: admin.id, email: admin.email, name: admin.name } : null,
          targetUserData: targetUser ? { id: targetUser.id, email: targetUser.email, name: targetUser.name } : null,
        };
      })
    );

    const totalCount = await ActivityLog.getTotalLogCount();

    return res.status(200).json({
      success: true,
      data: logsWithUsers,
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

export const getUserActivityLogs = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const logs = await ActivityLog.getLogsByTargetUser(userId, parseInt(limit), parseInt(offset));
    const totalCount = await ActivityLog.getTotalLogCount();

    return res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
