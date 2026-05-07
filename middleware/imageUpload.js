const multer = require('multer');

// Use memory storage so we get file buffer in req.file.buffer
const storage = multer.memoryStorage();

// Limits: 10 MB by default (tweak as needed)
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

module.exports = upload;
