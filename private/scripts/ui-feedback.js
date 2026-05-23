(function () {
  if (window.dboxFeedback) {
    return;
  }

  const STYLE_ID = 'dbox-feedback-styles';
  const CONTAINER_ID = 'dbox-toast-container';

  const TOAST_VARIANTS = {
    success: {
      accent: '#10B981',
      glow: 'rgba(16, 185, 129, 0.28)',
      background: 'rgba(16,185,129,0.15)',
      border: '#10B981',
      text: '#ECFDF5',
      icon: 'fa-circle-check',
      title: 'Success'
    },
    error: {
      accent: '#EF4444',
      glow: 'rgba(239, 68, 68, 0.28)',
      background: 'rgba(239,68,68,0.15)',
      border: '#EF4444',
      text: '#FEF2F2',
      icon: 'fa-circle-exclamation',
      title: 'Error'
    },
    warning: {
      accent: '#F59E0B',
      glow: 'rgba(245, 158, 11, 0.28)',
      background: 'rgba(245,158,11,0.16)',
      border: '#F59E0B',
      text: '#FFFBEB',
      icon: 'fa-triangle-exclamation',
      title: 'Warning'
    },
    info: {
      accent: '#6366F1',
      glow: 'rgba(99, 102, 241, 0.28)',
      background: 'rgba(99,102,241,0.15)',
      border: '#6366F1',
      text: '#EEF2FF',
      icon: 'fa-circle-info',
      title: 'Info'
    }
  };

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .dbox-toast-container {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 2147483647;
        display: grid;
        gap: 12px;
        width: min(92vw, 420px);
        pointer-events: none;
      }

      .dbox-toast {
        --toast-accent: #6366F1;
        --toast-glow: rgba(99, 102, 241, 0.28);
        --toast-bg: rgba(99,102,241,0.15);
        --toast-border: #6366F1;
        --toast-text: #EEF2FF;
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 12px;
        align-items: start;
        padding: 14px 16px;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,0.08);
        border-left: 4px solid var(--toast-border);
        background:
          linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)),
          var(--toast-bg);
        color: var(--toast-text);
        box-shadow:
          0 16px 40px rgba(2, 6, 23, 0.45),
          0 0 0 1px rgba(255,255,255,0.04) inset,
          0 0 28px var(--toast-glow);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        font-size: 14px;
        line-height: 1.45;
        opacity: 0;
        transform: translateY(12px) scale(0.98);
        animation: dbox-toast-in 220ms cubic-bezier(.2,.8,.2,1) forwards;
      }

      .dbox-toast.is-success {
        --toast-accent: ${TOAST_VARIANTS.success.accent};
        --toast-glow: ${TOAST_VARIANTS.success.glow};
        --toast-bg: ${TOAST_VARIANTS.success.background};
        --toast-border: ${TOAST_VARIANTS.success.border};
        --toast-text: ${TOAST_VARIANTS.success.text};
      }

      .dbox-toast.is-error {
        --toast-accent: ${TOAST_VARIANTS.error.accent};
        --toast-glow: ${TOAST_VARIANTS.error.glow};
        --toast-bg: ${TOAST_VARIANTS.error.background};
        --toast-border: ${TOAST_VARIANTS.error.border};
        --toast-text: ${TOAST_VARIANTS.error.text};
      }

      .dbox-toast.is-warning {
        --toast-accent: ${TOAST_VARIANTS.warning.accent};
        --toast-glow: ${TOAST_VARIANTS.warning.glow};
        --toast-bg: ${TOAST_VARIANTS.warning.background};
        --toast-border: ${TOAST_VARIANTS.warning.border};
        --toast-text: ${TOAST_VARIANTS.warning.text};
      }

      .dbox-toast.is-info {
        --toast-accent: ${TOAST_VARIANTS.info.accent};
        --toast-glow: ${TOAST_VARIANTS.info.glow};
        --toast-bg: ${TOAST_VARIANTS.info.background};
        --toast-border: ${TOAST_VARIANTS.info.border};
        --toast-text: ${TOAST_VARIANTS.info.text};
      }

      .dbox-toast-icon-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        flex: 0 0 34px;
        border-radius: 999px;
        background: rgba(255,255,255,0.08);
        color: var(--toast-accent);
        box-shadow: 0 0 0 1px rgba(255,255,255,0.06) inset;
      }

      .dbox-toast-icon-wrap i {
        font-size: 16px;
      }

      .dbox-toast-body {
        min-width: 0;
        display: grid;
        gap: 3px;
      }

      .dbox-toast-title {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgba(255,255,255,0.82);
      }

      .dbox-toast-message {
        font-size: 14px;
        font-weight: 500;
        color: var(--toast-text);
        word-break: break-word;
      }

      .dbox-toast-action {
        margin-left: 8px;
        border: 0;
        background: transparent;
        color: rgba(255,255,255,0.82);
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        opacity: 0.85;
      }

      .dbox-toast-action:hover,
      .dbox-toast-action:focus-visible {
        opacity: 1;
      }

      @keyframes dbox-toast-in {
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @keyframes dbox-toast-out {
        to {
          opacity: 0;
          transform: translateY(12px) scale(0.98);
        }
      }

      @media (max-width: 600px) {
        .dbox-toast-container {
          left: 10px;
          right: 10px;
          width: auto;
          bottom: 10px;
        }

        .dbox-toast {
          padding: 13px 14px;
          border-radius: 14px;
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

  function normalizeToastOptions(options) {
    if (typeof options === 'string') {
      return { type: options };
    }

    return options && typeof options === 'object' ? options : {};
  }

  function showToast(message, options = {}) {
    const toastOptions = normalizeToastOptions(options);
    const text = String(message || toastOptions.message || '').trim();
    if (!text || typeof document === 'undefined') {
      return null;
    }

    const container = ensureContainer();
    const toast = document.createElement('div');
    const type = String(toastOptions.type || (toastOptions.error ? 'error' : 'success')).toLowerCase();
    const variant = TOAST_VARIANTS[type] || TOAST_VARIANTS.info;
    const title = String(toastOptions.title || variant.title || type).trim();
    const icon = String(toastOptions.icon || variant.icon || 'fa-circle-info');
    const duration = Math.max(2200, Number(toastOptions.duration) || 3400);

    toast.className = `dbox-toast is-${TOAST_VARIANTS[type] ? type : 'info'}`;
    toast.style.setProperty('--toast-accent', variant.accent);
    toast.style.setProperty('--toast-glow', variant.glow);
    toast.style.setProperty('--toast-bg', variant.background);
    toast.style.setProperty('--toast-border', variant.border);
    toast.style.setProperty('--toast-text', variant.text);
    toast.setAttribute('role', 'status');

    const iconWrap = document.createElement('div');
    iconWrap.className = 'dbox-toast-icon-wrap';
    iconWrap.setAttribute('aria-hidden', 'true');
    const iconEl = document.createElement('i');
    iconEl.className = `fa-solid ${icon}`;
    iconWrap.appendChild(iconEl);

    const body = document.createElement('div');
    body.className = 'dbox-toast-body';

    const titleEl = document.createElement('div');
    titleEl.className = 'dbox-toast-title';
    titleEl.textContent = title;

    const messageEl = document.createElement('div');
    messageEl.className = 'dbox-toast-message';
    messageEl.textContent = text;

    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'dbox-toast-action';
    dismiss.setAttribute('aria-label', 'Dismiss notification');
    dismiss.textContent = '×';

    body.appendChild(titleEl);
    body.appendChild(messageEl);

    toast.appendChild(iconWrap);
    toast.appendChild(body);
    toast.appendChild(dismiss);
    container.appendChild(toast);

    dismiss.addEventListener('click', () => {
      toast.style.animation = 'dbox-toast-out 180ms ease-in forwards';
      window.setTimeout(() => toast.remove(), 200);
    });

    window.setTimeout(() => {
      toast.style.animation = 'dbox-toast-out 180ms ease-in forwards';
      window.setTimeout(() => toast.remove(), 200);
    }, duration);

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