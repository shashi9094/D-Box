const db = require('../db/connection');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const sharp = require('sharp');
const s3Client = require('../config/s3');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const { sendInvitationEmail } = require('../utils/emailService');
const { createNotificationsForUsers } = require('../utils/notifications');
const compressImage = require('../utils/compressImage');
const { error } = require('console');
const fetch = require('node-fetch');




// Local uploads folder removed - using S3 for storage
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

const sanitizeAdminNote = (value) => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return null;
    return text.slice(0, 300);
};


const getBoxUploadsRoot = (boxId) => null; // Not used - S3 storage

const ensureDirExists = (dirPath) => { /* no-op for S3 */ };

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
    // Local file listing removed; rely on DB entries stored with S3 URLs
    return [];
};

// Use memory storage for multer so we get buffers for S3 upload and processing
const storage = multer.memoryStorage();

const allowedDocumentMimeTypes = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);

const allowedExtensions = new Set(['.pdf', '.doc', '.docx', '.mp4', '.webm', '.mov', '.mkv', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg']);

const isAllowedUpload = (file) => {
    if (!file) return false;
    const mime = String(file.mimetype || '').toLowerCase();
    const extension = path.extname(String(file.originalname || '')).toLowerCase();
    if (mime.startsWith('video/')) return true;
    if (mime.startsWith('image/')) return true;
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
        return cb(new Error('Only PDF, DOC, DOCX, image, and video files are allowed'));
    }
});

// Helper: generate unique filename preserving extension where appropriate
const generateUniqueFilenameForBox = (originalName, forceWebp = false) => {
    const ts = Date.now();
    const rand = crypto.randomBytes(6).toString('hex');
    const base = sanitizeFileName(originalName || 'upload');
    const ext = path.extname(base) || '';
    const stem = ext ? base.slice(0, -ext.length) : base;
    const normalizedStem = stem.replace(/(\.[^/.]+)$/i, '');

    if (forceWebp) return `${ts}-${rand}-${normalizedStem}.webp`;
    return `${ts}-${rand}-${normalizedStem}${ext}`;
};

// Helper: upload buffer to S3 and return object key (not full URL for security)
async function uploadBufferToS3(buffer, key, contentType) {
    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType
    };

    const cmd = new PutObjectCommand(params);
    await s3Client.send(cmd);

    // Return only the object key - signed URLs will be generated by frontend on demand
    console.log('✓ File uploaded to S3:', { key, size: buffer.length, contentType });
    return key;
}

// Helper: delete object from S3 by key or URL (handles both formats during migration)
async function deleteS3ObjectByUrl(filePathValue) {
    try {
        if (!filePathValue) return;
        
        let key = String(filePathValue).trim();
        
        // If it's a full URL, extract the key
        if (key.startsWith('http')) {
            const bucket = process.env.AWS_BUCKET_NAME;
            const region = process.env.AWS_REGION || 'eu-north-1';
            const prefix = `https://${bucket}.s3.${region}.amazonaws.com/`;
            if (key.startsWith(prefix)) {
                key = decodeURIComponent(key.slice(prefix.length));
            } else {
                console.warn('deleteS3ObjectByUrl: URL does not match expected bucket');
                return;
            }
        }
        
        const cmd = new DeleteObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME, Key: key });
        await s3Client.send(cmd);
        console.log('✓ Deleted from S3:', key);
    } catch (err) {
        console.error('✗ deleteS3ObjectByUrl error:', { message: err.message || err });
    }
}

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
    let query = `UPDATE box_files SET file_name = ?, file_path = ? WHERE box_id = ? AND file_path = ?`;
    if (Number.isFinite(Number(userId))) {
        query += ' AND user_id = ?';
        params.push(Number(userId));
    }
    await sql.query(query, params);
};

