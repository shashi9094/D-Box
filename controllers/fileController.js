const db = require('../db/connection');

const sql = db.promise();

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
