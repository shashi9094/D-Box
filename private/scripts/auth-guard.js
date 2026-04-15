document.documentElement.style.visibility = 'hidden';

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

async function ensureAuthenticated() {
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

    document.documentElement.style.visibility = 'visible';
  } catch (error) {
    window.location.replace('/login.html');
  }
}

applySavedTheme();
ensureAuthenticated();
window.addEventListener('pageshow', ensureAuthenticated);
window.addEventListener('focus', ensureAuthenticated);
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
setInterval(ensureAuthenticated, 5000);