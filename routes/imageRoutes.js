const express = require('express');
const router = express.Router();
const authMiddleware = require('../utils/authMiddleware');
const upload = require('../middleware/imageUpload');
const imageController = require('../controllers/imageController');

// Protect this route with session auth
router.post('/upload', authMiddleware, upload.single('image'), imageController.uploadImage);

module.exports = router;
