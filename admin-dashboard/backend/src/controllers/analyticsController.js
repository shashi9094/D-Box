import User from '../models/User.js';
import ActivityLog from '../models/ActivityLog.js';

export const getStats = async (req, res) => {
  try {
    const stats = await User.getStatistics();
    const actionStats = await ActivityLog.getActionStats();
    const dailyActivity = await ActivityLog.getDailyActivityStats(30);

    return res.status(200).json({
      success: true,
      data: {
        overview: {
          totalUsers: parseInt(stats.total_users),
          activeUsers: parseInt(stats.active_users),
          totalFiles: parseInt(stats.total_files),
          totalStorageUsed: parseInt(stats.total_storage_used),
          avgStoragePerUser: parseFloat(stats.avg_storage_per_user),
        },
        actionStats,
        dailyActivity,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getDashboardMetrics = async (req, res) => {
  try {
    const stats = await User.getStatistics();

    // Calculate growth trends
    const recentLogs = await ActivityLog.getRecentLogs(100, 0);
    const registrationCount = recentLogs.filter(log => log.action === 'USER_REGISTERED').length;

    return res.status(200).json({
      success: true,
      data: {
        metrics: {
          totalUsers: parseInt(stats.total_users),
          activeUsers: parseInt(stats.active_users),
          totalFiles: parseInt(stats.total_files),
          totalStorageUsed: parseInt(stats.total_storage_used),
          storageUsedGB: (parseInt(stats.total_storage_used) / (1024 ** 3)).toFixed(2),
          avgStoragePerUser: (parseFloat(stats.avg_storage_per_user) / (1024 ** 3)).toFixed(2),
          recentRegistrations: registrationCount,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
