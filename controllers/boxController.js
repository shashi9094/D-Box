const db = require('../db/connection');

// Create Box
exports.createBox = (req, res) => {
    const { user_id, title, description } = req.body;

    if (!user_id || !title || !description) {
        return res.status(400).send('User ID, title and description are required');
    }

    const query = 'INSERT INTO boxes (user_id, title, description) VALUES (?, ?, ?)';
    db.query(query, [user_id, title, description], (err, result) => {
        if (err){
            return res.status(500).json({error: 'Error creating box', details: err});
        }
        res.json({success: true, message: `Box created successfully`,id: result.insertId});
    });
};

// Get All Boxes
exports.getAllBoxes = (req, res) => {
    db.query('SELECT * FROM boxes', (err, results) => {
        if (err) return res.status(500).send('Error fetching boxes');
        res.json(results);
    });
};

// Get Single Box
exports.getBoxById = (req, res) => {
    const { id } = req.params;
    db.query('SELECT * FROM boxes WHERE id = ?', [id], (err, rows) => {
        if (err) return res.status(500).send('Error fetching box');
        res.json(rows[0]);
    });
};

// Update Box
exports.updateBox = (req, res) => {
    const { id } = req.params;
    const { title, description } = req.body;
    
    db.query(
        'UPDATE boxes SET title = ?, description = ? WHERE id = ?',
        [title, description, id],
        (err) => {
            if (err) return res.status(500).send('Error updating box');
            res.json({ success: true, message: 'Box updated successfully' });
        }
    );
};      

// Delete Box
exports.deleteBox = (req, res) => {
    const { id } = req.params;
    
    db.query('DELETE FROM boxes WHERE id = ?', [id], (err) => {
        if (err) return res.status(500).send('Error deleting box');
        res.json({ success: true, message: 'Box deleted successfully' });
    });
};