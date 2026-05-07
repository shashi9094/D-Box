// AWS S3 Upload Helper Functions and Examples for D-Box Frontend

/**
 * Configuration
 */
const S3_CONFIG = {
    ENDPOINT: '/api/files/upload',
    MAX_FILE_SIZE: 100 * 1024 * 1024, // 100 MB
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'application/pdf', 'application/msword', 'text/plain']
};

/**
 * Upload file to AWS S3
 * @param {File} file - File object from input
 * @param {Function} onProgress - Progress callback (optional)
 * @returns {Promise<Object>} - {success, fileUrl, filename, error}
 */
async function uploadFileToS3(file, onProgress = null) {
    // Validation
    if (!file) {
        return {
            success: false,
            error: 'No file selected'
        };
    }

    if (file.size > S3_CONFIG.MAX_FILE_SIZE) {
        return {
            success: false,
            error: `File size exceeds ${(S3_CONFIG.MAX_FILE_SIZE / 1024 / 1024).toFixed(0)} MB limit`
        };
    }

    try {
        // Create FormData
        const formData = new FormData();
        formData.append('file', file);

        // Prepare request options
        const options = {
            method: 'POST',
            body: formData,
            credentials: 'include' // Important: send cookies for session auth
        };

        // Make request
        const response = await fetch(S3_CONFIG.ENDPOINT, options);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            return {
                success: true,
                fileUrl: data.fileUrl,
                filename: data.filename,
                size: data.size,
                key: data.key
            };
        } else {
            return {
                success: false,
                error: data.error || 'Upload failed'
            };
        }
    } catch (error) {
        console.error('S3 Upload Error:', error);
        return {
            success: false,
            error: error.message || 'Network error during upload'
        };
    }
}

/**
 * Example 1: Simple File Input Upload
 * Add this to your HTML:
 * <input type="file" id="simpleFileInput" />
 * <button onclick="handleSimpleUpload()">Upload</button>
 * <div id="uploadResult"></div>
 */
function handleSimpleUpload() {
    const fileInput = document.getElementById('simpleFileInput');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please select a file');
        return;
    }

    // Show loading state
    const button = event.target;
    button.disabled = true;
    button.textContent = 'Uploading...';

    uploadFileToS3(file).then(result => {
        const resultDiv = document.getElementById('uploadResult');

        if (result.success) {
            resultDiv.innerHTML = `
                <div style="border: 2px solid green; padding: 10px; margin: 10px 0;">
                    <h3>✓ Upload Successful!</h3>
                    <p><strong>File URL:</strong></p>
                    <a href="${result.fileUrl}" target="_blank">${result.fileUrl}</a>
                    <p><strong>File Name:</strong> ${result.filename}</p>
                    <p><strong>File Size:</strong> ${(result.size / 1024).toFixed(2)} KB</p>
                </div>
            `;
        } else {
            resultDiv.innerHTML = `
                <div style="border: 2px solid red; padding: 10px; margin: 10px 0;">
                    <h3>✗ Upload Failed</h3>
                    <p>${result.error}</p>
                </div>
            `;
        }

        // Reset button
        button.disabled = false;
        button.textContent = 'Upload';
    });
}

/**
 * Example 2: Upload with Progress Bar
 * Add this to your HTML:
 * <input type="file" id="progressFileInput" />
 * <button onclick="handleUploadWithProgress()">Upload with Progress</button>
 * <div id="progressContainer" style="display:none; margin: 10px 0;">
 *   <progress id="progressBar" max="100" value="0"></progress>
 *   <span id="progressPercent">0%</span>
 * </div>
 */
function handleUploadWithProgress() {
    const fileInput = document.getElementById('progressFileInput');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please select a file');
        return;
    }

    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');

    progressContainer.style.display = 'block';
    progressBar.value = 0;
    progressPercent.textContent = '0%';

    // Simulate upload progress (real progress would require XMLHttpRequest)
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            progressBar.value = percentComplete;
            progressPercent.textContent = percentComplete + '%';
        }
    });

    xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
            const data = JSON.parse(xhr.responseText);
            alert(`Upload successful!\nURL: ${data.fileUrl}`);
            progressContainer.style.display = 'none';
        } else {
            alert('Upload failed');
        }
    });

    xhr.addEventListener('error', () => {
        alert('Upload error occurred');
        progressContainer.style.display = 'none';
    });

    xhr.open('POST', S3_CONFIG.ENDPOINT);
    xhr.withCredentials = true;
    xhr.send(formData);
}

