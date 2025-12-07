const db = require('../db/connection');

const Users = {
    create : (userData, callback) => {
        db.query(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [Data.name, data.email, data.password],
            callback
        );
    },
};
module.exports = Users;


