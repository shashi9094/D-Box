const sharp = require('sharp');
const crypto = require('crypto');
const s3Client = require('../config/s3');
const { PutObjectCommand } = require('@aws-sdk/client-s3');

// Allowed input mimetypes
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

function generateFilename() {
  const ts = Date.now();
  const rand = crypto.randomBytes(6).toString('hex');
  return `${ts}-${rand}.webp`;
}

async function uploadBufferToS3(buffer, key, contentType) {
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: 'public-read'
  };

  const cmd = new PutObjectCommand(params);
  await s3Client.send(cmd);

  const region = process.env.AWS_REGION || 'us-east-1';
  const bucket = process.env.AWS_BUCKET_NAME;
  const url = `https://${bucket}.s3.${region}.amazonaws.com/${encodeURI(key)}`;
  return url;
}

// Controller: handles image processing and upload
async function uploadImage(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const { originalname, mimetype, size } = req.file;

    if (!ALLOWED_MIMES.has(mimetype)) {
      return res.status(400).json({ success: false, error: 'Unsupported file type' });
    }

    // Process image with sharp: resize, convert to WEBP with quality 80
    const processedBuffer = await sharp(req.file.buffer)
      .rotate()
      .resize({ width: 1920, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const filename = generateFilename();
    const key = `images/${filename}`;

    const fileUrl = await uploadBufferToS3(processedBuffer, key, 'image/webp');

    // Prepare metadata to save in DB (caller should save URL & metadata)
    const metadata = {
      originalName: originalname,
      mimeType: 'image/webp',
      size: processedBuffer.length,
      s3Key: key,
      url: fileUrl,
      uploadedAt: new Date()
    };

    // Optional: save to MongoDB if you have a model/DB configured.
    // Example (uncomment and adapt):
    // const Image = require('../models/imageModel');
    // await Image.create({ url: fileUrl, originalName: originalname, mimeType: 'image/webp', size: processedBuffer.length });

    return res.status(200).json({ success: true, fileUrl, metadata });
  } catch (err) {
    console.error('Image upload error:', err);
    return res.status(500).json({ success: false, error: 'Image upload failed: ' + err.message });
  }
}

module.exports = {
  uploadImage
};