const syncLegacyFileDelete = async ({ boxId, userId, filePath }) => {
    const params = [Number(boxId), String(filePath || '')];
    let query = `DELETE FROM box_files WHERE box_id = ? AND file_path = ?`;
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
            id BIGSERIAL PRIMARY KEY,
            box_id BIGINT NOT NULL,
            user_id BIGINT NOT NULL,
            role TEXT NOT NULL DEFAULT 'member',
            added_by BIGINT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT box_members_role_check CHECK (role IN ('admin', 'member')),
            UNIQUE (box_id, user_id)
        )
    `);

    await sql.query(`
        CREATE TABLE IF NOT EXISTS box_contents (
            id BIGSERIAL PRIMARY KEY,
            box_id BIGINT NOT NULL,
            uploaded_by BIGINT NOT NULL,
            content_type TEXT NOT NULL DEFAULT 'file',
            file_name VARCHAR(255) NULL,
            file_path VARCHAR(500) NULL,
            original_name VARCHAR(255) NULL,
            mime_type VARCHAR(255) NULL,
            file_size BIGINT NULL,
            s3_key VARCHAR(500) NULL,
            note_text TEXT NULL,
            admin_note VARCHAR(300) NULL,
            folder_path VARCHAR(500) NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT box_contents_content_type_check CHECK (content_type IN ('file', 'note', 'video'))
        )
    `);

    await sql.query('ALTER TABLE box_contents ADD COLUMN IF NOT EXISTS folder_path VARCHAR(500) NULL');
    await sql.query('ALTER TABLE box_contents ADD COLUMN IF NOT EXISTS admin_note VARCHAR(300) NULL');
    await sql.query('ALTER TABLE box_contents ADD COLUMN IF NOT EXISTS mime_type VARCHAR(255) NULL');
    await sql.query('ALTER TABLE box_contents ADD COLUMN IF NOT EXISTS file_size BIGINT NULL');
    await sql.query('ALTER TABLE box_contents ADD COLUMN IF NOT EXISTS s3_key VARCHAR(500) NULL');

    await sql.query(`
        CREATE TABLE IF NOT EXISTS box_invites (
            id BIGSERIAL PRIMARY KEY,
            box_id BIGINT NOT NULL,
            email VARCHAR(255) NOT NULL,
            role TEXT NOT NULL DEFAULT 'member',
            invited_by BIGINT NOT NULL,
            invite_token VARCHAR(128) NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            accepted_by BIGINT NULL,
            accepted_at TIMESTAMPTZ NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT box_invites_role_check CHECK (role IN ('admin', 'member')),
            CONSTRAINT box_invites_status_check CHECK (status IN ('pending', 'accepted', 'revoked')),
            UNIQUE (box_id, email, status)
        )
    `);

    await sql.query('ALTER TABLE box_invites ADD COLUMN IF NOT EXISTS invite_token VARCHAR(128) NULL');

    await sql.query(`
        CREATE TABLE IF NOT EXISTS box_files (
            id BIGSERIAL PRIMARY KEY,
            box_id BIGINT NOT NULL,
            user_id BIGINT NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            file_size BIGINT NOT NULL,
            file_type VARCHAR(128) NOT NULL,
            file_path VARCHAR(1024) NULL,
            uploaded_at TIMESTAMPTZ NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT box_files_ibfk_1 FOREIGN KEY (box_id) REFERENCES boxes(id) ON DELETE CASCADE
        )
    `);

    await sql.query(`
        UPDATE box_members bm
        SET role = 'admin'
        FROM boxes b
        WHERE b.id = bm.box_id
          AND bm.user_id = b.user_id
          AND bm.role <> 'admin'
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
        'SELECT box_members.role AS role FROM box_members WHERE box_id = ? AND user_id = ? LIMIT 1',
        [boxId, userId]
    );

    return rows[0] || null;
};

const ensureAdmin = async (boxId, userId) => {
    const membership = await getMembership(boxId, userId);
    return membership && membership.role === 'admin';
};

const getBoxOwnerId = async (boxId) => {
    const [rows] = await sql.query(
        'SELECT user_id FROM boxes WHERE id = ? LIMIT 1',
        [boxId]
    );
    return rows.length ? Number(rows[0].user_id) : null;
};

const ensureMainAdmin = async (boxId, userId) => {
    const ownerId = await getBoxOwnerId(boxId);
    return Number(ownerId) === Number(userId);
};

