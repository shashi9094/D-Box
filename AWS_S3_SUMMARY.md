# AWS S3 Integration - Implementation Summary

## ✅ Files Created/Modified

### 1. **config/s3.js** (NEW)
Initializes AWS S3 Client with credentials from environment variables.

```javascript
const { S3Client } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'eu-north-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

module.exports = s3Client;
```

### 2. **middleware/upload.js** (NEW)
Multer S3 middleware for handling file uploads directly to AWS S3.

**Key Features:**
- Generates unique filenames: `timestamp-random-originalname`
- Makes files publicly readable (`acl: 'public-read'`)
- Stores files in `uploads/` folder in S3 bucket
- 100 MB file size limit
- Optional file type filtering
- Metadata tracking (userId, fieldName)

### 3. **routes/fileRoutes.js** (UPDATED)
Added POST `/api/files/upload` endpoint.

**Request:**
```
POST /api/files/upload
Content-Type: multipart/form-data
Form Data: file (binary)
```

**Response (Success):**
```json
{
  "success": true,
  "fileUrl": "https://d-box-2026.s3.eu-north-1.amazonaws.com/uploads/1715000000000-abc123-file.pdf",
  "filename": "file.pdf",
  "size": 102400,
  "key": "uploads/1715000000000-abc123-file.pdf"
}
```

### 4. **private/scripts/s3-upload-helper.js** (NEW)
Frontend helper functions for S3 uploads with 5 examples:
1. Simple file input upload
2. Upload with progress bar
3. Drag & drop upload
4. Multiple file upload
5. Image-specific upload

### 5. **s3.env.example** (NEW)
Sample environment variables configuration.

### 6. **S3_INTEGRATION_GUIDE.md** (NEW)
Comprehensive setup and troubleshooting guide.

### 7. **S3_UPLOAD_TESTS.sh** (NEW)
Testing examples using curl, JavaScript, Node.js, and HTML forms.

---

## 🚀 Quick Start

### Step 1: Configure Environment Variables
Add to your `.env` file:
```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=eu-north-1
AWS_BUCKET_NAME=d-box-2026
```

### Step 2: Verify AWS Setup
- S3 bucket exists: `d-box-2026`
- Bucket region: `eu-north-1`
- Bucket has public read access enabled
- IAM user has S3 permissions

### Step 3: Start Server
```bash
npm run dev
```

### Step 4: Test Upload
Use any of the provided examples:
- **Curl:** See S3_UPLOAD_TESTS.sh
- **Frontend:** Include s3-upload-helper.js
- **Fetch API:** See S3_INTEGRATION_GUIDE.md

---

## 📝 Integration into Existing Pages

### Example: uploads.html
```html
<!-- Add to uploads.html -->
<script src="/scripts/s3-upload-helper.js"></script>

<input type="file" id="fileInput" />
<button onclick="handleSimpleUpload()">Upload to S3</button>
<div id="uploadResult"></div>
```

### Example: dashboard.html (Drag & Drop)
```html
<script src="/scripts/s3-upload-helper.js"></script>

<div id="dropZone" style="border: 2px dashed #ccc; padding: 20px;">
  Drag files here or click to upload
  <input type="file" id="dragDropInput" style="display:none;" />
</div>
<div id="dropResult"></div>

<script>
document.addEventListener('DOMContentLoaded', initializeDragDrop);
</script>
```

---

## 🔧 Technical Details

### Dependencies (Already Installed)
```json
{
  "@aws-sdk/client-s3": "^3.1044.0",
  "multer": "^2.1.1",
  "multer-s3": "^3.0.1"
}
```

### Middleware Order in server.js
The upload middleware is already integrated into:
- `routes/fileRoutes.js` → `POST /api/files/upload`
- Uses `upload.single('file')` from middleware/upload.js
- Requires authentication (via authMiddleware)

### File Upload Flow
```
Client (browser)
  ↓ (POST /api/files/upload with file)
Server (Express)
  ↓ (Authentication check)
Multer S3 Middleware
  ↓ (Generate unique filename)
AWS S3 Bucket
  ↓ (Store file)
Server Response
  ↓ (Return fileUrl)
Client
  ↓ (Use S3 URL)
```

---

## 🛡️ Security Features

