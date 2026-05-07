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
const s3Storage = multerS3({
    s3: s3Client,
    bucket: process.env.AWS_BUCKET_NAME || 'd-box-2026',
    acl: 'public-read', // Make uploaded files public
    metadata: (req, file, cb) => {
        cb(null, {
            fieldName: file.fieldname,
            userId: req.session?.user?.id || 'anonymous'
        });
    },
    key: (req, file, cb) => {
        const uniqueName = generateUniqueFilename(file.originalname);
        cb(null, `uploads/${uniqueName}`);
    }
});

// Create multer upload middleware
const upload = multer({
    storage: s3Storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100 MB limit
    },
    fileFilter: (req, file, cb) => {
        // Optional: Add file type filtering
        // const allowedMimes = ['image/jpeg', 'image/png', 'application/pdf'];
        // if (allowedMimes.includes(file.mimetype)) {
        //     cb(null, true);
        // } else {
        //     cb(new Error('Invalid file type'));
        // }
        cb(null, true);
    }
});

module.exports = upload;
