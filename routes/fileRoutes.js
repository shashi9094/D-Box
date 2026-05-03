const express = require('express');
const router = express.Router();
const authMiddleware = require('../utils/authMiddleware');
const fileController = require('../controllers/fileController');

// Protect file routes with session auth
router.use(authMiddleware);

// Dynamic route param must be named :id to access req.params.id
router.get('/:id', fileController.getFileById);

module.exports = router;
