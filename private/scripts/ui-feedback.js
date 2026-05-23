(function () {
  if (window.dboxFeedback) {
    return;
  }

  const STYLE_ID = 'dbox-feedback-styles';
  const CONTAINER_ID = 'dbox-toast-container';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .dbox-toast-container {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 2147483000;
        display: grid;
        gap: 10px;
        width: min(92vw, 360px);
        pointer-events: none;
      }

      .dbox-toast {
        display: flex;
        align-items: center;
        gap: 10px;
        background: #fff;
        color: #1f2937;
        border: 1px solid #e5e7eb;
        border-left: 4px solid #4F46E5;
        border-radius: 10px;
        padding: 12px 14px;
        box-shadow: 0 10px 28px rgba(15, 23, 42, 0.14);
        font-size: 14px;
        line-height: 1.4;
        opacity: 0;
        transform: translateY(8px);
        animation: dbox-toast-in 160ms ease-out forwards;
      }

      .dbox-toast.is-error {
        border-left-color: #dc2626;
      }

      .dbox-toast-icon {
        width: 18px;
        flex: 0 0 18px;
        color: #4F46E5;
      }

      .dbox-toast.is-error .dbox-toast-icon {
        color: #dc2626;
      }

      @keyframes dbox-toast-in {
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes dbox-toast-out {
        to {
          opacity: 0;
          transform: translateY(8px);
        }
      }

      @media (max-width: 600px) {
        .dbox-toast-container {
          left: 10px;
          right: 10px;
          width: auto;
          bottom: 10px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureContainer() {
    ensureStyles();
    let container = document.getElementById(CONTAINER_ID);
    if (container) {
      return container;
    }

    container = document.createElement('div');
    container.id = CONTAINER_ID;
    container.className = 'dbox-toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
    return container;
  }

  function showToast(message, options = {}) {
    const text = String(message || '').trim();
    if (!text || typeof document === 'undefined') {
      return null;
    }

    const container = ensureContainer();
    const toast = document.createElement('div');
    const isError = Boolean(options.error);
    toast.className = `dbox-toast${isError ? ' is-error' : ''}`;
    toast.innerHTML = `
      <span class="dbox-toast-icon" aria-hidden="true">${isError ? '!' : '✓'}</span>
      <span>${text}</span>
    `;
    container.appendChild(toast);

    const timeout = Math.max(1800, Number(options.duration) || 2600);
    window.setTimeout(() => {
      toast.style.animation = 'dbox-toast-out 180ms ease-in forwards';
      window.setTimeout(() => toast.remove(), 200);
    }, timeout);

    return toast;
  }

  function setLoadingState(button, loading, labels = {}) {
    if (!button) {
      return;
    }

    const loadingLabel = labels.loading || 'Loading...';
    const normalLabel = labels.normal || button.dataset.originalLabel || button.textContent || 'Submit';

    if (!button.dataset.originalLabel) {
      button.dataset.originalLabel = normalLabel;
    }

    button.disabled = Boolean(loading);
    button.setAttribute('aria-busy', String(Boolean(loading)));
    button.innerHTML = loading ? `<span class="btn-spinner" aria-hidden="true"></span> ${loadingLabel}` : button.dataset.originalLabel;
  }

  function loadingButtonStyles() {
    if (document.getElementById('dbox-loading-button-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'dbox-loading-button-styles';
    style.textContent = `
      .btn-spinner {
        display: inline-block;
        width: 14px;
        height: 14px;
        margin-right: 8px;
        border-radius: 999px;
        border: 2px solid rgba(255,255,255,0.45);
        border-top-color: #ffffff;
        animation: dbox-spin 0.7s linear infinite;
        vertical-align: -2px;
      }

      @keyframes dbox-spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  loadingButtonStyles();

  window.dboxFeedback = {
    toast: showToast,
    setLoading: setLoadingState
  };

  window.dboxToast = showToast;
  window.dboxSetLoading = setLoadingState;
})();