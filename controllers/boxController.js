const db = require('../db/connection');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { sendInvitationEmail } = require('../utils/emailService');

const uploadsDir = path.join(__dirname, '..', 'uploads', 'boxes');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storeFileMetadataInDb = String(process.env.STORE_FILE_METADATA_IN_DB || 'true').toLowerCase() === 'true';

const sanitizeFolderPath = (value) => {
    const normalized = String(value || '').replace(/\\/g, '/').trim();
    if (!normalized) return '';

    return normalized
        .split('/')
        .map((part) => part.trim())
        .filter((part) => part && part !== '.' && part !== '..')
        .map((part) => part.replace(/[<>:"|?*]/g, ''))
        .filter(Boolean)
        .join('/');
};

const sanitizeFileName = (value) => path.basename(String(value || '').trim()).replace(/[^a-zA-Z0-9._ -]/g, '_');

const getBoxUploadsRoot = (boxId) => path.join(uploadsDir, String(boxId));

const ensureDirExists = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

const toPosixPath = (value) => String(value || '').replace(/\\/g, '/');

const encodeFsContentId = (relativePath) => {
    const base64 = Buffer.from(String(relativePath || ''), 'utf8').toString('base64');
    return `fs_${base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')}`;
};

const decodeFsContentId = (contentId) => {
    const value = String(contentId || '');
    if (!value.startsWith('fs_')) return null;

    const payload = value.slice(3).replace(/-/g, '+').replace(/_/g, '/');
    const paddingLength = (4 - (payload.length % 4)) % 4;
    const padded = payload + '='.repeat(paddingLength);

    try {
        return Buffer.from(padded, 'base64').toString('utf8');
    } catch (err) {
        return null;
    }
};

const deriveOriginalName = (fileName) => String(fileName || '').replace(/^\d+-/, '');

const inferContentTypeFromName = (fileName) => {
    const ext = path.extname(String(fileName || '')).toLowerCase();
    if (['.mp4', '.mov', '.webm', '.mkv', '.avi', '.m4v'].includes(ext)) return 'video';
    return 'file';
};

const inferContentTypeFromLegacyMeta = (fileType, fileName) => {
    const safeType = String(fileType || '').toLowerCase();
    if (safeType.startsWith('video/')) return 'video';
    return inferContentTypeFromName(fileName);
};

const isSafeResolvedPath = (basePath, targetPath) => {
    const resolvedBase = path.resolve(basePath);
    const resolvedTarget = path.resolve(targetPath);
    return resolvedTarget === resolvedBase || resolvedTarget.startsWith(`${resolvedBase}${path.sep}`);
};

const removeEmptyParentDirs = (basePath, fromDir) => {
    let current = path.resolve(fromDir);
    const root = path.resolve(basePath);

    while (current.startsWith(`${root}${path.sep}`)) {
        if (!fs.existsSync(current)) break;

        const entries = fs.readdirSync(current);
        if (entries.length > 0) break;

        fs.rmdirSync(current);
        current = path.dirname(current);
    }
};

const readFsContentsForBox = (boxId) => {
    const root = getBoxUploadsRoot(boxId);
    if (!fs.existsSync(root)) return [];

    const rows = [];

    const walk = (currentDir, relativeDir) => {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });

        for (const entry of entries) {
            const absolutePath = path.join(currentDir, entry.name);
            const relativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;

            if (entry.isDirectory()) {
                walk(absolutePath, relativePath);
                continue;
            }

            const stats = fs.statSync(absolutePath);
            const relativePosixPath = toPosixPath(relativePath);
            const folderPath = toPosixPath(path.dirname(relativePath)).replace(/^\.$/, '');
            const fileName = entry.name;
            const originalName = deriveOriginalName(fileName);

            rows.push({
                id: encodeFsContentId(relativePosixPath),
                content_type: inferContentTypeFromName(fileName),
                file_name: fileName,
                file_path: `/uploads/boxes/${boxId}/${relativePosixPath}`,
                original_name: originalName || fileName,
                note_text: null,
                folder_path: folderPath || null,
                created_at: stats.birthtime || stats.mtime,
                uploaded_by: null,
                uploaded_by_name: 'Local upload'
            });
        }
    };

    walk(root, '');
    return rows;
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const { boxId } = req.params;
        const safeFolderPath = sanitizeFolderPath(req.body && req.body.folderPath);
        const destinationRoot = getBoxUploadsRoot(boxId);
        const destinationPath = safeFolderPath
            ? path.join(destinationRoot, safeFolderPath.replace(/\//g, path.sep))
            : destinationRoot;

        ensureDirExists(destinationPath);
        cb(null, destinationPath);
    },
    filename: (req, file, cb) => {
        const safeOriginalName = sanitizeFileName(file.originalname) || 'upload.bin';
        cb(null, `${Date.now()}-${safeOriginalName}`);
    }
});

const allowedDocumentMimeTypes = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);