/**
 * Example 3: Drag & Drop Upload
 * Add this to your HTML:
 * <div id="dropZone" style="border: 2px dashed #ccc; padding: 20px; text-align: center;">
 *   Drag and drop files here or click to upload
 *   <input type="file" id="dragDropInput" style="display:none;" />
 * </div>
 * <div id="dropResult"></div>
 */
function initializeDragDrop() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('dragDropInput');

    if (!dropZone || !fileInput) return;

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.style.backgroundColor = '#f0f0f0';
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.style.backgroundColor = '#fff';
        });
    });

    // Handle dropped files
    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length > 0) {
            const file = files[0]; // Take first file
            uploadFileToS3(file).then(result => {
                const resultDiv = document.getElementById('dropResult');
                if (result.success) {
                    resultDiv.innerHTML = `
                        <p>✓ File uploaded: <a href="${result.fileUrl}" target="_blank">${result.filename}</a></p>
                    `;
                } else {
                    resultDiv.innerHTML = `<p>✗ Upload failed: ${result.error}</p>`;
                }
            });
        }
    });

    // Click to browse
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            uploadFileToS3(file).then(result => {
                const resultDiv = document.getElementById('dropResult');
                if (result.success) {
                    resultDiv.innerHTML = `
                        <p>✓ File uploaded: <a href="${result.fileUrl}" target="_blank">${result.filename}</a></p>
                    `;
                } else {
                    resultDiv.innerHTML = `<p>✗ Upload failed: ${result.error}</p>`;
                }
            });
        }
    });
}

/**
 * Example 4: Multiple File Upload
 * Add this to your HTML:
 * <input type="file" id="multipleFilesInput" multiple />
 * <button onclick="handleMultipleUpload()">Upload All</button>
 * <div id="multipleResults"></div>
 */
async function handleMultipleUpload() {
    const fileInput = document.getElementById('multipleFilesInput');
    const files = Array.from(fileInput.files);

    if (files.length === 0) {
        alert('Please select files');
        return;
    }

    const resultsDiv = document.getElementById('multipleResults');
    resultsDiv.innerHTML = `<p>Uploading ${files.length} file(s)...</p>`;

    const results = [];

    for (let i = 0; i < files.length; i++) {
        const result = await uploadFileToS3(files[i]);
        results.push({
            filename: files[i].name,
            ...result
        });

        // Update UI after each upload
        resultsDiv.innerHTML = `<p>Uploaded ${results.length} of ${files.length}...</p>`;
    }

    // Display all results
    let html = '<h3>Upload Results:</h3><ul>';
    results.forEach(result => {
        if (result.success) {
            html += `<li>✓ ${result.filename}: <a href="${result.fileUrl}" target="_blank">View</a></li>`;
        } else {
            html += `<li>✗ ${result.filename}: ${result.error}</li>`;
        }
    });
    html += '</ul>';
    resultsDiv.innerHTML = html;
}

/**
 * Example 5: Upload Specific File Types (Images only)
 */
async function uploadImageToS3() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';

    fileInput.onchange = async (e) => {
        const file = e.target.files[0];

        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        const result = await uploadFileToS3(file);

        if (result.success) {
            console.log('Image uploaded:', result.fileUrl);
            // Use result.fileUrl to display image
            const img = new Image();
            img.src = result.fileUrl;
            img.onload = () => {
                console.log('Image dimensions:', img.width, 'x', img.height);
            };
        } else {
            console.error('Image upload failed:', result.error);
        }
    };

    fileInput.click();
}

/**
 * Initialize all examples when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize drag and drop if element exists
    if (document.getElementById('dropZone')) {
        initializeDragDrop();
    }
});

/**
 * INTEGRATION EXAMPLES FOR EXISTING PAGES:
 * 
 * 1. In uploads.html:
 *    Add upload button that calls uploadFileToS3()
 *    Store fileUrl in database
 *    Link to S3 files instead of local /uploads
 * 
 * 2. In dashboard.html:
 *    Add file upload widget
 *    Display uploaded files from S3
 * 
 * 3. In profile pages:
 *    Upload profile pictures directly to S3
 *    Store S3 URL in database
 * 
 * 4. Replace local uploads:
 *    Instead of storing files in /uploads folder,
 *    upload to S3 and store URLs
 */
