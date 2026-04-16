require('dotenv').config();
const db = require('../db/connection');

const sql = db.promise();
const args = new Set(process.argv.slice(2));
const isApplyMode = args.has('--apply');

(async () => {
  try {
    console.log(`Mode: ${isApplyMode ? 'APPLY (update over-capacity boxes)' : 'DRY RUN (no changes)'}`);

    const [rows] = await sql.query(
      `SELECT b.id,
              b.title,
              b.capacity,
              COUNT(DISTINCT bm.user_id) AS memberCount,
              COUNT(DISTINCT CASE WHEN bi.status = 'pending' THEN bi.email END) AS pendingInviteCount
       FROM boxes b
       LEFT JOIN box_members bm ON bm.box_id = b.id
       LEFT JOIN box_invites bi ON bi.box_id = b.id
       GROUP BY b.id, b.title, b.capacity
       ORDER BY b.id ASC`
    );

    const normalizedBoxes = rows
      .map((row) => {
        const capacity = Number(row.capacity || 1);
        const memberCount = Number(row.memberCount || 0);
        const pendingInviteCount = Number(row.pendingInviteCount || 0);
        const reservedCount = memberCount + pendingInviteCount;

        return {
          id: Number(row.id),
          title: String(row.title || ''),
          capacity,
          memberCount,
          pendingInviteCount,
          reservedCount,
          nextCapacity: Math.max(capacity, reservedCount)
        };
      })
      .filter((row) => row.nextCapacity !== row.capacity);

    console.log(`Found ${normalizedBoxes.length} box(es) that need capacity normalization.`);

    for (const box of normalizedBoxes) {
      console.log(
        `- #${box.id} ${box.title || '(untitled)'}: capacity ${box.capacity} -> ${box.nextCapacity} ` +
        `(members=${box.memberCount}, pending=${box.pendingInviteCount}, reserved=${box.reservedCount})`
      );

      if (isApplyMode) {
        await sql.query('UPDATE boxes SET capacity = ? WHERE id = ?', [box.nextCapacity, box.id]);
      }
    }

    if (!normalizedBoxes.length) {
      console.log('No capacity updates needed.');
    } else if (!isApplyMode) {
      console.log('Run with --apply to write the updates.');
    } else {
      console.log('Capacity normalization completed successfully.');
    }
  } catch (error) {
    console.error('Normalize capacities failed:', error.code || '', error.message);
    process.exitCode = 1;
  } finally {
    try {
      await sql.end();
    } catch (_) {
      // ignore close errors
    }
  }
})();
