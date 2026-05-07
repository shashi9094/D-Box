# AWS S3 File Upload Integration Setup Guide

## 1. Package Installation

Your required packages are **already installed** in `package.json`:

```bash
npm install @aws-sdk/client-s3 multer multer-s3
```

To verify all packages are installed:
```bash
npm install
```

## 2. Environment Variables

Add these to your `.env` file:

```env
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key_here
AWS_REGION=eu-north-1
AWS_BUCKET_NAME=d-box-2026
```

**Important Security Notes:**
- Never commit `.env` to Git
- Store sensitive credentials in environment variables or AWS Secrets Manager
- For production, use IAM roles instead of hardcoded credentials

## 3. AWS S3 Setup Steps

### Create an S3 Bucket:
1. Go to AWS S3 Console
2. Create bucket `d-box-2026` in `eu-north-1` region
3. Configure public access:
   - Go to **Bucket Settings → Block Public Access → Uncheck "Block all public access"**
   - Apply the block public access settings

### Create IAM User:
1. Go to IAM Console
2. Create a new user (e.g., `d-box-s3-user`)
3. Attach policy: `AmazonS3FullAccess` (or create custom policy for specific bucket)
4. Generate access key and secret key
5. Save credentials in `.env`

### Bucket Policy (Optional but Recommended):
Add this policy to make uploaded files readable:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::d-box-2026/*"
        }
    ]
}
```

## 4. File Structure

Created files:
- `config/s3.js` - S3 Client configuration
- `middleware/upload.js` - Multer + S3 middleware
- Updated: `routes/fileRoutes.js` - Added POST /upload endpoint

## 5. API Endpoint

**Route:** `POST /api/files/upload`

**Headers:**
```
Content-Type: multipart/form-data
```

**Form Data:**
- `file` (required) - Binary file data

**Response (Success):**
```json
{
  "success": true,
  "fileUrl": "https://d-box-2026.s3.eu-north-1.amazonaws.com/uploads/1715000000000-abc123-filename.pdf",
  "filename": "filename.pdf",
  "size": 1024000,
  "key": "uploads/1715000000000-abc123-filename.pdf"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "File upload failed: error message"
}
```

## 6. Frontend Example - HTML + Fetch API

```html
<!DOCTYPE html>
<html>
<head>
    <title>S3 File Upload Example</title>
</head>
<body>
    <h1>Upload File to AWS S3</h1>

    <input type="file" id="fileInput" />
    <button onclick="uploadFile()">Upload to S3</button>

    <div id="result"></div>

    <script>
        async function uploadFile() {
            const fileInput = document.getElementById('fileInput');
            const file = fileInput.files[0];

            if (!file) {
                alert('Please select a file');
                return;
            }

            // Create FormData
            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await fetch('/api/files/upload', {
                    method: 'POST',
                    body: formData,
                    credentials: 'include' // Important for session auth
                });

                const result = await response.json();

                if (result.success) {
                    document.getElementById('result').innerHTML = `
                        <h3>✓ Upload Successful!</h3>
                        <p><strong>File URL:</strong></p>
                        <a href="${result.fileUrl}" target="_blank">${result.fileUrl}</a>
                        <p><strong>File Name:</strong> ${result.filename}</p>
                        <p><strong>File Size:</strong> ${(result.size / 1024).toFixed(2)} KB</p>
                    `;
                } else {
                    document.getElementById('result').innerHTML = `
                        <h3>✗ Upload Failed</h3>
                        <p>${result.error}</p>
                    `;
                }
            } catch (error) {
                console.error('Upload error:', error);
                document.getElementById('result').innerHTML = `
                    <h3>✗ Upload Error</h3>
                    <p>${error.message}</p>
                `;
            }
        }
    </script>
</body>
</html>
```

## 7. Frontend Example - JavaScript/React

```javascript
// Using async/await
async function uploadToS3(file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/files/upload', {
            method: 'POST',
            body: formData,
            credentials: 'include' // Send cookies for auth
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            console.log('Upload successful:', data.fileUrl);
            return {
                success: true,
                url: data.fileUrl,
                filename: data.filename
            };
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Upload failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Usage in React component
import { useState } from 'react';

function FileUpload() {
    const [loading, setLoading] = useState(false);
    const [fileUrl, setFileUrl] = useState(null);

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setLoading(true);
        const result = await uploadToS3(file);
        setLoading(false);

        if (result.success) {
            setFileUrl(result.url);
            alert(`File uploaded: ${result.filename}`);
        } else {
            alert(`Upload failed: ${result.error}`);
        }
    };

    return (
        <div>
            <input
                type="file"
                onChange={handleFileChange}
                disabled={loading}
            />
            {loading && <p>Uploading...</p>}
            {fileUrl && <a href={fileUrl} target="_blank">View File</a>}
        </div>
    );
}

export default FileUpload;
```

## 8. Troubleshooting

| Issue | Solution |
|-------|----------|
| `NoCredentialsError` | Check AWS credentials in `.env` file |
| `AccessDenied` | Verify IAM user has S3 permissions |
| `NoSuchBucket` | Verify bucket name matches `AWS_BUCKET_NAME` in `.env` |
| `403 Forbidden` | Check bucket policy and public access settings |
| `File not publicly readable` | Ensure `acl: 'public-read'` in `middleware/upload.js` |
| Files only in `/uploads/` folder | This is configured in `middleware/upload.js` key function |

## 9. Testing

```bash
# Start server
npm run dev

# Test upload endpoint with curl
curl -X POST http://localhost:3000/api/files/upload \
  -F "file=@/path/to/file.pdf"
```

## 10. Key Features of This Implementation

✓ Authenticated uploads (requires session auth)
✓ Unique filenames (timestamp + random string + original name)
✓ Public read access for uploaded files
✓ 100 MB file size limit
✓ Proper error handling
✓ AWS SDK v3 (latest version)
✓ CommonJS syntax (require/module.exports)
✓ Metadata tracking (userId, fieldName)
✓ Returns file URL immediately after upload

## 11. Next Steps (Optional Enhancements)

1. **Add file validation:**
   - Uncomment fileFilter in `middleware/upload.js`
   - Validate MIME types and extensions

2. **Virus scanning:**
   - Integrate ClamAV for security scanning

3. **Database tracking:**
   - Store file metadata in database
   - Track who uploaded what

4. **Compression:**
   - Use `sharp` (already installed) for image optimization

5. **Direct browser upload:**
   - Implement presigned URLs for direct S3 upload from browser
