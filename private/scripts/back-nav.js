(function initBackNavigationButton() {
  function getFallbackPath() {
    var path = window.location.pathname || '';
    var publicPaths = ['/', '/index.html', '/login.html', '/signup.html'];
    return publicPaths.includes(path) ? '/' : '/home';
  }

  function buildButton() {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'back-nav-btn';
    button.setAttribute('aria-label', 'Go back');
    button.setAttribute('title', 'Go back');
    button.innerHTML = '<span class="back-nav-glyph" aria-hidden="true">\u276E</span>';
    return button;
  }

  function ensureBackButton() {
    if (document.body && document.body.dataset.hideBackNav === 'true') {
      return;
    }

    var button = document.querySelector('.back-nav-btn');
    if (!button) {
      button = buildButton();
      document.body.appendChild(button);
    }

    if (button.dataset.boundBackNav === 'true') {
      return;
    }

    button.dataset.boundBackNav = 'true';
    button.addEventListener('click', function () {
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
      window.location.href = getFallbackPath();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureBackButton);
    return;
  }

  ensureBackButton();
})();