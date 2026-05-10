import Settings from '../models/Settings.js';
import ActivityLog from '../models/ActivityLog.js';

export const getSettings = async (req, res) => {
  try {
    const settings = await Settings.getAll();

    return res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const { settings } = req.body;
    const adminId = req.user.userId;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid settings format' });
    }

    const updatedSettings = {};
    for (const [key, value] of Object.entries(settings)) {
      const result = await Settings.set(key, String(value));
      updatedSettings[key] = result.value;
    }

    // Log activity
    await ActivityLog.create({
      adminId,
      action: 'SETTINGS_UPDATED',
      description: `System settings updated: ${Object.keys(settings).join(', ')}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: updatedSettings,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getSetting = async (req, res) => {
  try {
    const { key } = req.params;

    const setting = await Settings.get(key);
    if (!setting) {
      return res.status(404).json({ success: false, message: 'Setting not found' });
    }

    return res.status(200).json({
      success: true,
      data: setting,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