const allowedExtensions = new Set(['.pdf', '.doc', '.docx', '.mp4', '.webm', '.mov', '.mkv']);

const isAllowedUpload = (file) => {
    if (!file) return false;

    const mime = String(file.mimetype || '').toLowerCase();
    const extension = path.extname(String(file.originalname || '')).toLowerCase();

    if (mime.startsWith('video/')) return true;
    if (allowedDocumentMimeTypes.has(mime)) return true;
    if (allowedExtensions.has(extension)) return true;

    return false;
};

const upload = multer({
    storage,
    limits: { fileSize: 200 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (isAllowedUpload(file)) {
            return cb(null, true);
        }

        return cb(new Error('Only PDF, DOC, DOCX, and video files are allowed'));
    }
});

const sql = db.promise();
let tablesReady = false;

const mirrorFileToLegacyTable = async ({ boxId, userId, fileName, fileSize, fileType, filePath, uploadedAt }) => {
    await sql.query(
        `INSERT INTO box_files (box_id, user_id, file_name, file_size, file_type, file_path, uploaded_at)
         SELECT ?, ?, ?, ?, ?, ?, ?
         WHERE NOT EXISTS (
            SELECT 1
            FROM box_files
            WHERE box_id = ? AND user_id = ? AND file_path = ?
            LIMIT 1
         )`,
        [
            boxId,
            userId,
            String(fileName || ''),
            Number(fileSize || 0),
            String(fileType || 'application/octet-stream'),
            String(filePath || null),
            uploadedAt || new Date(),
            boxId,
            userId,
            String(filePath || null)
        ]
    );
};

const syncLegacyFileRename = async ({ boxId, userId, oldFilePath, newFileName, newFilePath }) => {
    const params = [
        String(newFileName || ''),
        String(newFilePath || ''),
        Number(boxId),
        String(oldFilePath || '')
    ];

    let query = `UPDATE box_files
         SET file_name = ?, file_path = ?
         WHERE box_id = ? AND file_path = ?`;

    if (Number.isFinite(Number(userId))) {
        query += ' AND user_id = ?';
        params.push(Number(userId));
    }

    await sql.query(query, params);
};

