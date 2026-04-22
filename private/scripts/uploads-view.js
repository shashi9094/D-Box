// --- PATCH: Status badge auto-hide & improved delete selection mode logic ---
let selectedUploadIds = new Set();
let isDeleteSelectMode = false;
let batchStatusTimeout = null;

// Show batch status message (success/error) with auto-hide after 3s
function setBatchStatus(message = '', isError = false) {
  const statusEl = document.getElementById('uploadsBatchStatus');
  if (!statusEl) return;
  const safeMessage = String(message || '').trim();
  if (!safeMessage) {
    statusEl.hidden = true;
    statusEl.classList.remove('is-error');
    statusEl.textContent = '';
    if (batchStatusTimeout) clearTimeout(batchStatusTimeout);
    return;
  }
  statusEl.textContent = safeMessage;
  statusEl.hidden = false;
  statusEl.classList.toggle('is-error', Boolean(isError));
  if (batchStatusTimeout) clearTimeout(batchStatusTimeout);
  batchStatusTimeout = setTimeout(() => {
    statusEl.hidden = true;
    statusEl.textContent = '';
    statusEl.classList.remove('is-error');
  }, 3000);
}

function syncDeleteModeButtonLabel() {
  const modeBtn = document.getElementById('deleteSelectModeBtn');
  if (!modeBtn) return;
  // If any file is selected, keep ON
  if (selectedUploadIds.size > 0) {
    modeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i> Cancel delete selection';
    isDeleteSelectMode = true;
  } else {
    modeBtn.innerHTML = isDeleteSelectMode
      ? '<i class="fa-solid fa-xmark"></i> Cancel delete selection'
      : '<i class="fa-solid fa-check-double"></i> Select to delete';
  }
}

document.addEventListener('DOMContentLoaded', function () {
  const fabMenu = document.getElementById('fabMenu');
  if (fabMenu) {
    fabMenu.addEventListener('click', (event) => {
      // Assume isAdminUser() always true for demo, or replace with real check
      const actionButton = event.target.closest('button[data-action]');
      if (!actionButton) return;
      const action = actionButton.dataset.action;
      fabMenu.hidden = true;
      if (action === 'select-delete') {
        // Only one selection mode ON at a time
        if (isDeleteSelectMode && selectedUploadIds.size === 0) {
          isDeleteSelectMode = false;
        } else {
          isDeleteSelectMode = true;
        }
        if (!isDeleteSelectMode) {
          selectedUploadIds = new Set();
        }
        syncDeleteModeButtonLabel();
        // syncDeleteSelectedButton(); // Add if needed
        // renderContents(); // Add if needed
      }
    });
  }
  const uploadsGrid = document.getElementById('uploadsGrid');
  if (uploadsGrid) {
    uploadsGrid.addEventListener('change', (event) => {
      const selectInput = event.target.closest('input[data-select-upload]');
      if (!selectInput) return;
      const contentId = String(selectInput.dataset.selectUpload || '').trim();
      if (!contentId) return;
      if (selectInput.checked) {
        selectedUploadIds.add(contentId);
      } else {
        selectedUploadIds.delete(contentId);
      }
      // If none selected, turn OFF mode
      if (selectedUploadIds.size === 0) {
        isDeleteSelectMode = false;
      } else {
        isDeleteSelectMode = true;
      }
      syncDeleteModeButtonLabel();
      // syncDeleteSelectedButton(); // Add if needed
    });
  }
});
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
