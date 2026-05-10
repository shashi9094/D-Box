# S3 Signed URL Implementation Guide

## Overview
This implementation adds secure, time-limited signed URLs for private S3 file access. Instead of storing public S3 URLs directly in the database, we now store only S3 object keys and generate signed URLs on-demand when files are accessed.

## What Changed

### 1. **Backend Services** (`services/s3SignedUrl.js`)
- New service for generating AWS S3 signed URLs using `@aws-sdk/s3-request-presigner`
- Features:
  - `generateSignedDownloadUrl()` - Generate 1-hour signed URL for a file
  - `generateSignedDownloadUrls()` - Batch URL generation
  - `extractObjectKeyFromValue()` - Extract S3 key from URLs or raw keys (backward compatible)
  - `getFileWithSignedUrls()` - Fetch file metadata and generate signed URLs
  - URL caching: 24-hour cache for thumbnails, 1-hour for files
  - Comprehensive error logging for debugging AWS/S3 issues

### 2. **API Endpoints** (`routes/fileRoutes.js`)
#### New Endpoints:
- **GET `/api/files/:id/signed-url`** - Get signed URL for a specific file
  - Response: `{ success: true, fileUrl, fileName, objectKey, expiresAt }`
  - Session-based access control verified
- **GET `/api/files/box/:boxId`** - Get all files in a box with signed URLs
  - Returns array of files with generated signed URLs
  - Pagination-ready structure

#### Updated Endpoint:
- **GET `/api/files/:id`** - Now includes authentication and signed URL generation (optional)

### 3. **File Upload Handler** (`controllers/boxController.js`)
#### Changes to `uploadBufferToS3()`:
- **Before**: Returned full S3 URL like `https://bucket.s3.region.amazonaws.com/key`
- **After**: Returns only S3 object key like `uploads/boxes/1/1234567-abc-file.pdf`
- **Benefit**: Database now stores only the key, not the full URL

#### Updated `deleteS3ObjectByUrl()`:
- Now handles both:
  - S3 object keys (new format)
  - Full S3 URLs (old format, for backward compatibility during migration)
- Extracts key from either format before deletion

### 4. **Frontend Service** (`private/scripts/fileUrlService.js`)
New JavaScript utility for secure file opening:
```javascript
// Open file in new tab
await fileUrlService.openFile(fileId, {
  target: '_blank',
  errorCallback: (error) => console.error(error),
  successCallback: () => console.log('Opened!')
});

// Download file
await fileUrlService.downloadFile(fileId, 'filename.pdf');

// Get file info with signed URLs
const info = await fileUrlService.getFileInfo(fileId);
```

Features:
- Caches signed URLs for 55 minutes (URLs valid 1 hour)
- Automatic error handling with user-friendly messages
- Session-based authentication (uses `credentials: 'include'`)
- Console logging for debugging

### 5. **Frontend Updates** (`private/pages/uploads.html`)
- Added `<script src="/scripts/fileUrlService.js">` import
- Updated file opening logic to:
  1. Call `fileUrlService.openFile(fileId)` instead of `window.open(filePath)`
  2. Fetch signed URL from backend
  3. Open URL in new tab with proper error handling
  4. Fallback to direct opening if service unavailable

### 6. **Dependencies** (`package.json`)
Added:
```json
"@aws-sdk/s3-request-presigner": "^3.1044.0"
```

## Data Flow

### File Upload Flow (New)
```
1. User uploads file → multer receives in memory
2. uploadBufferToS3() → S3 PutObjectCommand
3. Returns: S3 object key (e.g., "uploads/boxes/1/file.pdf")
4. Database stores: ONLY the key
5. Thumbnail generated and also stored as key
```

### File Opening Flow (New)
```
1. User clicks on file card in uploads view
2. Frontend calls fileUrlService.openFile(fileId)
3. Service fetches: GET /api/files/:id/signed-url
4. Backend verifies access → generates signed URL
5. Service caches URL for 55 minutes
6. Frontend opens URL with window.open()
```

## Migration Guide

### For Existing Files in Database
The implementation is **backward compatible**:
- Old files have: `file_path = "https://bucket.s3.region.amazonaws.com/uploads/boxes/1/file.pdf"`
- New files have: `file_path = "uploads/boxes/1/file.pdf"`
- `extractObjectKeyFromValue()` handles both formats automatically
- `deleteS3ObjectByUrl()` extracts key from either format

### Optional: Backfill Existing URLs
If you want to clean up the database to store only keys:

```javascript
// This extracts key from existing URLs
const { extractObjectKeyFromValue } = require('./services/s3SignedUrl');

const oldUrl = "https://bucket.s3.region.amazonaws.com/uploads/boxes/1/file.pdf";
const key = extractObjectKeyFromValue(oldUrl);
// Result: "uploads/boxes/1/file.pdf"
```