const getAdminRecipientsForBox = async (boxId) => {
    const [rows] = await sql.query(
        `SELECT DISTINCT user_id
         FROM (
            SELECT user_id FROM boxes WHERE id = ?
            UNION ALL
            SELECT user_id FROM box_members WHERE box_id = ? AND box_members.role = 'admin'
         ) admin_users`,
        [boxId, boxId]
    );

    return rows
        .map((row) => Number(row.user_id))
        .filter((value) => Number.isFinite(value) && value > 0);
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
    const railwayPublicDomain = String(process.env.RAILWAY_PUBLIC_DOMAIN || '').trim();
    const configuredPublicUrl = normalizeBaseUrl(
        process.env.PUBLIC_APP_URL ||
        process.env.INVITE_BASE_URL ||
        process.env.APP_URL ||
        (railwayPublicDomain ? `https://${railwayPublicDomain}` : '')
    );

    if (configuredPublicUrl && !isLocalHost(getHostFromUrl(configuredPublicUrl))) {
        return configuredPublicUrl;
    }

    if (railwayPublicDomain) {
        return `https://${railwayPublicDomain}`;
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

const isInviteEmailEnabled = () => String(process.env.INVITE_EMAIL_ENABLED || 'true').toLowerCase() !== 'false';

const createInviteToken = () => crypto.randomBytes(24).toString('hex');

const getBoxCapacityAndUsage = async (boxId) => {
    const [rows] = await sql.query(
        `SELECT b.capacity,
                COUNT(DISTINCT bm.user_id) AS memberCount,
                COUNT(DISTINCT CASE WHEN bi.status = 'pending' THEN bi.email END) AS pendingInviteCount
         FROM boxes b
         LEFT JOIN box_members bm ON bm.box_id = b.id
         LEFT JOIN box_invites bi ON bi.box_id = b.id
         WHERE b.id = ?
         GROUP BY b.id
         LIMIT 1`,
        [boxId]
    );

    const row = rows[0] || {};
    const capacity = Number(row.capacity || 1);
    const memberCount = Number(row.memberCount || 0);
    const pendingInviteCount = Number(row.pendingInviteCount || 0);

    return {
        capacity,
        memberCount,
        pendingInviteCount,
        reservedCount: memberCount + pendingInviteCount
    };
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

exports.acceptPendingInvitesForUser = async (userId, email, inviteToken = null) => {
    await ensureCollaborationTables();

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail || !userId) return;

    const inviteParams = [normalizedEmail];
    const inviteSqlParts = [
        `SELECT id, box_id, box_invites.role AS role, invited_by, invite_token
         FROM box_invites
         WHERE email = ? AND status = 'pending'`
    ];

    if (inviteToken) {
        inviteSqlParts.push('AND invite_token = ?');
        inviteParams.push(String(inviteToken));
    }

    const [invites] = await sql.query(inviteSqlParts.join(' '), inviteParams);
    const [joinerRows] = await sql.query(
        'SELECT fullname AS "fullName", email FROM users WHERE id = ? LIMIT 1',
        [userId]
    );

    const joinerProfile = joinerRows[0] || {};
    const joinerName = String(joinerProfile.fullName || normalizedEmail || `User ${userId}`).trim();
    const joinerEmail = String(joinerProfile.email || normalizedEmail || '').trim().toLowerCase();
    let acceptedCount = 0;
    let skippedCount = 0;

    for (const invite of invites) {
        const capacityState = await getBoxCapacityAndUsage(invite.box_id);
        if (capacityState.memberCount + capacityState.pendingInviteCount >= capacityState.capacity) {
            skippedCount += 1;
            continue;
        }

        await sql.query(
            `INSERT INTO box_members AS bm (box_id, user_id, role, added_by)
             VALUES (?, ?, ?, ?)
             ON CONFLICT (box_id, user_id) DO UPDATE SET
                role = CASE WHEN bm.role = 'admin' THEN 'admin' ELSE EXCLUDED.role END,
                added_by = EXCLUDED.added_by`,
            [invite.box_id, userId, invite.role, invite.invited_by]
        );

        await sql.query(
            `UPDATE box_invites
             SET status = 'accepted', accepted_by = ?, accepted_at = NOW()
             WHERE id = ?`,
            [userId, invite.id]
        );

        const [boxRows] = await sql.query(
            'SELECT title FROM boxes WHERE id = ? LIMIT 1',
            [invite.box_id]
        );

        const boxTitle = String(boxRows[0]?.title || `Box ${invite.box_id}`);
        const adminRecipients = await getAdminRecipientsForBox(invite.box_id);
        const recipients = adminRecipients.filter((adminId) => Number(adminId) !== Number(userId));

        if (recipients.length) {
            await createNotificationsForUsers(recipients, {
                type: 'member_joined_via_link',
                title: 'Member joined via invite link',
                message: `${joinerName} (${joinerEmail}) joined "${boxTitle}" using invite link.`,
                details: {
                    boxId: Number(invite.box_id),
                    boxTitle,
                    joinedUserId: Number(userId),
                    joinedUserName: joinerName,
                    joinedEmail: joinerEmail,
                    inviteId: Number(invite.id),
                },
            });
        }

        acceptedCount += 1;
    }

    return { acceptedCount, skippedCount };
};

exports.createBox = async (req, res) => {
    const { title, description } = req.body;
    const userId = req.user.id;
    const capacityValue = Number(req.body?.capacity);
    const capacity = Number.isFinite(capacityValue) ? Math.floor(capacityValue) : 1;

    if (!title || !description) {
        return res.status(400).json({ message: 'Title and description are required' });
    }

    if (!Number.isFinite(capacity) || capacity < 1) {
        return res.status(400).json({ message: 'Capacity must be at least 1' });
    }

    try {
        await ensureCollaborationTables();

        const [result] = await sql.query(
            'INSERT INTO boxes (user_id, title, description, capacity) VALUES (?, ?, ?, ?) RETURNING id',
            [userId, title, description, capacity]
        );
        
        

        await sql.query(
            `INSERT INTO box_members (box_id, user_id, role, added_by)
             VALUES (?, ?, 'admin', ?)
             ON CONFLICT (box_id, user_id) DO UPDATE SET role = 'admin', added_by = EXCLUDED.added_by`,
            [result.insertId, userId, userId]
        );

        await sql.query(
            "UPDATE users SET role = 'Admin' WHERE id = ?",
            [userId]
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

exports.getAllBoxes = async (req, res) => {
    const userId = req.user.id;

    try {
        await ensureCollaborationTables();

        const [results] = await sql.query(
            `SELECT b.*,
                    (SELECT COUNT(DISTINCT bm.user_id) FROM box_members bm WHERE bm.box_id = b.id) AS memberCount,
                    (SELECT COUNT(DISTINCT bi.email) FROM box_invites bi WHERE bi.box_id = b.id AND bi.status = 'pending') AS pendingInviteCount,
                    (SELECT COUNT(DISTINCT bm.user_id) FROM box_members bm WHERE bm.box_id = b.id) AS reservedCount,
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

        const normalizedResults = results.map((row) => {
            const memberCount = Number(row.memberCount || 0);
            const capacity = Number(row.capacity || 1);
            const normalizedCapacity = Math.max(capacity, memberCount, 1);
            return {
                ...row,
                capacity: normalizedCapacity,
                configuredCapacity: capacity
            };
        });

        return res.json(normalizedResults);
    } catch (err) {
        return res.status(500).json({ message: 'Error fetching boxes', details: err.message });
    }
};

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

exports.updateBox = async (req, res) => {
    const { id } = req.params;
    const { title, description } = req.body;
    const userId = req.user.id;
    const capacityValue = req.body?.capacity;

    try {
        await ensureCollaborationTables();
        const isMainAdmin = await ensureMainAdmin(id, userId);
        if (!isMainAdmin) {
            return res.status(403).json({ message: 'Only main admin can update this box' });
        }

        const updates = [];
        const params = [];

        if (typeof title === 'string' && title.trim()) {
            updates.push('title = ?');
            params.push(title.trim());
        }

        if (typeof description === 'string') {
            updates.push('description = ?');
            params.push(description.trim());
        }

        if (capacityValue !== undefined) {
            const nextCapacity = Math.floor(Number(capacityValue));
            if (!Number.isFinite(nextCapacity) || nextCapacity < 1) {
                return res.status(400).json({ message: 'Capacity must be at least 1' });
            }

            if (nextCapacity > 200) {
                return res.status(400).json({ message: 'Capacity cannot exceed 200' });
            }

            const capacityState = await getBoxCapacityAndUsage(id);
            if (nextCapacity < capacityState.reservedCount) {
                return res.status(400).json({
                    message: `Capacity cannot be lower than current reserved members (${capacityState.reservedCount})`
                });
            }

            updates.push('capacity = ?');
            params.push(nextCapacity);
        }

        if (!updates.length) {
            return res.status(400).json({ message: 'Nothing to update' });
        }

        params.push(id);

        await sql.query(
            `UPDATE boxes SET ${updates.join(', ')} WHERE id = ?`,
            params
        );

        return res.json({ success: true, message: 'Box updated successfully' });
    } catch (err) {
        return res.status(500).json({ message: 'Error updating box', details: err.message });
    }
};

exports.deleteBox = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        await ensureCollaborationTables();
        const isMainAdmin = await ensureMainAdmin(id, userId);
        if (!isMainAdmin) {
            return res.status(403).json({ message: 'Only main admin can delete this box' });
        }

        const [boxRows] = await sql.query(
            'SELECT user_id FROM boxes WHERE id = ? LIMIT 1',
            [id]
        );

        if (!boxRows.length) {
            return res.status(404).json({ message: 'Box not found' });
        }

        const ownerUserId = Number(boxRows[0].user_id);

        await sql.query('DELETE FROM box_contents WHERE box_id = ?', [id]);
        await sql.query('DELETE FROM box_members WHERE box_id = ?', [id]);
        await sql.query('DELETE FROM boxes WHERE id = ?', [id]);

        const [remainingOwnedBoxes] = await sql.query(
            'SELECT COUNT(*) AS total FROM boxes WHERE user_id = ?',
            [ownerUserId]
        );

        if (!Number(remainingOwnedBoxes[0]?.total || 0)) {
            await sql.query(
                "UPDATE users SET role = 'User' WHERE id = ?",
                [ownerUserId]
            );
        }

        const boxUploadsRoot = getBoxUploadsRoot(id);
        if (fs.existsSync(boxUploadsRoot)) {
            fs.rmSync(boxUploadsRoot, { recursive: true, force: true });
        }

        return res.json({ success: true, message: 'Box deleted successfully' });
    } catch (err) {
        return res.status(500).json({ message: 'Error deleting box', details: err.message });
    }
};

exports.getMyBoxes = async (req, res) => {
    const userId = req.user.id;

    try {
        await ensureCollaborationTables();

        const [rows] = await sql.query(
            `SELECT b.id,
                    b.user_id,
                    b.title,
                    b.description,
                    b.capacity,
                    b.created_at,
                    u.email AS "adminEmail",
                    u.fullname AS "adminName",
                    COUNT(DISTINCT bm_all.user_id) AS memberCount,
                    COUNT(DISTINCT CASE WHEN bi.status = 'pending' THEN bi.email END) AS pendingInviteCount,
                    COUNT(DISTINCT bm_all.user_id) AS reservedCount,
                    CASE
                        WHEN b.user_id = ? THEN 'admin'
                        WHEN MAX(CASE WHEN bm_user.role = 'admin' THEN 1 ELSE 0 END) = 1 THEN 'admin'
                        ELSE 'member'
                    END AS role
             FROM boxes b
             JOIN box_members bm_user ON bm_user.box_id = b.id AND bm_user.user_id = ?
             LEFT JOIN box_members bm_all ON bm_all.box_id = b.id
             LEFT JOIN box_invites bi ON bi.box_id = b.id
             LEFT JOIN users u ON u.id = b.user_id
             GROUP BY b.id, b.user_id, b.title, b.description, b.capacity, b.created_at, u.email, u.fullname
             ORDER BY b.id DESC`,
            [userId, userId]
        );

        const normalizedRows = rows.map((row) => {
            const memberCount = Number(row.memberCount || 0);
            const capacity = Number(row.capacity || 1);
            const normalizedCapacity = Math.max(capacity, memberCount, 1);
            return {
                ...row,
                capacity: normalizedCapacity,
                configuredCapacity: capacity,
                reservedCount: memberCount
            };
        });

        // Log sample keys to ensure camelCase alias is preserved (adminEmail)
        try {
            console.log('getMyBoxes -> sampleRowKeys:', Object.keys(normalizedRows[0] || {}));
        } catch (e) {
            // ignore logging errors
        }

        return res.json({
            success: true,
            data: normalizedRows
        });
    } catch (err) {
        console.error('getMyBoxes DB error:', {
            code: err.code || null,
            message: err.message || null,
            detail: err.detail || null,
            table: err.table || null,
        });
        return res.status(500).json({ message: 'DB error', error: err.message });
    }
};

exports.getOtherUsersBoxes = async (req, res) => {
    const userId = req.user.id;

    try {
        await ensureCollaborationTables();

        const [rows] = await sql.query(
            `SELECT b.*, u.fullname AS "fullName", bm.role
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
        console.error('getOtherUsersBoxes DB error:', {
            code: err.code || null,
            message: err.message || null,
            detail: err.detail || null,
            table: err.table || null,
        });
        return res.status(500).json({ message: 'DB error', error: err.message });
    }
};

exports.addMemberByEmail = async (req, res) => {
    const { boxId } = req.params;
    const { email, emails, role } = req.body;
    const currentUserId = req.user.id;
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
        const isMainAdmin = await ensureMainAdmin(boxId, currentUserId);
        const safeRole = role === 'admin' && isMainAdmin ? 'admin' : 'member';

        const boxState = await getBoxCapacityAndUsage(boxId);
        const availableSlots = Math.max(0, boxState.capacity - boxState.reservedCount);
        if (!availableSlots) {
            return res.status(400).json({ message: 'Box capacity is full' });
        }

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
            'SELECT id, email FROM users WHERE LOWER(email) = ANY(?)',
            [normalizedEmails]
        );

        const [memberRows] = await sql.query(
            'SELECT user_id FROM box_members WHERE box_id = ?',
            [boxId]
        );
        const currentMemberIds = new Set(memberRows.map((row) => String(row.user_id)));

        const foundEmails = new Set(users.map((item) => String(item.email).toLowerCase()));
        const missingEmails = normalizedEmails.filter((item) => !foundEmails.has(item));
        let skippedSelfCount = 0;
        let invitedCount = 0;
        let emailQueuedCount = 0;

        const inviteTargets = [];

        for (const user of users) {
            if (Number(user.id) === Number(currentUserId)) {
                skippedSelfCount += 1;
                continue;
            }

            if (currentMemberIds.has(String(user.id))) {
                continue;
            }

            inviteTargets.push({ email: String(user.email || '').trim().toLowerCase(), userId: user.id });
        }

        for (const missingEmail of missingEmails) {
            inviteTargets.push({ email: String(missingEmail || '').trim().toLowerCase(), userId: null });
        }

        const uniqueInviteTargets = inviteTargets.filter((item, index, arr) => arr.findIndex((x) => x.email === item.email) === index);

        if (uniqueInviteTargets.length > availableSlots) {
            return res.status(400).json({
                message: `Box capacity allows only ${availableSlots} more member${availableSlots === 1 ? '' : 's'}`
            });
        }

        const inviteBaseUrl = resolvePublicBaseUrl(req);
        const inviteLinks = [];
        const emailNotifications = [];
        let emailFailedCount = 0;

        for (const target of uniqueInviteTargets) {
            const inviteToken = createInviteToken();
            const joinUrl = `${inviteBaseUrl}/login.html?invite=${boxId}&email=${encodeURIComponent(target.email)}&token=${inviteToken}`;

            inviteLinks.push({ email: target.email, url: joinUrl, token: inviteToken });
            emailNotifications.push({ email: target.email, url: joinUrl });

            await sql.query(
                `INSERT INTO box_invites (box_id, email, role, invited_by, invite_token, status)
                 VALUES (?, ?, ?, ?, ?, 'pending')
                 ON CONFLICT (box_id, email, status) DO UPDATE SET
                    role = EXCLUDED.role,
                    invited_by = EXCLUDED.invited_by,
                    invite_token = EXCLUDED.invite_token,
                    status = 'pending',
                    accepted_by = NULL,
                    accepted_at = NULL`,
                [boxId, target.email, safeRole, currentUserId, inviteToken]
            );

            invitedCount += 1;
        }

        if (isInviteEmailEnabled()) {
            const emailResults = await Promise.allSettled(
                emailNotifications.map(async (notification) => {
                    emailQueuedCount += 1;

                    const emailResult = await sendInvitationEmail(notification.email, boxTitle, senderName, notification.url);
                    if (!emailResult.success) {
                        console.warn(
                            `Invitation email failed for ${notification.email}:`,
                            emailResult.error || 'Unknown email error'
                        );
                    }

                    return emailResult;
                })
            );

            const failedEmails = emailResults
                .map((result, index) => {
                    const reason = result.status === 'rejected'
                        ? (result.reason && result.reason.message ? result.reason.message : String(result.reason || 'Unknown email error'))
                        : (result.value && result.value.success === false ? (result.value.error || 'Unknown email error') : null);
                    return {
                        result,
                        email: emailNotifications[index] && emailNotifications[index].email,
                        reason
                    };
                })
                .filter(({ result }) => result.status === 'rejected' || (result.value && result.value.success === false));

            emailFailedCount = failedEmails.length;

            for (const failed of failedEmails) {
                console.warn(`Invitation email not sent to ${failed.email}:`, failed.reason);
            }
        }

        if (invitedCount === 0) {
            return res.status(400).json({
                message: 'No users were invited. You may have selected your own email only.'
            });
        }

        return res.json({
            success: true,
            invitedCount,
            emailQueuedCount,
            emailFailedCount,
            skippedSelfCount,
            missingEmails,
            inviteLinks,
            message: `Processed ${invitedCount} invite(s)${isInviteEmailEnabled() ? `. Email dispatch attempted for ${emailQueuedCount} recipient${emailQueuedCount === 1 ? '' : 's'}` : '. Email sending disabled'}${skippedSelfCount ? `. Skipped your own email` : ''}`
        });
    } catch (err) {
        return res.status(500).json({ message: 'Unable to add member', error: err.message });
    }
};

exports.removeMember = async (req, res) => {
    const { boxId, memberUserId } = req.params;
    const currentUserId = req.user.id;
    const targetUserId = Number(memberUserId);

    try {
        await ensureCollaborationTables();

        const isAdmin = await ensureAdmin(boxId, currentUserId);
        if (!isAdmin) {
            return res.status(403).json({ message: 'Only admin can remove members' });
        }
        const isMainAdmin = await ensureMainAdmin(boxId, currentUserId);

        const ownerId = await getBoxOwnerId(boxId);
        if (Number(ownerId) === targetUserId) {
            return res.status(400).json({ message: 'Main admin cannot be removed' });
        }

        const [memberRows] = await sql.query(
            'SELECT role FROM box_members WHERE box_id = ? AND user_id = ? LIMIT 1',
            [boxId, targetUserId]
        );

        if (!memberRows.length) {
            return res.status(404).json({ message: 'Member not found in this box' });
        }

        if (memberRows[0].role === 'admin') {
            if (!isMainAdmin) {
                return res.status(403).json({ message: 'Only main admin can remove admins from this box' });
            }

            const [adminCountRows] = await sql.query(
                'SELECT COUNT(*) AS adminCount FROM box_members WHERE box_id = ? AND role = ?',
                [boxId, 'admin']
            );

            if (adminCountRows[0].adminCount <= 1) {
                return res.status(400).json({ message: 'Cannot remove the last admin from a box' });
            }
        }

        await sql.query('DELETE FROM box_members WHERE box_id = ? AND user_id = ?', [boxId, targetUserId]);

        return res.json({ success: true, message: 'Member removed successfully' });
    } catch (err) {
        return res.status(500).json({ message: 'Unable to remove member', error: err.message });
    }
};

exports.promoteMember = async (req, res) => {
    const { boxId, memberUserId } = req.params;
    const currentUserId = req.user.id;
    const targetUserId = Number(memberUserId);

    try {
        await ensureCollaborationTables();

        const ownerId = await getBoxOwnerId(boxId);
        if (Number(ownerId) !== Number(currentUserId)) {
            return res.status(403).json({ message: 'Only main admin can change admin access' });
        }
        if (!Number.isFinite(targetUserId)) {
            return res.status(400).json({ message: 'Invalid member id' });
        }

        const [memberRows] = await sql.query(
            'SELECT role FROM box_members WHERE box_id = ? AND user_id = ? LIMIT 1',
            [boxId, targetUserId]
        );

        if (!memberRows.length) {
            return res.status(404).json({ message: 'Member not found in this box' });
        }

        if (memberRows[0].role === 'admin') {
            return res.json({ success: true, message: 'Member is already admin' });
        }

        await sql.query(
            `INSERT INTO box_members (box_id, user_id, role, added_by)
             VALUES (?, ?, 'admin', ?)
             ON CONFLICT (box_id, user_id) DO UPDATE SET role = 'admin', added_by = EXCLUDED.added_by`,
            [boxId, targetUserId, currentUserId]
        );

        return res.json({
            success: true,
            message: Number(ownerId) === targetUserId ? 'Main admin already has admin access' : 'Member promoted to admin'
        });
    } catch (err) {
        return res.status(500).json({ message: 'Unable to promote member', error: err.message });
    }
};

exports.demoteMember = async (req, res) => {
    const { boxId, memberUserId } = req.params;
    const currentUserId = req.user.id;
    const targetUserId = Number(memberUserId);

    try {
        await ensureCollaborationTables();

        const ownerId = await getBoxOwnerId(boxId);
        if (Number(ownerId) !== Number(currentUserId)) {
            return res.status(403).json({ message: 'Only main admin can change admin access' });
        }

        if (!Number.isFinite(targetUserId)) {
            return res.status(400).json({ message: 'Invalid member id' });
        }

        if (Number(ownerId) === targetUserId) {
            return res.status(400).json({ message: 'Main admin access cannot be removed' });
        }

        const [memberRows] = await sql.query(
            'SELECT role FROM box_members WHERE box_id = ? AND user_id = ? LIMIT 1',
            [boxId, targetUserId]
        );

        if (!memberRows.length) {
            return res.status(404).json({ message: 'Member not found in this box' });
        }

        if (memberRows[0].role !== 'admin') {
            return res.json({ success: true, message: 'Member is already not an admin' });
        }

        await sql.query(
            'UPDATE box_members SET role = ? WHERE box_id = ? AND user_id = ?',
            ['member', boxId, targetUserId]
        );

        return res.json({
            success: true,
            message: 'Admin access removed from member'
        });
    } catch (err) {
        return res.status(500).json({ message: 'Unable to remove admin access', error: err.message });
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
            `SELECT bm.user_id, u.fullname AS "fullName", u.email, bm.role, bm.created_at,
                    CASE WHEN b.user_id = bm.user_id THEN 1 ELSE 0 END AS is_owner
             FROM box_members bm
             JOIN users u ON u.id = bm.user_id
             JOIN boxes b ON b.id = bm.box_id
             WHERE bm.box_id = ?
             ORDER BY bm.role DESC, bm.created_at ASC`,
            [boxId]
        );

        return res.json({ success: true, data: members });
    } catch (err) {
        console.error('listMembers DB error:', {
            code: err.code || null,
            message: err.message || null,
            detail: err.detail || null,
            table: err.table || null,
        });
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
        const { note, folderPath, adminNote } = req.body;
        const cleanupUploadedFile = () => {
            // no local file to cleanup when using S3/memory storage
        };

        try {
            await ensureCollaborationTables();

            const isAdmin = await ensureAdmin(boxId, userId);
            if (!isAdmin) {
                cleanupUploadedFile();
                return res.status(403).json({ message: 'Only admin can upload content' });
            }
            const isMainAdmin = await ensureMainAdmin(boxId, userId);

            if (!req.file && !note) {
                return res.status(400).json({ message: 'Provide a file or note text' });
            }

            if (!req.file && !isMainAdmin) {
                return res.status(403).json({ message: 'Only main admin can create folders or notes' });
            }

            let contentType = 'note';
            let fileName = null;
            let filePath = null;
            let originalName = null;
            let targetMime = null;

            const safeFolderPath = String(folderPath || '').trim().replace(/^\/+|\/+$/g, '');
            const safeAdminNote = isMainAdmin ? sanitizeAdminNote(adminNote) : '';

            if (req.file) {
                originalName = req.file.originalname;

                let uploadBuffer = req.file.buffer;
                targetMime = req.file.mimetype || 'application/octet-stream';
                const isImage = Boolean(req.file.mimetype && req.file.mimetype.startsWith('image/'));

                contentType = isImage ? 'file' : inferContentType(req.file);

                if (isImage) {
                    try {
                        uploadBuffer = await compressImage(req.file.buffer);
                        targetMime = 'image/webp';
                    } catch (err) {
                        console.error('Image processing failed:', err.message || err);
                        return res.status(400).json({ message: 'Invalid image file' });
                    }
                }

                // Generate unique filename and S3 key
                const uniqueFileName = generateUniqueFilenameForBox(originalName, Boolean(isImage));
                const key = `boxes/${boxId}/${uniqueFileName}`;

                // Upload to S3
                let fileUrl;
                try {
                    fileUrl = await uploadBufferToS3(uploadBuffer, key, targetMime);
                } catch (err) {
                    console.error('S3 upload failed:', err.message || err);
                    return res.status(500).json({ message: 'Failed to upload file to storage' });
                }

                // populate values for DB insert
                fileName = uniqueFileName;
                filePath = fileUrl; // store S3 object key (not full URL) - will be used to generate signed URLs on access
                // set req.file.location to be compatible with multer-s3 consumers
                req.file.location = fileUrl;
                req.file.size = uploadBuffer.length;
                req.file.contentType = targetMime;
                req.file.s3Key = key;
            }

            const [result] = await sql.query(
                `INSERT INTO box_contents
                (box_id, uploaded_by, content_type, file_name, file_path, original_name, mime_type, file_size, s3_key, note_text, admin_note, folder_path)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
                [boxId, userId, contentType, fileName, filePath, originalName, req.file ? targetMime : null, req.file?.size || null, req.file?.s3Key || null, note || null, safeAdminNote, safeFolderPath || null]
            );
            console.log('BOX CONTENT INSERTED', result);
            console.log('INSERT ID:', result.insertId || result.rows);

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
                id: result.insertId,
                boxId: Number(boxId),
                uploadedBy: Number(userId),
                originalName,
                mimeType: req.file ? req.file.mimetype : null,
                size: req.file?.size || null,
                s3Key: req.file?.s3Key || null
            });
        } catch (err) {
            cleanupUploadedFile();
            console.error('uploadBoxContent DB error:', {
                code: err.code || null,
                message: err.message || null,
                detail: err.detail || null,
                table: err.table || null,
            });
            //return res.status(500).json({ message: 'Unable to upload content', error: err.message });
            console.error(`upload error full:`, err);
            return res.status(500).json({
                message: 'Unable to upload content',
                error: err.message,
                stack: err.stack,
                fullError: JSON.stringify(err, null, 2)
            });
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
            `SELECT bc.id, bc.content_type, bc.file_name, bc.file_path, bc.original_name, bc.mime_type, bc.file_size, bc.s3_key, bc.note_text, bc.admin_note, bc.folder_path,
                    bc.created_at, bc.uploaded_by, u.fullname AS uploaded_by_name
             FROM box_contents bc
             LEFT JOIN users u ON u.id = bc.uploaded_by
             WHERE bc.box_id = ?
             ORDER BY bc.created_at DESC`,
            [boxId]
        );

        const [legacyRows] = await sql.query(
            `SELECT bf.id, bf.user_id, bf.file_name, bf.file_size, bf.file_type, bf.file_path, bf.uploaded_at, u.fullname AS uploaded_by_name
             FROM box_files bf
             LEFT JOIN users u ON u.id = bf.user_id
             WHERE bf.box_id = ?
             ORDER BY bf.uploaded_at DESC`,
            [boxId]
        );

        const existingRows = dbRows.filter((row) => {
           if (row.content_type === 'note') return true;

            const fp = String(row.file_path || '').trim();
            const s3Key = String(row.s3_key || '').trim();

            return Boolean(fp || s3Key);
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
                // Keep legacy rows only if they reference a valid URL (S3)
                return /^https?:\/\//i.test(key);
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
                    mime_type: row.file_type,
                    file_size: row.file_size || null,
                    s3_key: extractObjectKeyFromValue(row.file_path),
                    note_text: null,
                    admin_note: null,
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
        console.error('getBoxContents DB error:', {
            code: err.code || null,
            message: err.message || null,
            detail: err.detail || null,
            table: err.table || null,
        });
        return res.status(500).json({ message: 'Unable to fetch contents', error: err.message });
    }
};

exports.getUploadsByQuery = async (req, res) => {
    const boxId = Number(req.query?.boxId);

    if (!Number.isFinite(boxId) || boxId <= 0) {
        return res.status(400).json({ message: 'boxId query parameter is required' });
    }

    req.params = { ...(req.params || {}), boxId: String(boxId) };
    return exports.getBoxContents(req, res);
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
            const updatedNote = safeName.startsWith('[Folder]') ? safeName :
                content.note_text && content.note_text.startsWith('[Folder]')
                    ? `[Folder] ${safeName}`
                    : safeName;

            await sql.query(
                'UPDATE box_contents SET note_text = ? WHERE id = ? AND box_id = ?',
                [updatedNote, contentId, boxId]
            );

            return res.json({ success: true, message: 'Upload renamed successfully' });
        }

        // For S3-backed files, renaming the stored object is costly (copy+delete).
        // We'll update metadata in DB only (file_name, original_name) and leave S3 object key unchanged.
        const updatedFileName = safeName;

        await sql.query(
            `UPDATE box_contents SET file_name = ?, original_name = ? WHERE id = ? AND box_id = ?`,
            [updatedFileName, safeName, contentId, boxId]
        );

        if (content.file_path && content.uploaded_by) {
            // Try to keep legacy table in sync by updating file_name/file_path references
            await syncLegacyFileRename({
                boxId,
                userId: content.uploaded_by,
                oldFilePath: content.file_path,
                newFileName: safeName,
                newFilePath: content.file_path
            });
        }

        return res.json({ success: true, message: 'Upload renamed successfully (metadata updated)' });
    } catch (err) {
        return res.status(500).json({ message: 'Unable to rename upload', error: err.message });
    }
};

exports.deleteBoxContent = async (req, res) => {
    const { boxId, contentId } = req.params;
    const userId = req.user.id;

    try {
        await ensureCollaborationTables();

        const isMainAdmin = await ensureMainAdmin(boxId, userId);
        if (!isMainAdmin) {
            return res.status(403).json({ message: 'Only main admin can delete uploads' });
        }

        const fsRelativePath = decodeFsContentId(contentId);
        if (fsRelativePath) {
            // Legacy local uploads are no longer stored; cannot delete from filesystem
            return res.status(404).json({ message: 'Legacy local upload not found or already migrated' });
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
            // If the file_path is an S3 URL, attempt to delete the object from S3
            if (/^https?:\/\//i.test(String(content.file_path || ''))) {
                await deleteS3ObjectByUrl(content.file_path).catch((e) => {
                    console.error('S3 delete failed (continuing):', e.message || e);
                });
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

exports.updateContentAdminNote = async (req, res) => {
    const { boxId, contentId } = req.params;
    const userId = req.user.id;
    const safeAdminNote = sanitizeAdminNote(req.body?.adminNote);

    try {
        await ensureCollaborationTables();

        const isMainAdmin = await ensureMainAdmin(boxId, userId);
        if (!isMainAdmin) {
            return res.status(403).json({ message: 'Only main admin can update upload notes' });
        }

        const fsRelativePath = decodeFsContentId(contentId);
        if (fsRelativePath) {
            return res.status(400).json({ message: 'Admin note is unavailable for this upload source' });
        }

        const [rows] = await sql.query(
            'SELECT id, content_type, note_text FROM box_contents WHERE id = ? AND box_id = ? LIMIT 1',
            [contentId, boxId]
        );

        if (!rows.length) {
            return res.status(404).json({ message: 'Upload not found' });
        }

        const item = rows[0];
        const noteText = String(item.note_text || '').trim();
        if (item.content_type === 'note' || noteText.startsWith('[Folder]')) {
            return res.status(400).json({ message: 'Admin note can be set only on uploaded files/videos' });
        }

        await sql.query(
            'UPDATE box_contents SET admin_note = ? WHERE id = ? AND box_id = ?',
            [safeAdminNote, contentId, boxId]
        );

        return res.json({
            success: true,
            message: 'Important note updated successfully',
            adminNote: safeAdminNote
        });
    } catch (err) {
        return res.status(500).json({ message: 'Unable to update important note', error: err.message });
    }
};

exports.viewFile = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await sql.query(
            `SELECT file_path, s3_key FROM box_contents WHERE id = ? LIMIT 1`,
            [id]
        );

        if (!rows.length) {
            return res.status(404).send('File not found');
        }

        const file = rows[0];

        let signedUrl = file.file_path;

        // If stored path is not full URL, generate signed URL
        if (!signedUrl || !signedUrl.startsWith('http')) {
            signedUrl = await generateSignedUrl(file.s3_key);
        }

        const response = await fetch(signedUrl);

        res.setHeader(
            'Content-Type',
            response.headers.get('content-type') || 'application/octet-stream'
        );

        res.setHeader(
            'Content-Disposition',
            'inline'
        );

        response.body.pipe(res);

    } catch (err) {
        console.error('viewFile error:', err);
        return res.status(500).send('Unable to open file');
    }
};