✓ **Authentication Required:** All uploads require session auth
✓ **Unique Filenames:** Prevents accidental overwrites
✓ **File Size Limits:** 100 MB limit (configurable)
✓ **Public Read Access:** Files accessible to anyone with URL
✓ **Metadata Tracking:** Stores userId with each upload
✓ **Error Handling:** Comprehensive try-catch and validation

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| `NoCredentialsError` | Check AWS credentials in `.env` |
| `NoSuchBucket` | Verify S3 bucket name in `.env` |
| `AccessDenied` | Check IAM user permissions |
| `403 Forbidden` | Enable public access in S3 bucket policy |
| Upload fails silently | Check browser console for CORS errors |
| File not accessible | Verify `acl: 'public-read'` in upload.js |

---

## 📊 Usage Examples

### Simple Upload (JavaScript)
```javascript
const file = document.getElementById('fileInput').files[0];
const result = await uploadFileToS3(file);
if (result.success) {
  console.log('Uploaded:', result.fileUrl);
}
```

### Display Uploaded Image
```javascript
const result = await uploadFileToS3(imageFile);
const img = document.createElement('img');
img.src = result.fileUrl;
document.body.appendChild(img);
```

### Store URL in Database
```javascript
// After upload succeeds
const result = await uploadFileToS3(file);
await fetch('/api/box/store-file', {
  method: 'POST',
  body: JSON.stringify({
    fileUrl: result.fileUrl,
    filename: result.filename
  })
});
```

---

## 🔄 Migration from Local Uploads to S3

If you want to migrate existing local uploads to S3:

1. **List all files in `/uploads` folder**
2. **Create a migration script** to read files and upload to S3
3. **Update database** to reference new S3 URLs
4. **Delete local files** after verification

Example migration script:
```javascript
const fs = require('fs');
const path = require('path');

async function migrateToS3() {
  const uploadsDir = path.join(__dirname, 'uploads');
  const files = fs.readdirSync(uploadsDir);
  
  for (const file of files) {
    const filePath = path.join(uploadsDir, file);
    const fileContent = fs.readFileSync(filePath);
    // Upload to S3
    // Update database
  }
}
```

---

## 📈 Next Steps (Optional)

1. **Add image optimization:** Use `sharp` to compress images before upload
2. **Add virus scanning:** Integrate ClamAV for security
3. **Add file versioning:** S3 can track multiple versions
4. **Presigned URLs:** Allow direct browser-to-S3 uploads
5. **CloudFront CDN:** Speed up file delivery globally
6. **Backup:** Configure S3 backup policies

---

## 🎯 API Reference

### Upload Endpoint
```
POST /api/files/upload
```

**Headers:**
- `Content-Type: multipart/form-data` (automatic with FormData)
- `Cookie: connect.sid=...` (automatic with credentials: 'include')

**Body:**
- `file`: Binary file data

**Response (200 OK):**
```json
{
  "success": true,
  "fileUrl": "https://d-box-2026.s3.eu-north-1.amazonaws.com/uploads/...",
  "filename": "original-filename.pdf",
  "size": 102400,
  "key": "uploads/timestamp-random-filename.pdf"
}
```

**Response (400/500 Error):**
```json
{
  "success": false,
  "error": "Error message description"
}
```

---

## 📚 Useful Resources

- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [Multer S3 GitHub](https://github.com/badrap/multer-s3)
- [AWS SDK v3 JavaScript](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/)
- [Express.js Middleware](https://expressjs.com/en/guide/using-middleware.html)

---

## ❓ Common Questions

**Q: Are uploaded files public?**
A: Yes, files are set with `acl: 'public-read'`. Anyone with the URL can access them.

**Q: Can I make files private?**
A: Change `acl: 'public-read'` to `acl: 'private'` in middleware/upload.js. Then use presigned URLs.

**Q: What if upload fails?**
A: Check error message in response. Common issues: credentials, bucket, permissions, file size.

**Q: Can I upload directly from browser to S3?**
A: Yes, using presigned URLs. See next steps section.

**Q: How do I delete files from S3?**
A: Create a DELETE endpoint using S3Client's DeleteObjectCommand.

---

## ✨ You're All Set!

The AWS S3 integration is now ready. Start uploading! 🚀
