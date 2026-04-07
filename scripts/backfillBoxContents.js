const fs = require('fs');
const path = require('path');
const db = require('../db/connection');

const sql = db.promise();
const uploadsRoot = path.join(__dirname, '..', 'uploads', 'boxes');

const args = new Set(process.argv.slice(2));
const isApplyMode = args.has('--apply');

const toPosix = (value) => String(value || '').replace(/\\/g, '/');

const inferContentTypeFromName = (fileName) => {
    const ext = path.extname(String(fileName || '')).toLowerCase();
    if (['.mp4', '.mov', '.webm', '.mkv', '.avi', '.m4v'].includes(ext)) return 'video';
    return 'file';
};

const deriveOriginalName = (fileName) => String(fileName || '').replace(/^\d+-/, '');

const walkFiles = (dirPath, relativeDir = '') => {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const absolutePath = path.join(dirPath, entry.name);
        const relativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;

        if (entry.isDirectory()) {
            files.push(...walkFiles(absolutePath, relativePath));
            continue;
        }

        files.push({
            absolutePath,
            relativePath: toPosix(relativePath),
            fileName: entry.name
        });
    }

    return files;
};

const ensureBoxContentsTable = async () => {
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

    try {
        await sql.query('ALTER TABLE box_contents ADD COLUMN folder_path VARCHAR(500) NULL AFTER note_text');
    } catch (err) {
        if (!err || err.code !== 'ER_DUP_FIELDNAME') {
            throw err;
        }
    }
};

const ensureLegacyBoxFilesTable = async () => {
    await sql.query(`
        CREATE TABLE IF NOT EXISTS box_files (
            id INT NOT NULL AUTO_INCREMENT,
            box_id INT NOT NULL,
            user_id INT NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            file_size BIGINT NOT NULL,
            file_type VARCHAR(128) NOT NULL,
            file_path VARCHAR(1024) DEFAULT NULL,
            uploaded_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY box_id (box_id),
            CONSTRAINT box_files_ibfk_1 FOREIGN KEY (box_id) REFERENCES boxes (id) ON DELETE CASCADE
        )
    `);
};

const main = async () => {
    console.log(`Mode: ${isApplyMode ? 'APPLY (will insert records)' : 'DRY RUN (no DB writes)'}`);

    await ensureBoxContentsTable();
    await ensureLegacyBoxFilesTable();

    if (!fs.existsSync(uploadsRoot)) {
        console.log(`No uploads directory found at: ${uploadsRoot}`);
        return;
    }

    const [boxRows] = await sql.query('SELECT id, user_id FROM boxes');
    const boxOwnerMap = new Map(boxRows.map((row) => [String(row.id), Number(row.user_id)]));

    const [existingRows] = await sql.query(
        `SELECT box_id, file_path
         FROM box_contents
         WHERE content_type IN ('file', 'video') AND file_path IS NOT NULL`
    );

    const [legacyRows] = await sql.query(
        `SELECT box_id, user_id, file_path
         FROM box_files
         WHERE file_path IS NOT NULL`
    );

    const existingPathSet = new Set(
        existingRows.map((row) => `${row.box_id}|${String(row.file_path)}`)
    );

    const existingLegacyPathSet = new Set(
        legacyRows.map((row) => `${row.box_id}|${row.user_id}|${String(row.file_path)}`)
    );

    const rootEntries = fs.readdirSync(uploadsRoot, { withFileTypes: true });

    let scannedFiles = 0;
    let inserted = 0;
    let skippedExisting = 0;
    let skippedUnknownBox = 0;
    let skippedUnmappedRootFiles = 0;

    for (const entry of rootEntries) {
        if (!entry.isDirectory()) {
            // Legacy file at uploads/boxes/<file> cannot be mapped safely to a box.
            skippedUnmappedRootFiles += 1;
            continue;
        }

        const boxId = String(entry.name).trim();
        if (!/^\d+$/.test(boxId)) {
            skippedUnknownBox += 1;
            continue;
        }

        const ownerId = boxOwnerMap.get(boxId);
        if (!ownerId) {
            skippedUnknownBox += 1;
            continue;
        }

        const boxDir = path.join(uploadsRoot, boxId);
        const files = walkFiles(boxDir);

        for (const file of files) {
            scannedFiles += 1;

            const filePath = `/uploads/boxes/${boxId}/${file.relativePath}`;
            const dedupeKey = `${boxId}|${filePath}`;
            const legacyDedupeKey = `${boxId}|${ownerId}|${filePath}`;

            if (existingPathSet.has(dedupeKey)) {
                skippedExisting += 1;
                continue;
            }

            const stats = fs.statSync(file.absolutePath);
            const originalName = deriveOriginalName(file.fileName) || file.fileName;
            const folderPath = toPosix(path.dirname(file.relativePath)).replace(/^\.$/, '') || null;
            const contentType = inferContentTypeFromName(file.fileName);

            if (isApplyMode) {
                await sql.query(
                    `INSERT INTO box_contents
                     (box_id, uploaded_by, content_type, file_name, file_path, original_name, note_text, folder_path, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        Number(boxId),
                        ownerId,
                        contentType,
                        file.fileName,
                        filePath,
                        originalName,
                        null,
                        folderPath,
                        stats.mtime
                    ]
                );

                if (!existingLegacyPathSet.has(legacyDedupeKey)) {
                    await sql.query(
                        `INSERT INTO box_files
                         (box_id, user_id, file_name, file_size, file_type, file_path, uploaded_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            Number(boxId),
                            ownerId,
                            originalName,
                            Number(stats.size || 0),
                            contentType,
                            filePath,
                            stats.mtime
                        ]
                    );

                    existingLegacyPathSet.add(legacyDedupeKey);
                }
            }

            inserted += 1;
            existingPathSet.add(dedupeKey);
        }
    }

    console.log('Backfill summary:');
    console.log(`- Scanned files: ${scannedFiles}`);
    console.log(`- ${isApplyMode ? 'Inserted records' : 'Would insert'}: ${inserted}`);
    console.log(`- Skipped (already exists): ${skippedExisting}`);
    console.log(`- Skipped (unknown/non-numeric box folder): ${skippedUnknownBox}`);
    console.log(`- Skipped (legacy files directly under uploads/boxes): ${skippedUnmappedRootFiles}`);

    if (!isApplyMode) {
        console.log('Run with --apply to insert rows into MySQL.');
    }
};

main()
    .catch((err) => {
        console.error('Backfill failed:', err.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await sql.end();
        } catch (e) {
            // Ignore close errors.
        }
    });
