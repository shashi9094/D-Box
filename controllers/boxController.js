const db = require('../db/connection');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { sendInvitationEmail } = require('../utils/emailService');

const uploadsDir = path.join(__dirname, '..', 'uploads', 'boxes');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage });

const sql = db.promise();
let tablesReady = false;

const ensureCollaborationTables = async () => {
    if (tablesReady) return;

    await sql.query(`
        CREATE TABLE IF NOT EXISTS box_members (
            id INT AUTO_INCREMENT PRIMARY KEY,
            box_id INT NOT NULL,
            user_id INT NOT NULL,
            role ENUM('admin', 'member') NOT NULL DEFAULT 'member',
            added_by INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_box_user (box_id, user_id)
        )
    `);

    await sql.query(`
        CREATE TABLE IF NOT EXISTS box_contents (
            id INT AUTO_INCREMENT PRIMARY KEY,
            box_id INT NOT NULL,
            uploaded_by INT NOT NULL,
            content_type ENUM('file', 'note', 'video') NOT NULL DEFAULT 'file',
            file_name VARCHAR(255) NULL,
            file_path VARCHAR(500) NULL,
            original_name VARCHAR(255) NULL,
            note_text TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await sql.query(`
        CREATE TABLE IF NOT EXISTS box_invites (
            id INT AUTO_INCREMENT PRIMARY KEY,
            box_id INT NOT NULL,
            email VARCHAR(255) NOT NULL,
            role ENUM('admin', 'member') NOT NULL DEFAULT 'member',
            invited_by INT NOT NULL,
            status ENUM('pending', 'accepted', 'revoked') NOT NULL DEFAULT 'pending',
            accepted_by INT NULL,
            accepted_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_box_email_status (box_id, email, status)
        )
    `);

    // Keep owner permissions consistent for old/inconsistent records.
    await sql.query(`
        UPDATE box_members bm
        JOIN boxes b ON b.id = bm.box_id
        SET bm.role = 'admin'
        WHERE bm.user_id = b.user_id AND bm.role <> 'admin'
    `);

    tablesReady = true;
};

const getMembership = async (boxId, userId) => {
    const [ownerRows] = await sql.query(
        'SELECT user_id FROM boxes WHERE id = ? LIMIT 1',
        [boxId]
    );

    if (ownerRows.length && Number(ownerRows[0].user_id) === Number(userId)) {
        return { role: 'admin' };
    }

    const [rows] = await sql.query(
        'SELECT role FROM box_members WHERE box_id = ? AND user_id = ? LIMIT 1',
        [boxId, userId]
    );
    return rows[0] || null;
};

const ensureAdmin = async (boxId, userId) => {
    const membership = await getMembership(boxId, userId);
    return membership && membership.role === 'admin';
};

const inferContentType = (file) => {
    if (!file || !file.mimetype) return 'file';
    if (file.mimetype.startsWith('video/')) return 'video';
    return 'file';
};

const normalizeBaseUrl = (value) => String(value || '').trim().replace(/\/$/, '');

const isLocalHost = (host) => /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(host || '').trim());

const getHostFromUrl = (value) => {
    try {
        return new URL(String(value || '')).host;
    } catch (error) {
        return '';
    }
};

const resolvePublicBaseUrl = (req) => {
    const configuredPublicUrl = normalizeBaseUrl(
        process.env.PUBLIC_APP_URL || process.env.INVITE_BASE_URL || process.env.APP_URL
    );

    if (configuredPublicUrl && !isLocalHost(getHostFromUrl(configuredPublicUrl))) {
        return configuredPublicUrl;
    }

    const forwardedHost = req.headers['x-forwarded-host'];
    const forwardedProto = req.headers['x-forwarded-proto'];
    const host = normalizeBaseUrl(forwardedHost || req.get('host'));
    const proto = normalizeBaseUrl((forwardedProto || req.protocol || 'http').split(',')[0]);

    if (host && !isLocalHost(host)) {
        return `${proto}://${host}`;
    }

    return configuredPublicUrl || `${proto}://${host || 'localhost:5000'}`;
};

