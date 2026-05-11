const db = require('../db/connection');
const { getFileWithSignedUrls, extractObjectKeyFromValue } = require('../services/s3SignedUrl');

const sql = db.promise();

/**
 * Generate a signed URL for a file
 * GET /api/files/:id/signed-url
 */
exports.getSignedUrl = async (req, res) => {
    const { id } = req.params;
    const numericId = Number(id);

    try {
        if (!Number.isFinite(numericId) || numericId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid file id',
            });
        }

        // Fetch file from database
        const [rows] = await sql.query(
            `SELECT id, box_id, uploaded_by, content_type, file_name, file_path, original_name
             FROM box_contents
             WHERE id = ?
             LIMIT 1`,
            [numericId]
        );

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message: 'File not found',
            });
        }

        const fileData = rows[0];

        // Verify user has access to this box
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated',
            });
        }

        const [accessCheck] = await sql.query(
            `SELECT 1 FROM box_members
             WHERE box_id = ? AND user_id = ?
             LIMIT 1`,
            [fileData.box_id, userId]
        );

        if (!accessCheck.length && fileData.box_id !== 0) {
            // Also check if user owns the box
            const [ownerCheck] = await sql.query(
                `SELECT 1 FROM boxes WHERE id = ? AND user_id = ? LIMIT 1`,
                [fileData.box_id, userId]
            );

            if (!ownerCheck.length) {
                return res.status(403).json({
                    success: false,
                    message: 'You do not have access to this file',
                });
            }
        }

        // Generate signed URL
        const result = await getFileWithSignedUrls(fileData, {
            expirationSeconds: 3600, // 1 hour
            download: req.query.download === 'true',
        });

        if (!result.success) {
            console.error('Failed to generate signed URL for file:', result.error);
            return res.status(500).json({
                success: false,
                message: 'Failed to generate file URL',
                error: result.error,
            });
        }

        console.log('✓ Signed URL generated for file:', {
            fileId: numericId,
            fileName: result.fileName,
            expiresAt: result.expiresAt,
        });

        return res.json({
            success: true,
            url: result.fileUrl,
            fileUrl: result.fileUrl,
            fileName: result.fileName,
            originalName: fileData.original_name || fileData.file_name,
            contentType: result.contentType,
            objectKey: result.objectKey,
            expiresAt: result.expiresAt,
            thumbnailUrl: result.thumbnailUrl || null,
        });
    } catch (error) {
        console.error('Error generating signed URL:', {
            fileId: numericId,
            message: error.message,
            code: error.code || null,
        });

        return res.status(500).json({
            success: false,
            message: 'Failed to generate file URL',
            error: error.message,
        });
    }
};

/**
 * Open a file through the backend and redirect to the underlying URL.
 * GET /api/files/:id/view
 */
exports.getFileView = async (req, res) => {
    const { id } = req.params;
    const numericId = Number(id);

    try {
        if (!Number.isFinite(numericId) || numericId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid file id',
            });
        }

        const [rows] = await sql.query(
            `SELECT id, box_id, uploaded_by, content_type, file_name, file_path, original_name
             FROM box_contents
             WHERE id = ?
             LIMIT 1`,
            [numericId]
        );

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message: 'File not found',
            });
        }

        const fileData = rows[0];
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated',
            });
        }

        const [accessCheck] = await sql.query(
            `SELECT 1 FROM box_members
             WHERE box_id = ? AND user_id = ?
             LIMIT 1`,
            [fileData.box_id, userId]
        );

        if (!accessCheck.length && fileData.box_id !== 0) {
            const [ownerCheck] = await sql.query(
                `SELECT 1 FROM boxes WHERE id = ? AND user_id = ? LIMIT 1`,
                [fileData.box_id, userId]
            );

            if (!ownerCheck.length) {
                return res.status(403).json({
                    success: false,
                    message: 'You do not have access to this file',
                });
            }
        }

        const filePath = String(fileData.file_path || '').trim();
        if (/^https?:\/\//i.test(filePath)) {
            return res.redirect(filePath);
        }

        const result = await getFileWithSignedUrls(fileData, {
            expirationSeconds: 3600,
        });

        if (!result.success || !result.fileUrl) {
            console.error('Failed to generate file view URL:', result.error);
            return res.status(500).json({
                success: false,
                message: 'Failed to generate file URL',
                error: result.error,
            });
        }

        return res.redirect(result.fileUrl);
    } catch (error) {
        console.error('Error opening file view:', {
            fileId: numericId,
            message: error.message,
            code: error.code || null,
        });

        return res.status(500).json({
            success: false,
            message: 'Failed to open file',
            error: error.message,
        });
    }
};

exports.getFileById = async (req, res) => {
    const { id } = req.params;

    // Request logging for debugging route params and URL hit
    console.log('[GET /api/files/:id] request', {
        originalUrl: req.originalUrl,
        method: req.method,
        params: req.params,
        id
    });

    const numericId = Number(id);
    if (!Number.isFinite(numericId) || numericId <= 0) {
        return res.status(400).json({
            success: false,
            message: 'Invalid file id. Use a positive number in /api/files/:id'
        });
    }

    try {
        const [rows] = await sql.query(
            `SELECT id, box_id, uploaded_by, content_type, file_name, file_path, original_name, note_text, admin_note, folder_path, created_at
             FROM box_contents
             WHERE id = ?
             LIMIT 1`,
            [numericId]
        );

        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'File not found' });
        }

        return res.json({ success: true, data: rows[0] });
    } catch (error) {
        console.error('[GET /api/files/:id] DB error', {
            id: numericId,
            message: error.message,
            code: error.code || null,
            detail: error.detail || null
        });

        return res.status(500).json({ success: false, message: 'Unable to fetch file', error: error.message });
    }
};

/**
 * List all files in a box with signed URLs
 * GET /api/files/box/:boxId
 */
exports.getBoxFiles = async (req, res) => {
    const { boxId } = req.params;
    const userId = req.user?.id;

    try {
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated',
            });
        }

        // Verify user has access to this box
        const [accessCheck] = await sql.query(
            `SELECT 1 FROM box_members
             WHERE box_id = ? AND user_id = ?
             LIMIT 1`,
            [boxId, userId]
        );

        if (!accessCheck.length) {
            const [ownerCheck] = await sql.query(
                `SELECT 1 FROM boxes WHERE id = ? AND user_id = ? LIMIT 1`,
                [boxId, userId]
            );
            if (!ownerCheck.length) {
                return res.status(403).json({
                    success: false,
                    message: 'You do not have access to this box',
                });
            }
        }

        // Fetch all files in the box
        const [rows] = await sql.query(
            `SELECT id, box_id, uploaded_by, content_type, file_name, file_path, original_name, created_at
             FROM box_contents
             WHERE box_id = ? AND content_type IN ('file', 'video')
             ORDER BY created_at DESC`,
            [boxId]
        );

        // Generate signed URLs for all files
        const filesWithUrls = await Promise.all(
            rows.map(async (fileData) => {
                try {
                    return await getFileWithSignedUrls(fileData, {
                        expirationSeconds: 3600,
                    });
                } catch (error) {
                    console.warn('Failed to generate signed URL:', error.message);
                    return {
                        id: fileData.id,
                        fileName: fileData.original_name || fileData.file_name,
                        success: false,
                        error: error.message,
                    };
                }
            })
        );

        return res.json({
            success: true,
            data: filesWithUrls,
            count: filesWithUrls.length,
        });
    } catch (error) {
        console.error('Error fetching box files:', {
            boxId,
            message: error.message,
            code: error.code || null,
        });

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch files',
            error: error.message,
        });
    }
};