const syncLegacyFileDelete = async ({ boxId, userId, filePath }) => {
    const params = [Number(boxId), String(filePath || '')];
    let query = `DELETE FROM box_files
         WHERE box_id = ? AND file_path = ?`;

    if (Number.isFinite(Number(userId))) {
        query += ' AND user_id = ?';
        params.push(Number(userId));
    }

    await sql.query(query, params);
};

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
            folder_path VARCHAR(500) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Backward compatibility for older table versions.
    try {
        await sql.query('ALTER TABLE box_contents ADD COLUMN folder_path VARCHAR(500) NULL AFTER note_text');
    } catch (alterErr) {
        // ER_DUP_FIELDNAME means column already exists.
        if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
            throw alterErr;
        }
    }

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

    await sql.query(`
        CREATE TABLE IF NOT EXISTS box_files (
            id INT AUTO_INCREMENT PRIMARY KEY,
            box_id INT NOT NULL,
            user_id INT NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            file_size BIGINT NOT NULL,
            file_type VARCHAR(128) NOT NULL,
            file_path VARCHAR(1024) NULL,
            uploaded_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            KEY box_id (box_id),
            CONSTRAINT box_files_ibfk_1 FOREIGN KEY (box_id) REFERENCES boxes(id) ON DELETE CASCADE
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

const resolveUploadAbsolutePath = (filePathValue) => {
    const normalizedPath = String(filePathValue || '').replace(/^\/+/, '').replace(/\\/g, path.sep);
    return normalizedPath ? path.join(__dirname, '..', normalizedPath) : '';
};

const deriveFolderPathFromFilePath = (boxId, filePathValue) => {
    const normalized = toPosixPath(String(filePathValue || '')).replace(/^\/+/, '');
    if (!normalized) return null;

    const expectedPrefix = `uploads/boxes/${boxId}/`;
    if (!normalized.startsWith(expectedPrefix)) return null;

    const relativePath = normalized.slice(expectedPrefix.length);
    const folderPath = toPosixPath(path.dirname(relativePath)).replace(/^\.$/, '');
    return folderPath || null;
};

const deriveRelativePathFromFilePath = (boxId, filePathValue) => {
    const normalized = toPosixPath(String(filePathValue || '')).replace(/^\/+/, '');
    if (!normalized) return '';

    const expectedPrefix = `uploads/boxes/${boxId}/`;
    if (!normalized.startsWith(expectedPrefix)) return '';

    return normalized.slice(expectedPrefix.length);
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

        const boxUploadsRoot = getBoxUploadsRoot(id);
        if (fs.existsSync(boxUploadsRoot)) {
            fs.rmSync(boxUploadsRoot, { recursive: true, force: true });
        }

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
        let emailSentCount = 0;
        const emailFailed = [];

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
            const emailResult = await sendInvitationEmail(missingEmail, boxTitle, senderName, joinUrl);

            if (!emailResult.success) {
                console.warn(`Invitation email not sent to ${missingEmail}:`, emailResult.error);
                emailFailed.push({
                    email: missingEmail,
                    error: emailResult.error || 'Unknown email error'
                });
            } else {
                emailSentCount += 1;
            }

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
            emailSentCount,
            emailFailed,
            skippedSelfCount,
            missingEmails,
            message: `Added ${addedCount} member(s)${invitedCount ? `. Processed ${invitedCount} invite(s), sent ${emailSentCount}` : ''}${emailFailed.length ? `. Failed ${emailFailed.length} email(s)` : ''}${emailFailed.length ? `. Reason: ${emailFailed[0].error}` : ''}${skippedSelfCount ? `. Skipped your own email` : ''}`
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
    (req, res, next) => {
        upload.single('file')(req, res, (err) => {
            if (!err) return next();

            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'File size should be less than 200 MB' });
            }

            return res.status(400).json({ message: err.message || 'Invalid file upload' });
        });
    },
    async (req, res) => {
        const { boxId } = req.params;
        const userId = req.user.id;
        const { note, folderPath } = req.body;
        const cleanupUploadedFile = () => {
            if (req.file && req.file.path && fs.existsSync(req.file.path)) {
                fs.unlink(req.file.path, () => {});
            }
        };

        try {
            await ensureCollaborationTables();

            const membership = await getMembership(boxId, userId);
            if (!membership) {
                cleanupUploadedFile();
                return res.status(403).json({ message: 'You do not have access to this box' });
            }

            if (!req.file && !note) {
                return res.status(400).json({ message: 'Provide a file or note text' });
            }

            let contentType = 'note';
            let fileName = null;
            let filePath = null;
            let originalName = null;
            const safeFolderPath = String(folderPath || '').trim().replace(/^\/+|\/+$/g, '');

            if (req.file) {
                contentType = inferContentType(req.file);
                fileName = req.file.filename;
                const boxRoot = getBoxUploadsRoot(boxId);
                const relativePath = toPosixPath(path.relative(boxRoot, req.file.path));
                filePath = `/uploads/boxes/${boxId}/${relativePath}`;
                originalName = req.file.originalname;

                if (!storeFileMetadataInDb) {
                    return res.json({
                        success: true,
                        message: 'File uploaded to local storage successfully',
                        id: encodeFsContentId(relativePath)
                    });
                }
            }

            const [result] = await sql.query(
                `INSERT INTO box_contents
                (box_id, uploaded_by, content_type, file_name, file_path, original_name, note_text, folder_path)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [boxId, userId, contentType, fileName, filePath, originalName, note || null, safeFolderPath || null]
            );

            if (req.file) {
                await mirrorFileToLegacyTable({
                    boxId: Number(boxId),
                    userId: Number(userId),
                    fileName: originalName || fileName,
                    fileSize: req.file.size,
                    fileType: req.file.mimetype || contentType,
                    filePath,
                    uploadedAt: new Date()
                });
            }

            console.log(`Box content saved: box=${boxId}, contentId=${result.insertId}, user=${userId}, type=${contentType}`);

            return res.json({
                success: true,
                message: 'Content added successfully',
                id: result.insertId
            });
        } catch (err) {
            cleanupUploadedFile();
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

        const [dbRows] = await sql.query(
            `SELECT bc.id, bc.content_type, bc.file_name, bc.file_path, bc.original_name, bc.note_text, bc.folder_path,
                    bc.created_at, bc.uploaded_by, u.fullName AS uploaded_by_name
             FROM box_contents bc
             LEFT JOIN users u ON u.id = bc.uploaded_by
             WHERE bc.box_id = ?
             ORDER BY bc.created_at DESC`,
            [boxId]
        );

        const [legacyRows] = await sql.query(
            `SELECT bf.id, bf.user_id, bf.file_name, bf.file_type, bf.file_path, bf.uploaded_at,
                    u.fullName AS uploaded_by_name
             FROM box_files bf
             LEFT JOIN users u ON u.id = bf.user_id
             WHERE bf.box_id = ?
             ORDER BY bf.uploaded_at DESC`,
            [boxId]
        );

        const existingRows = dbRows.filter((row) => {
            if (row.content_type === 'note') return true;
            const absolutePath = resolveUploadAbsolutePath(row.file_path);
            return absolutePath && fs.existsSync(absolutePath);
        });

        const existingFileKeys = new Set(
            existingRows
                .filter((row) => row.content_type !== 'note')
                .map((row) => String(row.file_path || ''))
        );

        const mappedLegacyRows = legacyRows
            .filter((row) => {
                const key = String(row.file_path || '');
                if (!key || existingFileKeys.has(key)) return false;

                const absolutePath = resolveUploadAbsolutePath(row.file_path);
                return absolutePath && fs.existsSync(absolutePath);
            })
            .map((row) => {
                const relativePath = deriveRelativePathFromFilePath(boxId, row.file_path);
                if (!relativePath) return null;

                return {
                    id: encodeFsContentId(relativePath),
                    content_type: inferContentTypeFromLegacyMeta(row.file_type, row.file_name),
                    file_name: row.file_name,
                    file_path: row.file_path,
                    original_name: row.file_name,
                    note_text: null,
                    folder_path: deriveFolderPathFromFilePath(boxId, row.file_path),
                    created_at: row.uploaded_at,
                    uploaded_by: row.user_id,
                    uploaded_by_name: row.uploaded_by_name || null
                };
            })
            .filter(Boolean);

        const mergedRows = [...existingRows, ...mappedLegacyRows];

        if (storeFileMetadataInDb) {
            return res.json({ success: true, data: mergedRows });
        }

        const fsRows = readFsContentsForBox(boxId);
        const noteRows = mergedRows.filter((row) => row.content_type === 'note');
        const dbFileRows = mergedRows.filter((row) => row.content_type !== 'note');
        const fsOnlyRows = fsRows.filter((row) => !dbFileRows.some((dbRow) => String(dbRow.file_path || '') === String(row.file_path || '')));
        const data = [...noteRows, ...dbFileRows, ...fsOnlyRows].sort((a, b) => {
            const aTime = new Date(a.created_at || 0).getTime();
            const bTime = new Date(b.created_at || 0).getTime();
            return bTime - aTime;
        });

        return res.json({ success: true, data });
    } catch (err) {
        return res.status(500).json({ message: 'Unable to fetch contents', error: err.message });
    }
};