exports.acceptPendingInvitesForUser = async (userId, email) => {
    await ensureCollaborationTables();

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail || !userId) return;

    const [invites] = await sql.query(
        `SELECT id, box_id, role, invited_by
         FROM box_invites
         WHERE email = ? AND status = 'pending'`,
        [normalizedEmail]
    );

    for (const invite of invites) {
        await sql.query(
            `INSERT INTO box_members (box_id, user_id, role, added_by)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                role = CASE WHEN role = 'admin' THEN 'admin' ELSE VALUES(role) END,
                added_by = VALUES(added_by)`,
            [invite.box_id, userId, invite.role, invite.invited_by]
        );

        await sql.query(
            `UPDATE box_invites
             SET status = 'accepted', accepted_by = ?, accepted_at = NOW()
             WHERE id = ?`,
            [userId, invite.id]
        );
    }
};

// Create Box
exports.createBox = async (req, res) => {
    const { title, description } = req.body;
    const userId = req.user.id;

    if (!title || !description) {
        return res.status(400).json({ message: 'Title and description are required' });
    }

    try {
        await ensureCollaborationTables();

        const [result] = await sql.query(
            'INSERT INTO boxes (user_id, title, description) VALUES (?, ?, ?)',
            [userId, title, description]
        );

        await sql.query(
            `INSERT INTO box_members (box_id, user_id, role, added_by)
             VALUES (?, ?, 'admin', ?)
             ON DUPLICATE KEY UPDATE role = 'admin'`,
            [result.insertId, userId, userId]
        );

        return res.json({
            success: true,
            message: 'Box created successfully',
            id: result.insertId
        });
    } catch (err) {
        return res.status(500).json({ error: 'Error creating box', details: err.message });
    }
};

// Get All Boxes
exports.getAllBoxes = async (req, res) => {
    const userId = req.user.id;

    try {
        await ensureCollaborationTables();

        const [results] = await sql.query(
            `SELECT b.*,
                    CASE
                        WHEN b.user_id = ? THEN 'admin'
                        WHEN MAX(CASE WHEN bm.role = 'admin' THEN 1 ELSE 0 END) = 1 THEN 'admin'
                        ELSE 'member'
                    END AS role
             FROM boxes b
             JOIN box_members bm ON bm.box_id = b.id
             WHERE bm.user_id = ?
             GROUP BY b.id
             ORDER BY b.id DESC`,
            [userId, userId]
        );

        return res.json(results);
    } catch (err) {
        return res.status(500).json({ message: 'Error fetching boxes', details: err.message });
    }
};

// Get Single Box
exports.getBoxById = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        await ensureCollaborationTables();
        const membership = await getMembership(id, userId);
        if (!membership) {
            return res.status(403).json({ message: 'You do not have access to this box' });
        }

        const [rows] = await sql.query('SELECT * FROM boxes WHERE id = ? LIMIT 1', [id]);
        return res.json(rows[0] || null);
    } catch (err) {
        return res.status(500).json({ message: 'Error fetching box', details: err.message });
    }
};

// Update Box
exports.updateBox = async (req, res) => {
    const { id } = req.params;
    const { title, description } = req.body;
    const userId = req.user.id;

    try {
        await ensureCollaborationTables();
        const isAdmin = await ensureAdmin(id, userId);
        if (!isAdmin) {
            return res.status(403).json({ message: 'Only admin can update this box' });
        }

        await sql.query(
            'UPDATE boxes SET title = ?, description = ? WHERE id = ?',
            [title, description, id]
        );

        return res.json({ success: true, message: 'Box updated successfully' });
    } catch (err) {
        return res.status(500).json({ message: 'Error updating box', details: err.message });
    }
};      

// Delete Box
exports.deleteBox = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        await ensureCollaborationTables();
        const isAdmin = await ensureAdmin(id, userId);
        if (!isAdmin) {
            return res.status(403).json({ message: 'Only admin can delete this box' });
        }

        await sql.query('DELETE FROM box_contents WHERE box_id = ?', [id]);
        await sql.query('DELETE FROM box_members WHERE box_id = ?', [id]);
        await sql.query('DELETE FROM boxes WHERE id = ?', [id]);

        return res.json({ success: true, message: 'Box deleted successfully' });
    } catch (err) {
        return res.status(500).json({ message: 'Error deleting box', details: err.message });
    }
};

//DASHBOARD MY BOX API

exports.getMyBoxes = async (req, res) => {
    const userId = req.user.id;

    try {
        await ensureCollaborationTables();

        const [rows] = await sql.query(
            `SELECT b.*,
                    CASE
                        WHEN b.user_id = ? THEN 'admin'
                        WHEN MAX(CASE WHEN bm.role = 'admin' THEN 1 ELSE 0 END) = 1 THEN 'admin'
                        ELSE 'member'
                    END AS role
             FROM boxes b
             JOIN box_members bm ON bm.box_id = b.id
             WHERE bm.user_id = ?
             GROUP BY b.id
             ORDER BY b.id DESC`,
            [userId, userId]
        );

        return res.json({
            success: true,
            data: rows
        });
    } catch (err) {
        return res.status(500).json({ message: 'DB error', error: err.message });
    }
};

