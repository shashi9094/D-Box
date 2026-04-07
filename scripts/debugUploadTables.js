const db = require('../db/connection');

const sql = db.promise();

(async () => {
    const [contentsRows] = await sql.query(
        "SELECT id, box_id, uploaded_by, content_type, file_name, file_path, created_at FROM box_contents WHERE content_type IN ('file','video') ORDER BY id DESC LIMIT 20"
    );

    const [filesRows] = await sql.query(
        "SELECT id, box_id, user_id, file_name, file_path, uploaded_at FROM box_files ORDER BY id DESC LIMIT 20"
    );

    const [contentCountRows] = await sql.query(
        "SELECT COUNT(*) AS cnt FROM box_contents WHERE content_type IN ('file','video')"
    );

    const [fileCountRows] = await sql.query(
        "SELECT COUNT(*) AS cnt FROM box_files"
    );

    console.log('file/video in box_contents:', contentCountRows[0].cnt);
    console.log('rows in box_files:', fileCountRows[0].cnt);
    console.log('latest box_contents rows:', contentsRows);
    console.log('latest box_files rows:', filesRows);
})()
    .catch((err) => {
        console.error('debug failed:', err.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await sql.end();
        } catch (_) {
            // ignore
        }
    });
