// Video & Image preview for uploads page

document.addEventListener('DOMContentLoaded', function () {
  const uploadsGrid = document.getElementById('uploadsGrid');
  if (!uploadsGrid) return;

  // Example: You should replace this with your actual fetch logic
  fetchUploads().then(files => {
    uploadsGrid.innerHTML = '';
    files.forEach(file => {
      const ext = file.original_name.split('.').pop().toLowerCase();
      let el;
      if (["mp4","webm","mov","mkv","avi","m4v"].includes(ext)) {
        el = document.createElement('video');
        el.src = file.file_path;
        el.controls = true;
        el.width = 320;
        el.height = 180;
        el.style.margin = '10px';
      } else if (["jpg","jpeg","png","gif","bmp","svg"].includes(ext)) {
        el = document.createElement('img');
        el.src = file.file_path;
        el.alt = file.original_name;
        el.width = 120;
        el.style.margin = '10px';
      } else {
        el = document.createElement('a');
        el.href = file.file_path;
        el.textContent = file.original_name;
        el.target = '_blank';
        el.style.display = 'block';
        el.style.margin = '10px';
      }
      uploadsGrid.appendChild(el);
    });
  });
});

// Dummy fetchUploads function. Replace with real API call.
function fetchUploads() {
  // Example: Replace with actual fetch(`/api/your-endpoint`)
  return Promise.resolve([
    // Example objects:
    // { original_name: 'sample.mp4', file_path: '/uploads/boxes/15/sample.mp4' },
    // { original_name: 'photo.jpg', file_path: '/uploads/boxes/15/photo.jpg' },
  ]);
}
