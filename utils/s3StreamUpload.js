const { Upload } = require('@aws-sdk/lib-storage');
const s3Client = require('../config/s3');
const { Readable } = require('stream');

/**
 * OPTIMIZED: Stream buffer directly to S3 using multipart upload
 * - No memory buffering issues
 * - Handles large files efficiently
 * - Progress tracking capability
 * - Auto-retry on failure
 * - 5MB chunk size (configurable)
 */
async function uploadBufferToS3Streaming(buffer, key, contentType, onProgress) {
  try {
    // Convert buffer to readable stream for multipart upload
    const stream = Readable.from(buffer);

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        Body: stream,
        ContentType: contentType,
        // Cache headers optimized
        CacheControl: 'max-age=31536000, immutable', // 1 year for immutable assets
        Metadata: {
          'upload-timestamp': new Date().toISOString()
        }
      },
      // Multipart config
      queueSize: 4, // concurrent parts
      partSize: 5 * 1024 * 1024, // 5MB chunks
      leavePartsOnError: false // cleanup on error
    });

    // Progress tracking hook
    if (onProgress && typeof onProgress === 'function') {
      upload.on('httpUploadProgress', (progress) => {
        const percent = Math.round(
          ((progress.loaded || 0) / (progress.total || buffer.length)) * 100
        );
        onProgress({ loaded: progress.loaded || 0, total: progress.total || buffer.length, percent });
      });
    }

    // Execute multipart upload
    const result = await upload.done();

    console.log('✓ File uploaded to S3 (streaming):', {
      key,
      size: buffer.length,
      contentType,
      etag: result.ETag
    });

    return key;
  } catch (err) {
    console.error('✗ S3 streaming upload failed:', {
      key,
      message: err.message || err,
      code: err.Code || 'UNKNOWN'
    });
    throw err;
  }
}

/**
 * Stream file from disk to S3 (for future file-based uploads)
 */
async function uploadFileToS3Streaming(filePath, key, contentType, onProgress) {
  const fs = require('fs');

  try {
    const fileStream = fs.createReadStream(filePath);
    const stats = fs.statSync(filePath);

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        Body: fileStream,
        ContentType: contentType,
        CacheControl: 'max-age=31536000, immutable',
        Metadata: {
          'upload-timestamp': new Date().toISOString()
        }
      },
      queueSize: 4,
      partSize: 5 * 1024 * 1024,
      leavePartsOnError: false
    });

    if (onProgress && typeof onProgress === 'function') {
      upload.on('httpUploadProgress', (progress) => {
        const percent = Math.round(((progress.loaded || 0) / (stats.size || 1)) * 100);
        onProgress({ loaded: progress.loaded || 0, total: stats.size, percent });
      });
    }

    const result = await upload.done();

    console.log('✓ File streamed to S3:', {
      key,
      size: stats.size,
      contentType,
      etag: result.ETag
    });

    return key;
  } catch (err) {
    console.error('✗ S3 file streaming failed:', {
      key,
      message: err.message || err
    });
    throw err;
  }
}

module.exports = {
  uploadBufferToS3Streaming,
  uploadFileToS3Streaming
};
