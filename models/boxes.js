const db = require('../db/connection');

const Boxes = {
    create:(data, callback) => {
        db.query(
            'INSERT INTO boxes (user_id, title, description) VALUES (?, ?, ?)',
            [data.user_id, data.title, data.description],
            callback
        );
    },
};

module.exports = Boxes;