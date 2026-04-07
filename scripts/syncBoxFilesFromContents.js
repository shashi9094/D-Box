const db = require('../db/connection');

const sql = db.promise();

(async () => {
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

    const [insertResult] = await sql.query(
        `INSERT INTO box_files (box_id, user_id, file_name, file_size, file_type, file_path, uploaded_at)
         SELECT
            bc.box_id,
            bc.uploaded_by,
            COALESCE(NULLIF(bc.original_name, ''), COALESCE(NULLIF(bc.file_name, ''), 'file')),
            0,
            bc.content_type,
            bc.file_path,
            bc.created_at
         FROM box_contents bc
         WHERE bc.content_type IN ('file', 'video')
           AND bc.file_path IS NOT NULL
           AND bc.uploaded_by IS NOT NULL
           AND NOT EXISTS (
               SELECT 1
               FROM box_files bf
               WHERE bf.box_id = bc.box_id
                 AND bf.user_id = bc.uploaded_by
                 AND bf.file_path = bc.file_path
               LIMIT 1
           )`
    );

    const [countRows] = await sql.query('SELECT COUNT(*) AS cnt FROM box_files');

    console.log('Inserted into box_files:', insertResult.affectedRows || 0);
    console.log('box_files total rows:', countRows[0].cnt);
})()
    .catch((err) => {
        console.error('sync failed:', err.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await sql.end();
        } catch (_) {
            // ignore
        }
    });
