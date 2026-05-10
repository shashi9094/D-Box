/**
 * File Opening Service with Signed URLs
 * Fetches secure signed URLs from backend before opening files
 */

class FileUrlService {
    constructor() {
        this.cache = new Map(); // Cache signed URLs to avoid repeated requests
        this.cacheDuration = 55 * 60 * 1000; // 55 minutes (URLs valid for 1 hour)
        this.urlApiBase = '/api/files';
    }

    /**
     * Get cached signed URL if still valid
     */
    getCachedUrl(fileId) {
        const cached = this.cache.get(fileId);
        if (cached && Date.now() < cached.expiresAt) {
            console.log(`[FileUrl] Using cached URL for file ${fileId}`);
            return cached.url;
        }
        if (cached) {
            this.cache.delete(fileId);
        }
        return null;
    }

    /**
     * Cache a signed URL
     */
    setCachedUrl(fileId, url) {
        this.cache.set(fileId, {
            url,
            expiresAt: Date.now() + this.cacheDuration,
        });
    }

    /**
     * Fetch signed URL from backend
     */
    async fetchSignedUrl(fileId) {
        try {
            if (!fileId) {
                throw new Error('File ID is required');
            }

            // Check cache first
            const cachedUrl = this.getCachedUrl(fileId);
            if (cachedUrl) {
                return cachedUrl;
            }

            console.log(`[FileUrl] Fetching signed URL for file ${fileId}...`);

            const response = await fetch(`${this.urlApiBase}/${fileId}/signed-url`, {
                method: 'GET',
                credentials: 'include', // Include session cookies
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: Failed to get signed URL`);
            }

            const data = await response.json();

            if (!data.success || !data.fileUrl) {
                throw new Error(data.error || 'No URL returned from server');
            }

            console.log(`✓ Got signed URL for: ${data.fileName}`);
            console.log(`[FileUrl] Generated signed URL for file ${fileId}:`, data.fileUrl);

            // Cache the URL
            this.setCachedUrl(fileId, data.fileUrl);

            return data.fileUrl;
        } catch (error) {
            console.error(`✗ Failed to fetch signed URL for file ${fileId}:`, error.message);
            throw error;
        }
    }

    /**
     * Open file in new tab/window with signed URL
     */
    async openFile(fileId, options = {}) {
        const {
            target = '_blank',
            errorCallback = null,
            successCallback = null,
        } = options;

        try {
            const fileInfo = await this.getFileInfo(fileId);
            const signedUrl = await this.fetchSignedUrl(fileId);
            const contentType = String(fileInfo?.content_type || '').toLowerCase();
            const fileName = String(fileInfo?.original_name || fileInfo?.file_name || '').toLowerCase();
            const isPreviewable =
                contentType.startsWith('image/') ||
                contentType === 'application/pdf' ||
                contentType.startsWith('video/') ||
                /\.(png|jpe?g|gif|webp|bmp|svg|pdf|mp4|webm|ogg)$/i.test(fileName);

            console.log(`[FileUrl] Opening file ${fileId}...`, { contentType, isPreviewable });
            console.log(`[FileUrl] Open flow started for file ${fileId}`);

            if (isPreviewable) {
                const previewWindow = window.open('about:blank', target, 'noopener');
                if (!previewWindow) {
                    throw new Error('Popup blocked. Please allow popups for this site.');
                }

                const response = await fetch(signedUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch file: HTTP ${response.status}`);
                }

                const blob = await response.blob();
                const objectUrl = URL.createObjectURL(blob);
                previewWindow.location.href = objectUrl;

                setTimeout(() => {
                    try {
                        URL.revokeObjectURL(objectUrl);
                    } catch (revokeError) {
                        console.warn('Failed to revoke object URL:', revokeError.message);
                    }
                }, 60 * 1000);
            } else {
                window.open(signedUrl, target, 'noopener');
            }

            if (successCallback) {
                successCallback();
            }
        } catch (error) {
            const errorMsg = error.message || 'Failed to open file';
            console.error('✗ Error opening file:', errorMsg);

            if (errorCallback) {
                errorCallback(errorMsg);
            } else {
                alert(`Error opening file: ${errorMsg}`);
            }
        }
    }

    /**
     * Download file with signed URL
     */
    async downloadFile(fileId, fileName) {
        try {
            const signedUrl = await this.fetchSignedUrl(fileId);

            console.log(`[FileUrl] Downloading file ${fileId}...`);

            // Create a temporary link and click it
            const link = document.createElement('a');
            link.href = signedUrl;
            link.download = fileName || `file-${fileId}`;
            link.style.display = 'none';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            console.log(`✓ Download started for: ${fileName}`);
        } catch (error) {
            console.error('✗ Error downloading file:', error.message);
            alert(`Error downloading file: ${error.message}`);
        }
    }

    /**
     * Get file info with signed URLs
     */
    async getFileInfo(fileId) {
        try {
            console.log(`[FileUrl] Fetching file info for file ${fileId}...`);

            const response = await fetch(`${this.urlApiBase}/${fileId}`, {
                method: 'GET',
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: Failed to get file info`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Failed to get file info');
            }

            console.log(`✓ Got file info: ${data.data.original_name || data.data.file_name}`);

            return data.data;
        } catch (error) {
            console.error('✗ Error getting file info:', error.message);
            throw error;
        }
    }

    /**
     * Clear cached URLs
     */
    clearCache() {
        this.cache.clear();
        console.log('[FileUrl] Cache cleared');
    }
}

// Create singleton instance
const fileUrlService = new FileUrlService();

// Export for use in modules and as global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = fileUrlService;
}
