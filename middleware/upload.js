const multer = require('multer');
const multerS3 = require('multer-s3');
const s3Client = require('../config/s3');

// Generate unique filename with timestamp
function generateUniqueFilename(originalName) {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${randomString}-${originalName}`;
}

// OPTIMIZED: Memory storage for streaming multipart uploads
const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        // Increased from 100MB to 500MB for large file support
        fileSize: 500 * 1024 * 1024
    },

    fileFilter: (req, file, cb) => {
        // Validate file
        if (!file) {
            return cb(new Error('No file provided'));
        }
        cb(null, true);
    }
});

module.exports = upload;


