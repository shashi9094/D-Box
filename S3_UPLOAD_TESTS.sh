#!/bin/bash
# AWS S3 Upload Test Examples

echo "=== S3 File Upload Testing Guide ==="
echo ""

# Test 1: Using curl (requires authentication)
echo "Test 1: Using curl with session cookie"
echo "Command:"
echo 'curl -b "connect.sid=YOUR_SESSION_ID" -F "file=@/path/to/file.pdf" http://localhost:3000/api/files/upload'
echo ""

# Test 2: JavaScript Fetch in Browser Console
echo "Test 2: JavaScript Fetch (paste in browser console)"
cat << 'EOF'
const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
const formData = new FormData();
formData.append('file', file);

fetch('/api/files/upload', {
    method: 'POST',
    body: formData,
    credentials: 'include'
})
.then(res => res.json())
.then(data => console.log(data))
.catch(err => console.error(err));
EOF
echo ""

# Test 3: Using Node.js
echo "Test 3: Using Node.js with axios"
cat << 'EOF'
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function testUpload() {
    const form = new FormData();
    form.append('file', fs.createReadStream('/path/to/file.pdf'));

    try {
        const response = await axios.post(
            'http://localhost:3000/api/files/upload',
            form,
            {
                headers: form.getHeaders(),
                withCredentials: true // For cookies
            }
        );
        console.log('Upload successful:', response.data);
    } catch (error) {
        console.error('Upload failed:', error.response?.data || error.message);
    }
}

testUpload();
EOF
echo ""

# Test 4: Expected Response
echo "Test 4: Expected Success Response"
cat << 'EOF'
{
  "success": true,
  "fileUrl": "https://d-box-2026.s3.eu-north-1.amazonaws.com/uploads/1715000000000-abc123-test.pdf",
  "filename": "test.pdf",
  "size": 102400,
  "key": "uploads/1715000000000-abc123-test.pdf"
}
EOF
echo ""

# Test 5: Expected Error Response
echo "Test 5: Expected Error Response"
cat << 'EOF'
{
  "success": false,
  "error": "No file provided"
}
EOF
echo ""

# Test 6: HTML Form Test
echo "Test 6: HTML Form for Manual Testing"
cat << 'EOF'
<form action="/api/files/upload" method="POST" enctype="multipart/form-data">
    <input type="file" name="file" required />
    <button type="submit">Upload to S3</button>
</form>
EOF
echo ""

# Verification Steps
echo "=== Verification Steps ==="
echo "1. Ensure server is running: npm run dev"
echo "2. Check AWS credentials in .env file"
echo "3. Verify S3 bucket exists: d-box-2026"
echo "4. Check S3 bucket region: eu-north-1"
echo "5. Verify IAM user has S3 permissions"
echo "6. Test with a small file first (< 1 MB)"
echo "7. Check server logs for errors"
echo "8. Verify uploaded file URL is accessible in browser"
