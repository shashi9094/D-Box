const multer = require('multer');
const multerS3 = require('multer-s3');
const s3Client = require('../config/s3');

// Generate unique filename with timestamp
function generateUniqueFilename(originalName) {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${randomString}-${originalName}`;
}

// Configure multerS3 storage
const multer = require('multer');

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 100 * 1024 * 1024
    },

    fileFilter: (req, file, cb) => {
        cb(null, true);
    }
});

module.exports = upload;


