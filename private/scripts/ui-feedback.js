(function () {
  if (window.dboxFeedback) {
    return;
  }

  const STYLE_ID = 'dbox-feedback-styles';
  const CONTAINER_ID = 'dbox-toast-container';
  const CONFIRM_ID = 'dbox-confirm-modal';
  let confirmState = null;

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

      .dbox-confirm {
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(3, 5, 18, 0.62);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition: opacity 180ms ease, visibility 180ms ease;
      }

      .dbox-confirm.is-open {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
      }

      .dbox-confirm-card {
        width: min(94vw, 460px);
        border-radius: 18px;
        padding: 18px;
        border: 1px solid rgba(255,255,255,0.12);
        background: linear-gradient(155deg, rgba(18, 22, 44, 0.92), rgba(17, 10, 35, 0.92));
        box-shadow: 0 22px 50px rgba(0,0,0,0.45), 0 0 34px rgba(99,102,241,0.24);
        color: #eef2ff;
        transform: translateY(14px) scale(0.97);
        transition: transform 180ms cubic-bezier(.2,.8,.2,1), opacity 180ms ease;
        opacity: 0;
      }

      .dbox-confirm.is-open .dbox-confirm-card {
        transform: translateY(0) scale(1);
        opacity: 1;
      }

      .dbox-confirm-head {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .dbox-confirm-icon {
        width: 36px;
        height: 36px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fbbf24;
        background: rgba(245, 158, 11, 0.18);
        box-shadow: 0 0 0 1px rgba(255,255,255,0.08) inset;
      }

      .dbox-confirm.is-danger .dbox-confirm-icon {
        color: #f87171;
        background: rgba(239, 68, 68, 0.2);
      }

      .dbox-confirm-title {
        margin: 0;
        font-size: 18px;
        font-weight: 700;
        color: #f8fafc;
      }

      .dbox-confirm-message {
        margin: 14px 0 18px;
        line-height: 1.55;
        color: #dbeafe;
        font-size: 14px;
      }

      .dbox-confirm-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }

      .dbox-confirm-btn {
        border: 1px solid rgba(255,255,255,0.18);
        background: rgba(255,255,255,0.06);
        color: #e2e8f0;
        min-width: 96px;
        border-radius: 10px;
        padding: 10px 14px;
        cursor: pointer;
        font-weight: 600;
      }

      .dbox-confirm-btn:hover,
      .dbox-confirm-btn:focus-visible {
        background: rgba(255,255,255,0.12);
      }

      .dbox-confirm-btn-danger {
        border-color: rgba(239, 68, 68, 0.6);
        background: rgba(239, 68, 68, 0.22);
        color: #fee2e2;
      }

      .dbox-confirm-btn-danger:hover,
      .dbox-confirm-btn-danger:focus-visible {
        background: rgba(239, 68, 68, 0.34);
      }

      .dbox-route-curtain {
        position: fixed;
        inset: 0;
        z-index: 2147483645;
        pointer-events: none;
        background: radial-gradient(circle at top, rgba(19, 26, 60, 0.35), rgba(2, 4, 14, 0.75));
        opacity: 0;
        transition: opacity 160ms ease;
      }

      html.dbox-route-leaving .dbox-route-curtain {
        opacity: 1;
      }

      html.dbox-route-entering .dbox-route-curtain {
        opacity: 1;
      }

      html.dbox-route-entering .dbox-route-curtain.fade-out {
        opacity: 0;
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

  function ensureRouteCurtain() {
    ensureStyles();
    let curtain = document.getElementById('dbox-route-curtain');
    if (curtain) {
      return curtain;
    }

    curtain = document.createElement('div');
    curtain.id = 'dbox-route-curtain';
    curtain.className = 'dbox-route-curtain';
    document.body.appendChild(curtain);
    return curtain;
  }

  function ensureConfirmModal() {
    ensureStyles();
    let modal = document.getElementById(CONFIRM_ID);
    if (modal) {
      return modal;
    }

    modal = document.createElement('div');
    modal.id = CONFIRM_ID;
    modal.className = 'dbox-confirm';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="dbox-confirm-card" role="dialog" aria-modal="true" aria-labelledby="dbox-confirm-title">
        <div class="dbox-confirm-head">
          <div class="dbox-confirm-icon" aria-hidden="true"><i class="fa-solid fa-triangle-exclamation"></i></div>
          <h3 class="dbox-confirm-title" id="dbox-confirm-title">Confirm Action</h3>
        </div>
        <p class="dbox-confirm-message" id="dbox-confirm-message"></p>
        <div class="dbox-confirm-actions">
          <button type="button" class="dbox-confirm-btn" data-confirm-cancel>Cancel</button>
          <button type="button" class="dbox-confirm-btn dbox-confirm-btn-danger" data-confirm-ok>Delete</button>
        </div>
      </div>
    `;

    modal.addEventListener('click', (event) => {
      if (event.target === modal && confirmState) {
        confirmState.resolve(false);
        closeConfirmModal();
      }
    });

    modal.querySelector('[data-confirm-cancel]')?.addEventListener('click', () => {
      if (!confirmState) return;
      confirmState.resolve(false);
      closeConfirmModal();
    });

    modal.querySelector('[data-confirm-ok]')?.addEventListener('click', () => {
      if (!confirmState) return;
      confirmState.resolve(true);
      closeConfirmModal();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && confirmState) {
        confirmState.resolve(false);
        closeConfirmModal();
      }
    });

    document.body.appendChild(modal);
    return modal;
  }

  function closeConfirmModal() {
    const modal = document.getElementById(CONFIRM_ID);
    if (!modal) return;
    modal.classList.remove('is-open', 'is-danger');
    modal.setAttribute('aria-hidden', 'true');
    confirmState = null;
  }

  function confirmAction(options = {}) {
    const modal = ensureConfirmModal();
    const titleEl = modal.querySelector('#dbox-confirm-title');
    const msgEl = modal.querySelector('#dbox-confirm-message');
    const okBtn = modal.querySelector('[data-confirm-ok]');
    const cancelBtn = modal.querySelector('[data-confirm-cancel]');
    const iconEl = modal.querySelector('.dbox-confirm-icon i');

    const tone = String(options.tone || 'danger').toLowerCase();
    const isDanger = tone === 'danger' || tone === 'error';

    if (titleEl) {
      titleEl.textContent = String(options.title || (isDanger ? 'Delete Confirmation' : 'Confirm Action'));
    }

    if (msgEl) {
      msgEl.textContent = String(options.message || 'Are you sure you want to continue?');
    }

    if (okBtn) {
      okBtn.textContent = String(options.confirmText || (isDanger ? 'Delete' : 'Confirm'));
      okBtn.classList.toggle('dbox-confirm-btn-danger', isDanger);
    }

    if (cancelBtn) {
      cancelBtn.textContent = String(options.cancelText || 'Cancel');
    }

    if (iconEl) {
      iconEl.className = `fa-solid ${isDanger ? 'fa-trash' : 'fa-triangle-exclamation'}`;
    }

    modal.classList.toggle('is-danger', isDanger);
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');

    return new Promise((resolve) => {
      confirmState = { resolve };
      window.setTimeout(() => okBtn?.focus(), 20);
    });
  }

  function navigate(to, options = {}) {
    const target = String(to || '').trim();
    if (!target) return;

    const replace = Boolean(options.replace);
    const delay = Math.max(60, Number(options.delay) || 120);
    try {
      sessionStorage.setItem('dbox.nav.pending', '1');
    } catch (_) {
      // ignore storage failures
    }

    ensureRouteCurtain();
    document.documentElement.classList.add('dbox-route-leaving');

    window.setTimeout(() => {
      if (replace) {
        window.location.replace(target);
        return;
      }

      window.location.href = target;
    }, delay);
  }

  function applyEnterTransitionIfNeeded() {
    let hasPendingNav = false;
    try {
      hasPendingNav = sessionStorage.getItem('dbox.nav.pending') === '1';
      if (hasPendingNav) {
        sessionStorage.removeItem('dbox.nav.pending');
      }
    } catch (_) {
      hasPendingNav = false;
    }

    if (!hasPendingNav) {
      return;
    }

    const curtain = ensureRouteCurtain();
    document.documentElement.classList.add('dbox-route-entering');
    window.setTimeout(() => {
      curtain.classList.add('fade-out');
    }, 10);
    window.setTimeout(() => {
      curtain.classList.remove('fade-out');
      document.documentElement.classList.remove('dbox-route-entering', 'dbox-route-leaving');
    }, 220);
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
  applyEnterTransitionIfNeeded();

  window.dboxFeedback = {
    toast: showToast,
    setLoading: setLoadingState,
    confirm: confirmAction,
    navigate
  };

  window.dboxToast = showToast;
  window.dboxSetLoading = setLoadingState;
  window.dboxConfirm = confirmAction;
  window.dboxNavigate = navigate;
})();