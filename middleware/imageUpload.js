const multer = require('multer');

// OPTIMIZED: Use memory storage for streaming upload to S3
const storage = multer.memoryStorage();

// Limits: Increased to 500MB for large file support with multipart upload
const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  }
});

module.exports = upload;