//EXISTING BOX (OTHER USER'S BOX) API

exports.getOtherUsersBoxes = async (req, res) => {
    const userId = req.user.id;

    try {
        await ensureCollaborationTables();

        const [rows] = await sql.query(
            `SELECT b.*, u.fullName, bm.role
             FROM box_members bm
             JOIN boxes b ON b.id = bm.box_id
             JOIN users u ON u.id = b.user_id
             WHERE bm.user_id = ? AND b.user_id != ?
             ORDER BY b.id DESC`,
            [userId, userId]
        );

        return res.json({
            success: true,
            data: rows
        });
    } catch (err) {
        return res.status(500).json({ message: 'DB error', error: err.message });
    }
};

exports.addMemberByEmail = async (req, res) => {
    const { boxId } = req.params;
    const { email, emails, role } = req.body;
    const currentUserId = req.user.id;
    const safeRole = role === 'admin' ? 'admin' : 'member';
    const rawEmails = Array.isArray(emails)
        ? emails
        : String(emails || email || '').split(/[\n,;]+/);

    const normalizedEmails = [...new Set(
        rawEmails
            .map((item) => String(item || '').trim().toLowerCase())
            .filter(Boolean)
    )];

    if (!normalizedEmails.length) {
        return res.status(400).json({ message: 'At least one valid email is required' });
    }

    try {
        await ensureCollaborationTables();

        const isAdmin = await ensureAdmin(boxId, currentUserId);
        if (!isAdmin) {
            return res.status(403).json({ message: 'Only admin can add members' });
        }

        // Get box details and sender's name
        const [boxes] = await sql.query(
            'SELECT title FROM boxes WHERE id = ? LIMIT 1',
            [boxId]
        );
        const boxTitle = boxes && boxes[0] ? boxes[0].title : 'D-Box Group';

        const [senders] = await sql.query(
            'SELECT email FROM users WHERE id = ? LIMIT 1',
            [currentUserId]
        );
        const senderName = senders && senders[0] ? senders[0].email.split('@')[0] : 'A user';

        const [users] = await sql.query(
            'SELECT id, email FROM users WHERE LOWER(email) IN (?)',
            [normalizedEmails]
        );

        const foundEmails = new Set(users.map((item) => String(item.email).toLowerCase()));
        const missingEmails = normalizedEmails.filter((item) => !foundEmails.has(item));
        let skippedSelfCount = 0;
        let addedCount = 0;
        let invitedCount = 0;

        for (const user of users) {
            if (Number(user.id) === Number(currentUserId)) {
                skippedSelfCount += 1;
                continue;
            }

            await sql.query(
                `INSERT INTO box_members (box_id, user_id, role, added_by)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    role = CASE WHEN role = 'admin' THEN 'admin' ELSE VALUES(role) END,
                    added_by = VALUES(added_by)`,
                [boxId, user.id, safeRole, currentUserId]
            );

            addedCount += 1;
        }

        for (const missingEmail of missingEmails) {
            await sql.query(
                `INSERT INTO box_invites (box_id, email, role, invited_by, status)
                 VALUES (?, ?, ?, ?, 'pending')
                 ON DUPLICATE KEY UPDATE
                    role = VALUES(role),
                    invited_by = VALUES(invited_by)`,
                [boxId, missingEmail, safeRole, currentUserId]
            );

            // Send invitation email
            const baseUrl = resolvePublicBaseUrl(req);
            const joinUrl = `${baseUrl}/signup.html?invite=${boxId}&email=${encodeURIComponent(missingEmail)}`;
            await sendInvitationEmail(missingEmail, boxTitle, senderName, joinUrl);

            invitedCount += 1;
        }

        if (addedCount === 0 && invitedCount === 0) {
            return res.status(400).json({
                message: 'No users were added. You may have selected your own email only.'
            });
        }

        return res.json({
            success: true,
            addedCount,
            invitedCount,
            skippedSelfCount,
            missingEmails,
            message: `Added ${addedCount} member(s)${invitedCount ? `. Invited ${invitedCount} email(s)` : ''}${skippedSelfCount ? `. Skipped your own email` : ''}`
        });
    } catch (err) {
        return res.status(500).json({ message: 'Unable to add member', error: err.message });
    }
};

