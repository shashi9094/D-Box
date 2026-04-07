const fs = require('fs');
const path = require('path');
const db = require('../db/connection');

const sql = db.promise();
const args = new Set(process.argv.slice(2));
const isApplyMode = args.has('--apply');

const resolveUploadAbsolutePath = (filePathValue) => {
    const normalizedPath = String(filePathValue || '').replace(/^\/+/, '').replace(/\\/g, path.sep);
    return normalizedPath ? path.join(__dirname, '..', normalizedPath) : '';
};

const hasPhysicalFile = (filePathValue) => {
    const absolutePath = resolveUploadAbsolutePath(filePathValue);
    return absolutePath && fs.existsSync(absolutePath);
};

const run = async () => {
    console.log(`Mode: ${isApplyMode ? 'APPLY (delete stale rows)' : 'DRY RUN (no delete)'}`);

    const [contentRows] = await sql.query(
        `SELECT id, box_id, uploaded_by, content_type, file_path
         FROM box_contents
         WHERE content_type IN ('file', 'video')`
    );

    const [fileRows] = await sql.query(
        `SELECT id, box_id, user_id, file_path
         FROM box_files`
    );

    const staleContents = contentRows.filter((row) => !hasPhysicalFile(row.file_path));
    const staleBoxFiles = fileRows.filter((row) => !hasPhysicalFile(row.file_path));

    if (isApplyMode) {
        for (const row of staleContents) {
            await sql.query('DELETE FROM box_contents WHERE id = ?', [row.id]);
        }

        for (const row of staleBoxFiles) {
            await sql.query('DELETE FROM box_files WHERE id = ?', [row.id]);
        }
    }

    console.log('Cleanup summary:');
    console.log(`- Stale in box_contents: ${staleContents.length}`);
    console.log(`- Stale in box_files: ${staleBoxFiles.length}`);

    if (!isApplyMode) {
        console.log('Run with --apply to delete stale rows.');
    }
};

run()
    .catch((err) => {
        console.error('Cleanup failed:', err.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await sql.end();
        } catch (_) {
            // ignore
        }
    });
