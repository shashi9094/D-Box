const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = require('../config/s3');
const { uploadBufferToS3Streaming } = require('./s3StreamUpload');
const thumbnailGenerator = require('./thumbnailGenerator');

/**
 * OPTIMIZED: Complete upload flow with error handling
 * - Streaming S3 upload
 * - Async thumbnail generation
 * - Orphan cleanup on failure
 * - Progress tracking
 */
class OptimizedUploadHandler {
  constructor(db) {
    this.db = db;
    this.orphanedS3Keys = new Set();
  }

  /**
   * Main upload orchestration
   * Returns: { key, size, contentType }
   */
  async uploadFile(originalFileName, buffer, mimeType, onProgress) {
    const key = this._generateS3Key(originalFileName);

    try {
      // STEP 1: Stream to S3 (this is fast and can fail)
      console.log(`[Upload] Starting S3 upload: ${originalFileName} (${buffer.length} bytes)`);

      await uploadBufferToS3Streaming(buffer, key, mimeType, onProgress);

      // STEP 2: Trigger async thumbnail generation (non-blocking)
      if (mimeType && mimeType.startsWith('image/')) {
        thumbnailGenerator.generateAsync(key, buffer, mimeType);
      }

      console.log(`[Upload] Completed: ${key}`);

      return {
        key,
        size: buffer.length,
        contentType: mimeType
      };
    } catch (err) {
      // Mark for orphan cleanup if upload failed
      this.orphanedS3Keys.add(key);

      console.error(`[Upload Error] Failed to upload ${originalFileName}:`, err.message);

      // Trigger cleanup async (don't block)
      this._cleanupOrphanedKeyAsync(key);

      throw new Error(`Failed to upload file: ${err.message}`);
    }
  }

  /**
   * Compress image before upload (blocking)
   */
  async compressImage(buffer) {
    return thumbnailGenerator.compressImage(buffer);
  }

  /**
   * Cleanup orphaned S3 key asynchronously
   */
  async _cleanupOrphanedKeyAsync(key) {
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2s before cleanup

      const cmd = new DeleteObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key
      });

      await s3Client.send(cmd);
      console.log(`✓ Cleaned up orphaned S3 key: ${key}`);
      this.orphanedS3Keys.delete(key);
    } catch (err) {
      console.error(`✗ Failed to cleanup orphaned key ${key}:`, err.message);
    }
  }

  /**
   * Generate unique S3 key for file
   * Format: boxes/{boxId}/{timestamp}-{random}-{sanitized_filename}
   */
  _generateS3Key(originalFileName, boxId = null) {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const sanitized = String(originalFileName || 'file')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 100);

    // Note: boxId should come from request, but structure is maintained
    const filename = `${timestamp}-${randomStr}-${sanitized}`;

    return filename; // boxId will be prepended in controller
  }

  /**
   * Validate file before upload
   */
  validateFile(buffer, mimeType, maxSizeBytes = 500 * 1024 * 1024) {
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty file');
    }

    if (buffer.length > maxSizeBytes) {
      throw new Error(`File too large: ${buffer.length} bytes (max: ${maxSizeBytes} bytes)`);
    }

    return true;
  }
}

module.exports = OptimizedUploadHandler;
