// Filter only member boxes (not admin) and handle question form hide

document.addEventListener('DOMContentLoaded', function () {
  const select = document.getElementById('askAdminBoxSelect');
  if (select) {
    fetch('/api/boxes/member')
      .then(res => res.json())
      .then(data => {
        select.innerHTML = '';
        (data.boxes || []).forEach(box => {
          const opt = document.createElement('option');
          opt.value = box.id;
          opt.textContent = box.title;
          select.appendChild(opt);
        });
        if (!select.options.length) {
          const opt = document.createElement('option');
          opt.value = '';
          opt.textContent = 'No boxes found';
          select.appendChild(opt);
        }
      });
  }

  // Hide form on Escape or when closed
  const askForm = document.getElementById('askAdminForm');
  if (askForm) {
    // Remove any hide button if present
    const hideBtn = askForm.querySelector('.notification-ask-hide-btn, .hide-question-form-btn');
    if (hideBtn) hideBtn.remove();

    // Hide on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !askForm.hidden) {
        askForm.hidden = true;
      }
    });
  }
});
