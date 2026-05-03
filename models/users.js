const db = require('../db/connection');

const Users = {
    create: (userData, callback) => {
        const fullName = String(userData?.fullName || userData?.fullname || userData?.name || '').trim();
        const email = String(userData?.email || '').trim().toLowerCase();
        const password = userData?.password ?? null;

        db.query(
            'INSERT INTO users (fullname, email, password) VALUES (?, ?, ?) RETURNING id, fullname AS "fullName", email',
            [fullName, email, password],
            callback
        );
    },
};
module.exports = Users;


