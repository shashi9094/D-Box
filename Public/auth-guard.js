document.documentElement.style.visibility = 'hidden';

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

ensureAuthenticated();
window.addEventListener('pageshow', ensureAuthenticated);
window.addEventListener('focus', ensureAuthenticated);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    ensureAuthenticated();
  }
});
setInterval(ensureAuthenticated, 5000);