exports.removeMember = async (req, res) => {
    const { boxId, memberUserId } = req.params;
    const currentUserId = req.user.id;

    try {
        await ensureCollaborationTables();

        const isAdmin = await ensureAdmin(boxId, currentUserId);
        if (!isAdmin) {
            return res.status(403).json({ message: 'Only admin can remove members' });
        }

        const [memberRows] = await sql.query(
            'SELECT role FROM box_members WHERE box_id = ? AND user_id = ? LIMIT 1',
            [boxId, memberUserId]
        );

        if (!memberRows.length) {
            return res.status(404).json({ message: 'Member not found in this box' });
        }

        if (memberRows[0].role === 'admin') {
            const [adminCountRows] = await sql.query(
                'SELECT COUNT(*) AS adminCount FROM box_members WHERE box_id = ? AND role = ? ',
                [boxId, 'admin']
            );

            if (adminCountRows[0].adminCount <= 1) {
                return res.status(400).json({ message: 'Cannot remove the last admin from a box' });
            }
        }

        await sql.query('DELETE FROM box_members WHERE box_id = ? AND user_id = ?', [boxId, memberUserId]);

        return res.json({ success: true, message: 'Member removed successfully' });
    } catch (err) {
        return res.status(500).json({ message: 'Unable to remove member', error: err.message });
    }
};

exports.listMembers = async (req, res) => {
    const { boxId } = req.params;
    const userId = req.user.id;

    try {
        await ensureCollaborationTables();
        const membership = await getMembership(boxId, userId);
        if (!membership) {
            return res.status(403).json({ message: 'You do not have access to this box' });
        }

        const [members] = await sql.query(
            `SELECT bm.user_id, u.fullName, u.email, bm.role, bm.created_at
             FROM box_members bm
             JOIN users u ON u.id = bm.user_id
             WHERE bm.box_id = ?
             ORDER BY bm.role DESC, bm.created_at ASC`,
            [boxId]
        );

        return res.json({ success: true, data: members });
    } catch (err) {
        return res.status(500).json({ message: 'Unable to list members', error: err.message });
    }
};

exports.uploadBoxContent = [
    upload.single('file'),
    async (req, res) => {
        const { boxId } = req.params;
        const userId = req.user.id;
        const { note } = req.body;

        try {
            await ensureCollaborationTables();

            const isAdmin = await ensureAdmin(boxId, userId);
            if (!isAdmin) {
                return res.status(403).json({ message: 'Only admin can upload or add notes/videos/files' });
            }

            if (!req.file && !note) {
                return res.status(400).json({ message: 'Provide a file or note text' });
            }

            let contentType = 'note';
            let fileName = null;
            let filePath = null;
            let originalName = null;

            if (req.file) {
                contentType = inferContentType(req.file);
                fileName = req.file.filename;
                filePath = `/uploads/boxes/${req.file.filename}`;
                originalName = req.file.originalname;
            }

            const [result] = await sql.query(
                `INSERT INTO box_contents
                (box_id, uploaded_by, content_type, file_name, file_path, original_name, note_text)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [boxId, userId, contentType, fileName, filePath, originalName, note || null]
            );

            return res.json({
                success: true,
                message: 'Content added successfully',
                id: result.insertId
            });
        } catch (err) {
            return res.status(500).json({ message: 'Unable to upload content', error: err.message });
        }
    }
];

exports.getBoxContents = async (req, res) => {
    const { boxId } = req.params;
    const userId = req.user.id;

    try {
        await ensureCollaborationTables();
        const membership = await getMembership(boxId, userId);
        if (!membership) {
            return res.status(403).json({ message: 'You do not have access to this box' });
        }

        const [rows] = await sql.query(
            `SELECT bc.id, bc.content_type, bc.file_name, bc.file_path, bc.original_name, bc.note_text,
                    bc.created_at, bc.uploaded_by, u.fullName AS uploaded_by_name
             FROM box_contents bc
             LEFT JOIN users u ON u.id = bc.uploaded_by
             WHERE bc.box_id = ?
             ORDER BY bc.created_at DESC`,
            [boxId]
        );

        return res.json({ success: true, data: rows });
    } catch (err) {
        return res.status(500).json({ message: 'Unable to fetch contents', error: err.message });
    }
};

