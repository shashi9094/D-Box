let isInternalNavTransition = false;
try {
  isInternalNavTransition = sessionStorage.getItem('dbox.nav.pending') === '1';
} catch (_) {
  isInternalNavTransition = false;
}

document.documentElement.style.visibility = 'visible';

let authCheckInFlight = null;
let lastAuthCheckAt = 0;

function applySavedTheme() {
  try {
    const raw = localStorage.getItem('dbox.settings');
    const settings = raw ? JSON.parse(raw) : {};
    const hasValidTheme = ['dark', 'light', 'neon'].includes(settings?.theme);
    const theme = hasValidTheme ? settings.theme : 'dark';

    if (!hasValidTheme) {
      localStorage.setItem('dbox.settings', JSON.stringify({
        ...(settings && typeof settings === 'object' ? settings : {}),
        theme: 'dark'
      }));
    }

    document.body.classList.remove('theme-dark', 'theme-light', 'theme-neon');
    document.body.classList.add(`theme-${theme}`);
  } catch (_) {
    localStorage.setItem('dbox.settings', JSON.stringify({ theme: 'dark' }));
    document.body.classList.remove('theme-light', 'theme-neon');
    document.body.classList.add('theme-dark');
  }
}

async function ensureAuthenticated(options = {}) {
  const force = Boolean(options.force);
  const now = Date.now();

  if (authCheckInFlight) {
    return authCheckInFlight;
  }

  if (!force && now - lastAuthCheckAt < 1000) {
    return null;
  }

  lastAuthCheckAt = now;
  authCheckInFlight = (async () => {
  try {
    const res = await fetch('/api/auth/session', {
      credentials: 'same-origin',
      cache: 'no-store',
    });

    if (!res.ok) {
      window.location.replace('/login.html');
      return;
    }

    const data = await res.json();

    if (!data.authenticated) {
      const reason = data?.reason ? `?reason=${encodeURIComponent(data.reason)}` : '';
      window.location.replace(`/login.html${reason}`);
      return;
    }

    try {
      sessionStorage.removeItem('dbox.nav.pending');
    } catch (_) {
      // ignore storage failures
    }
  } catch (error) {
    window.location.replace('/login.html');
  } finally {
    authCheckInFlight = null;
  }
  })();

  return authCheckInFlight;
}

applySavedTheme();
ensureAuthenticated();
window.addEventListener('pageshow', () => ensureAuthenticated({ force: true }));
window.addEventListener('focus', () => ensureAuthenticated());
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    applySavedTheme();
    ensureAuthenticated();
  }
});
window.addEventListener('storage', (event) => {
  if (event.key === 'dbox.settings') {
    applySavedTheme();
  }
});
setInterval(() => ensureAuthenticated(), 5000);