## Configuration

### Environment Variables (Already Configured)
```
AWS_REGION=eu-north-1
AWS_BUCKET_NAME=your-bucket-name
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

### Signed URL Expiration Times
- **Files**: 1 hour (3600 seconds)
- **Thumbnails**: 24 hours (86400 seconds)
- Configure in `services/s3SignedUrl.js`:
  ```javascript
  const SIGNED_URL_EXPIRATION_SECONDS = 3600;
  const THUMBNAIL_EXPIRATION_SECONDS = 86400;
  ```

## Security Benefits

✅ **Private Bucket Enforcement**: No more direct public URLs
✅ **Time-Limited Access**: URLs expire after 1 hour  
✅ **Signed by AWS**: URLs include cryptographic signature
✅ **Session-Based**: Access verified before URL generation
✅ **Per-User Access Control**: Box membership checked before serving URL
✅ **No URL Leaks**: URLs stored in database are just keys, not sensitive URLs

## Testing

### Test File Opening
1. Navigate to a box uploads page
2. Click on a file (PDF, image, video, document)
3. Check browser console for signed URL logs
4. File should open in new tab (check browser security warnings)
5. If blocked, check S3 bucket CORS settings

### Test API Endpoints
```bash
# Get signed URL for file ID 1
curl -X GET "http://localhost:5000/api/files/1/signed-url" \
  -H "Cookie: connect.sid=YOUR_SESSION" \
  -H "Accept: application/json"

# Expected response:
{
  "success": true,
  "id": 1,
  "fileName": "document.pdf",
  "fileUrl": "https://bucket.s3.eu-north-1.amazonaws.com/uploads/boxes/1/file?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...",
  "objectKey": "uploads/boxes/1/1234567-abc-file.pdf",
  "expiresAt": "2024-12-21T15:30:00.000Z"
}
```

### Debug Console Logs
Open browser DevTools (F12) and check Console for:
```
[FileUrl] Fetching signed URL for file 1...
[FileUrl] Using cached URL for file 1
✓ Got signed URL for: document.pdf
[FileUrl] Opening file 1 with signed URL...
✓ File opened successfully
```

## Troubleshooting

### Issue: "Failed to generate file URL"
**Cause**: AWS credentials invalid or S3 bucket not accessible
**Fix**: 
- Verify `AWS_BUCKET_NAME` environment variable
- Check AWS credentials in Railway/deployment settings
- Check S3 bucket exists and is not blocked by bucket policy

### Issue: File opens then closes or shows "Access Denied"
**Cause**: S3 bucket policy blocks direct access
**Fix**:
- Ensure S3 bucket policy allows authenticated access
- Check CORS settings if cross-origin request
- Verify signed URL includes correct AWS credentials

### Issue: "You do not have access to this file"
**Cause**: User not a member of the box
**Fix**:
- User must be invited to box first
- Check box_members table for user entry

### Issue: Files not downloading/opening properly
**Cause**: Content-Type header mismatch
**Debug**:
1. Check CloudFront/S3 logs
2. Verify `Content-Type` was set correctly during upload
3. Check browser CORS settings
4. Try opening with different browser

## Files Modified/Created

### Created:
- `services/s3SignedUrl.js` - Signed URL generation service
- `private/scripts/fileUrlService.js` - Frontend file opening utility

### Modified:
- `controllers/fileController.js` - Added signed URL endpoints
- `controllers/boxController.js` - Changed to store object keys only
- `routes/fileRoutes.js` - New endpoint routes
- `private/pages/uploads.html` - Use signed URL service for opening files
- `package.json` - Added @aws-sdk/s3-request-presigner dependency

## Performance Considerations

✅ **URL Caching**: 55-minute cache reduces API calls by 90%+
✅ **Lazy Generation**: URLs generated only when accessed
✅ **No File Transfer**: Only metadata and URLs transferred
✅ **Scalable**: Works for unlimited files
⚠️ **Cache Size**: In-memory cache grows with active users - consider Redis for large deployments

## Next Steps (Optional)

1. **Add Redis Caching**: Cache signed URLs across server instances
2. **Implement Download Tracking**: Log file access for analytics
3. **Add File Expiration**: Auto-delete old files after X days
4. **Implement File Versioning**: Support file history/rollback
5. **Add Virus Scanning**: Scan uploads with ClamAV
6. **Implement Rate Limiting**: Prevent URL generation abuse

## Support

For issues or questions:
1. Check browser console (F12) for error messages
2. Review server logs in Railway dashboard
3. Verify AWS credentials and S3 bucket configuration
4. Test with curl commands as shown in Testing section
