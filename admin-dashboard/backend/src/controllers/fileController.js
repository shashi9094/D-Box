import File from '../models/File.js';
import ActivityLog from '../models/ActivityLog.js';
import User from '../models/User.js';
import { deleteFileFromS3 } from '../utils/s3.js';

export const getAllFiles = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const files = await File.getAllFiles(parseInt(limit), parseInt(offset));
    const totalCount = await File.getTotalFileCount();

    // Enrich with user information
    const filesWithUser = await Promise.all(
      files.map(async (file) => {
        const user = await User.findById(file.user_id);
        return {
          ...file,
          user: user,
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: filesWithUser,
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

export const getUserFiles = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const files = await File.getFilesByUser(userId, parseInt(limit), parseInt(offset));
    const totalCount = await File.getUserFileCount(userId);

    return res.status(200).json({
      success: true,
      data: files,
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

export const deleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const adminId = req.user.userId;

    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    const user = await User.findById(file.user_id);

    // Delete from S3
    const s3Key = file.file_url.split('/').slice(-2).join('/');
    await deleteFileFromS3(s3Key);

    // Soft delete from database
    await File.softDelete(fileId);

    // Update user storage
    await User.update(file.user_id, {
      storage_used: Math.max(0, user.storage_used - file.file_size),
    });

    // Log activity
    await ActivityLog.create({
      adminId,
      action: 'FILE_DELETED',
      targetUser: file.user_id,
      targetFile: fileId,
      description: `File ${file.file_name} deleted by admin`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
