const sharp = require('sharp');
const s3Client = require('../config/s3');
const { PutObjectCommand } = require('@aws-sdk/client-s3');

/**
 * OPTIMIZED: Async thumbnail generation
 * - Non-blocking
 * - Fire-and-forget pattern
 * - Graceful error handling
 * - Thumbnail stored separately in S3
 */
class ThumbnailGenerator {
  constructor() {
    this.activeJobs = new Map();
    this.completedThumbnails = new Set();
  }

  /**
   * Generate and upload thumbnail ASYNC (don't wait)
   * Returns immediately, processing happens in background
   */
  generateAsync(fileKey, buffer, mimeType) {
    // Skip if already processing or completed
    if (this.activeJobs.has(fileKey) || this.completedThumbnails.has(fileKey)) {
      return;
    }

    // Mark as active to prevent duplicate jobs
    this.activeJobs.set(fileKey, true);

    // Fire-and-forget: no await, no .catch() that breaks flow
    this._generateThumbnailInternal(fileKey, buffer, mimeType)
      .then(() => {
        this.completedThumbnails.add(fileKey);
        console.log(`✓ Thumbnail ready: ${fileKey}`);
      })
      .catch((err) => {
        console.error(`✗ Thumbnail generation failed for ${fileKey}:`, err.message);
        // Don't throw - let main flow continue
      })
      .finally(() => {
        this.activeJobs.delete(fileKey);
      });
  }

  /**
   * Internal: actual thumbnail generation
   */
  async _generateThumbnailInternal(fileKey, buffer, mimeType) {
    try {
      // Check if it's an image
      if (!mimeType || !mimeType.startsWith('image/')) {
        return;
      }

      // Generate thumbnail: 200x200px, 60% quality
      const thumbnailBuffer = await sharp(buffer)
        .rotate()
        .resize(200, 200, {
          fit: 'cover',
          withoutEnlargement: true
        })
        .webp({ quality: 60 })
        .toBuffer();

      // Upload thumbnail to S3
      const thumbnailKey = fileKey.replace(/^([^/]+\/[^/]+\/)/, '$1.thumbnails/');
      const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: thumbnailKey,
        Body: thumbnailBuffer,
        ContentType: 'image/webp',
        CacheControl: 'max-age=31536000, immutable',
        Metadata: {
          'original-key': fileKey,
          'thumbnail': 'true'
        }
      };

      await s3Client.send(new PutObjectCommand(params));

      console.log(`✓ Thumbnail uploaded: ${thumbnailKey} (${thumbnailBuffer.length} bytes)`);
    } catch (err) {
      // Log but don't propagate errors
      console.error(`Thumbnail generation internal error for ${fileKey}:`, err.message);
    }
  }

  /**
   * Compress image (blocking) - used before upload
   */
  async compressImage(buffer) {
    try {
      return await sharp(buffer)
        .rotate()
        .resize({
          width: 1920,
          withoutEnlargement: true
        })
        .webp({
          quality: 82
        })
        .toBuffer();
    } catch (err) {
      console.error('Image compression failed:', err.message);
      throw err;
    }
  }

  /**
   * Check if thumbnail exists/is ready
   */
  isThumbnailReady(fileKey) {
    return this.completedThumbnails.has(fileKey);
  }

  /**
   * Check if thumbnail is being processed
   */
  isThumbnailProcessing(fileKey) {
    return this.activeJobs.has(fileKey);
  }
}

// Singleton instance
const thumbnailGenerator = new ThumbnailGenerator();

module.exports = thumbnailGenerator;