exports.renameBoxContent = async (req, res) => {
    const { boxId, contentId } = req.params;
    const userId = req.user.id;
    const { name } = req.body;

    const safeName = String(name || '').trim();
    if (!safeName) {
        return res.status(400).json({ message: 'Name is required' });
    }

    try {
        await ensureCollaborationTables();

        const isAdmin = await ensureAdmin(boxId, userId);
        if (!isAdmin) {
            return res.status(403).json({ message: 'Only admin can rename uploads' });
        }

        const fsRelativePath = decodeFsContentId(contentId);
        if (fsRelativePath) {
            const boxRoot = getBoxUploadsRoot(boxId);
            const safeRelativePath = toPosixPath(String(fsRelativePath || '').replace(/^\/+/, ''));
            const currentAbsolutePath = path.join(boxRoot, safeRelativePath.replace(/\//g, path.sep));

            if (!isSafeResolvedPath(boxRoot, currentAbsolutePath) || !fs.existsSync(currentAbsolutePath)) {
                return res.status(404).json({ message: 'Upload not found' });
            }

            const currentExt = path.extname(path.basename(currentAbsolutePath));
            const targetBaseName = path.extname(safeName)
                ? path.basename(safeName, path.extname(safeName))
                : safeName;
            const nextFileName = `${Date.now()}-${sanitizeFileName(targetBaseName)}${currentExt || ''}`;
            const relativeDir = path.dirname(safeRelativePath).replace(/^\.$/, '');
            const nextRelativePath = relativeDir
                ? toPosixPath(path.join(relativeDir, nextFileName))
                : nextFileName;
            const nextAbsolutePath = path.join(boxRoot, nextRelativePath.replace(/\//g, path.sep));

            ensureDirExists(path.dirname(nextAbsolutePath));
            fs.renameSync(currentAbsolutePath, nextAbsolutePath);

            return res.json({
                success: true,
                message: 'Upload renamed successfully',
                id: encodeFsContentId(nextRelativePath)
            });
        }

        const [rows] = await sql.query(
            'SELECT id, uploaded_by, content_type, file_name, file_path, original_name, note_text FROM box_contents WHERE id = ? AND box_id = ? LIMIT 1',
            [contentId, boxId]
        );

        if (!rows.length) {
            return res.status(404).json({ message: 'Upload not found' });
        }

        const content = rows[0];

        if (content.content_type === 'note') {
            const updatedNote = safeName.startsWith('[Folder]') ? safeName : content.note_text && content.note_text.startsWith('[Folder]')
                ? `[Folder] ${safeName}`
                : safeName;

            await sql.query(
                'UPDATE box_contents SET note_text = ? WHERE id = ? AND box_id = ?',
                [updatedNote, contentId, boxId]
            );

            return res.json({ success: true, message: 'Upload renamed successfully' });
        }

        const currentFilePath = resolveUploadAbsolutePath(content.file_path);
        const originalExt = path.extname(String(content.original_name || content.file_name || '')).toLowerCase();
        const nextBaseName = path.extname(safeName) ? path.basename(safeName, path.extname(safeName)) : safeName;
        const nextFileName = `${Date.now()}-${nextBaseName}${originalExt || ''}`;
        const currentRelativeFilePath = String(content.file_path || '').replace(/^\/uploads\/boxes\//, '').replace(/^\/+/, '');
        const currentRelativeDir = toPosixPath(path.dirname(currentRelativeFilePath)).replace(/^\.$/, '');
        const targetRelativeDir = currentRelativeDir || String(boxId);
        const nextRelativePath = `/uploads/boxes/${targetRelativeDir}/${nextFileName}`;
        const nextAbsolutePath = path.join(__dirname, '..', 'uploads', 'boxes', targetRelativeDir.replace(/\//g, path.sep), nextFileName);

        ensureDirExists(path.dirname(nextAbsolutePath));

        if (currentFilePath && fs.existsSync(currentFilePath)) {
            fs.renameSync(currentFilePath, nextAbsolutePath);
        }

        await sql.query(
            `UPDATE box_contents
             SET file_name = ?, file_path = ?, original_name = ?
             WHERE id = ? AND box_id = ?`,
            [nextFileName, nextRelativePath, safeName, contentId, boxId]
        );

        if (content.file_path && content.uploaded_by) {
            await syncLegacyFileRename({
                boxId,
                userId: content.uploaded_by,
                oldFilePath: content.file_path,
                newFileName: safeName,
                newFilePath: nextRelativePath
            });
        }

        return res.json({ success: true, message: 'Upload renamed successfully' });
    } catch (err) {
        return res.status(500).json({ message: 'Unable to rename upload', error: err.message });
    }
};

exports.deleteBoxContent = async (req, res) => {
    const { boxId, contentId } = req.params;
    const userId = req.user.id;

    try {
        await ensureCollaborationTables();

        const isAdmin = await ensureAdmin(boxId, userId);
        if (!isAdmin) {
            return res.status(403).json({ message: 'Only admin can delete uploads' });
        }

        const fsRelativePath = decodeFsContentId(contentId);
        if (fsRelativePath) {
            const boxRoot = getBoxUploadsRoot(boxId);
            const safeRelativePath = toPosixPath(String(fsRelativePath || '').replace(/^\/+/, ''));
            const absolutePath = path.join(boxRoot, safeRelativePath.replace(/\//g, path.sep));

            if (!isSafeResolvedPath(boxRoot, absolutePath) || !fs.existsSync(absolutePath)) {
                return res.status(404).json({ message: 'Upload not found' });
            }

            fs.unlinkSync(absolutePath);
            removeEmptyParentDirs(boxRoot, path.dirname(absolutePath));

            const legacyFilePath = `/uploads/boxes/${boxId}/${safeRelativePath}`;
            await syncLegacyFileDelete({
                boxId,
                filePath: legacyFilePath
            });

            return res.json({ success: true, message: 'Upload deleted successfully' });
        }

        const [rows] = await sql.query(
            'SELECT id, uploaded_by, content_type, file_path FROM box_contents WHERE id = ? AND box_id = ? LIMIT 1',
            [contentId, boxId]
        );

        if (!rows.length) {
            return res.status(404).json({ message: 'Upload not found' });
        }

        const content = rows[0];
        if (content.file_path) {
            const absolutePath = resolveUploadAbsolutePath(content.file_path);
            if (fs.existsSync(absolutePath)) {
                fs.unlinkSync(absolutePath);
            }
        }

        await sql.query('DELETE FROM box_contents WHERE id = ? AND box_id = ?', [contentId, boxId]);

        if (content.file_path && content.uploaded_by) {
            await syncLegacyFileDelete({
                boxId,
                userId: content.uploaded_by,
                filePath: content.file_path
            });
        }

        return res.json({ success: true, message: 'Upload deleted successfully' });
    } catch (err) {
        return res.status(500).json({ message: 'Unable to delete upload', error: err.message });
    }
};

