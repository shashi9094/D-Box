const express = require('express');
const router = express.Router();
const authMiddleware = require('../utils/authMiddleware');
const fileController = require('../controllers/fileController');
const upload = require('../middleware/upload');
const boxController = require('../controllers/boxController');

// Get signed URL for file (to open/download from S3)
router.get('/files/:id/view', authMiddleware, boxController.viewFile);

// Protect file routes with session auth
router.use(authMiddleware);

// S3 file upload endpoint
router.post('/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file provided'
            });
        }

        // req.file.location is provided by multer-s3
        return res.status(200).json({
            success: true,
            fileUrl: req.file.location,
            filename: req.file.originalname,
            size: req.file.size,
            key: req.file.key
        });
    } catch (error) {
        console.error('Upload error:', error.message);
        return res.status(500).json({
            success: false,
            error: 'File upload failed: ' + error.message
        });
    }
});

// More specific routes MUST come before general routes
// Get signed URL for file (to open/download from S3)
router.get('/:id/signed-url', fileController.getSignedUrl);

// Get all files in a box with signed URLs
router.get('/box/:boxId', fileController.getBoxFiles);

// Dynamic route param must be named :id to access req.params.id
router.get('/:id', fileController.getFileById);

module.exports = router;
