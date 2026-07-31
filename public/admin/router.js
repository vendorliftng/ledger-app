/* Ledger admin — tiny hash-based screen router.
   Each screens/*.js file calls registerScreen() once at load time; admin.js
   builds the sidebar from whichever registered screens the logged-in role
   is actually allowed to see, then hands off navigation to this file. */

var ROUTER_SCREENS = {}; // key -> { code, label, permission, init }

/**
 * @param key         hash fragment, e.g. 'marketers'
 * @param code        two-digit sidebar code, e.g. '05'
 * @param label       sidebar label, e.g. 'Marketers'
 * @param permission  a value that must appear in DATA.allowedActions to see
 *                     this screen, or null if every admin role sees it
 * @param initFn      function(container, DATA) — renders the screen
 */
function registerScreen(key, code, label, permission, initFn) {
  ROUTER_SCREENS[key] = { code: code, label: label, permission: permission, init: initFn };
}

function allowedScreens(DATA) {
  var allowed = (DATA && DATA.allowedActions) || [];
  return Object.keys(ROUTER_SCREENS).filter(function (key) {
    var s = ROUTER_SCREENS[key];
    return s.permission === null || allowed.indexOf(s.permission) !== -1;
  });
}

function currentScreenKey() {
  return (window.location.hash || '#overview').replace('#', '');
}

function navigateTo(key, DATA) {
  var s = ROUTER_SCREENS[key];
  if (!s) { key = 'overview'; s = ROUTER_SCREENS.overview; }

  if (window.location.hash !== '#' + key) window.location.hash = key;

  document.getElementById('screenTitle').textContent = s.label;
  document.querySelectorAll('.sidebar-nav a').forEach(function (a) {
    a.classList.toggle('active', a.getAttribute('data-key') === key);
  });

  var content = document.getElementById('content');
  content.innerHTML = '';
  s.init(content, DATA);
}
