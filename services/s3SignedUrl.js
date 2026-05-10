/**
 * AWS S3 Signed URL Service
 * Generates secure, time-limited signed URLs for private S3 objects
 * Uses @aws-sdk/s3-request-presigner for v3 SDK
 */

const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const s3Client = require('../config/s3');

// Configuration
const SIGNED_URL_EXPIRATION_SECONDS = 3600; // 1 hour
const THUMBNAIL_EXPIRATION_SECONDS = 86400; // 24 hours

/**
 * Generate a signed URL for downloading/viewing an S3 object
 * @param {string} objectKey - S3 object key (path)
 * @param {Object} options - Configuration options
 * @param {number} options.expirationSeconds - URL expiration time in seconds (default: 3600)
 * @param {string} options.responseContentDisposition - inline or attachment disposition
 * @returns {Promise<string>} - Signed URL
 */
const generateSignedDownloadUrl = async (objectKey, options = {}) => {
    try {
        if (!objectKey) {
            throw new Error('Object key is required');
        }

        const bucket = process.env.AWS_BUCKET_NAME;
        if (!bucket) {
            throw new Error('AWS_BUCKET_NAME environment variable not set');
        }

        const expirationSeconds = options.expirationSeconds || SIGNED_URL_EXPIRATION_SECONDS;
        const responseDisposition = options.responseContentDisposition || 'inline';

        console.log('Generating signed URL', {
            key: objectKey,
            bucket,
            expirationSeconds,
            disposition: responseDisposition,
        });

        const command = new GetObjectCommand({
            Bucket: bucket,
            Key: objectKey,
            ResponseContentDisposition: responseDisposition === 'attachment'
                ? `attachment; filename="${encodeURIComponent(objectKey.split('/').pop())}"`
                : 'inline',
        });

        const signedUrl = await getSignedUrl(s3Client, command, {
            expiresIn: expirationSeconds,
        });

        console.log('✓ Signed URL generated successfully', { key: objectKey });
        return signedUrl;
    } catch (error) {
        console.error('✗ Failed to generate signed URL', {
            key: objectKey,
            error: error.message,
            code: error.code || null,
        });
        throw error;
    }
};

/**
 * Generate signed URLs for multiple files
 * @param {Array<string>} objectKeys - Array of S3 object keys
 * @param {Object} options - Configuration options
 * @returns {Promise<Array<{key: string, url: string}>>} - Array of key/URL pairs
 */
const generateSignedDownloadUrls = async (objectKeys = [], options = {}) => {
    try {
        if (!Array.isArray(objectKeys) || objectKeys.length === 0) {
            return [];
        }

        const results = await Promise.all(
            objectKeys.map(async (key) => {
                try {
                    const url = await generateSignedDownloadUrl(key, options);
                    return { key, url, success: true };
                } catch (error) {
                    console.warn(`Failed to generate signed URL for ${key}:`, error.message);
                    return { key, url: null, success: false, error: error.message };
                }
            })
        );

        return results;
    } catch (error) {
        console.error('Failed to generate batch signed URLs:', error.message);
        throw error;
    }
};

/**
 * Extract S3 object key from various URL formats
 * @param {string} value - S3 URL, S3 key, or file path
 * @returns {string|null} - S3 object key or null
 */
const extractObjectKeyFromValue = (value) => {
    if (!value) return null;

    const str = String(value).trim();

    // If it's already a clean key (no URL), return as-is
    if (!str.includes('://') && !str.includes('s3.') && !str.startsWith('http')) {
        return str;
    }

    // Extract from full S3 URL: https://bucket.s3.region.amazonaws.com/key
    try {
        const url = new URL(str);
        const key = decodeURIComponent(url.pathname.replace(/^\//, ''));
        if (key && !key.includes('.amazonaws.com')) {
            return key;
        }
    } catch (e) {
        // Not a valid URL
    }

    // Extract from path-style URL: https://s3.region.amazonaws.com/bucket/key
    const pathStyleMatch = str.match(/s3[^/]*\.amazonaws\.com\/[^/]+\/(.+)$/i);
    if (pathStyleMatch && pathStyleMatch[1]) {
        return decodeURIComponent(pathStyleMatch[1]);
    }

    // Already looks like a key
    return str;
};

/**
 * Validate if a value is a valid S3 object key or URL
 * @param {string} value - S3 URL or key
 * @returns {boolean}
 */
const isValidS3KeyOrUrl = (value) => {
    return Boolean(extractObjectKeyFromValue(value));
};

/**
 * Get file info and generate signed URLs for a file
 * @param {Object} fileData - File data from database
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} - File info with signed URLs
 */
const getFileWithSignedUrls = async (fileData = {}, options = {}) => {
    try {
        if (!fileData || !fileData.file_path) {
            throw new Error('Invalid file data: missing file_path');
        }

        const objectKey = extractObjectKeyFromValue(fileData.file_path);
        if (!objectKey) {
            throw new Error('Could not extract S3 object key from file_path');
        }

        console.log('Generating signed URL for file', {
            fileName: fileData.original_name || fileData.file_name,
            objectKey,
        });

        const fileUrl = await generateSignedDownloadUrl(objectKey, {
            expirationSeconds: options.expirationSeconds || SIGNED_URL_EXPIRATION_SECONDS,
            responseContentDisposition: options.download ? 'attachment' : 'inline',
        });

        // If there's a thumbnail, generate a separate signed URL
        let thumbnailUrl = null;
        if (fileData.thumbnail_path) {
            try {
                const thumbKey = extractObjectKeyFromValue(fileData.thumbnail_path);
                if (thumbKey) {
                    thumbnailUrl = await generateSignedDownloadUrl(thumbKey, {
                        expirationSeconds: options.thumbnailExpirationSeconds || THUMBNAIL_EXPIRATION_SECONDS,
                        responseContentDisposition: 'inline',
                    });
                }
            } catch (error) {
                console.warn('Failed to generate thumbnail URL:', error.message);
            }
        }

        return {
            id: fileData.id,
            fileName: fileData.original_name || fileData.file_name,
            fileUrl,
            thumbnailUrl,
            contentType: fileData.content_type,
            objectKey,
            expiresAt: new Date(Date.now() + (options.expirationSeconds || SIGNED_URL_EXPIRATION_SECONDS) * 1000).toISOString(),
            success: true,
        };
    } catch (error) {
        console.error('Failed to get file with signed URLs:', error.message);
        return {
            success: false,
            error: error.message,
        };
    }
};

module.exports = {
    generateSignedDownloadUrl,
    generateSignedDownloadUrls,
    extractObjectKeyFromValue,
    isValidS3KeyOrUrl,
    getFileWithSignedUrls,
    SIGNED_URL_EXPIRATION_SECONDS,
    THUMBNAIL_EXPIRATION_SECONDS,
};
