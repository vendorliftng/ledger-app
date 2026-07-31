/* Ledger admin — bootstrap. Guards the page (Owner/Manager/Storekeeper
   only), loads data, builds the sidebar from whatever screens the role is
   allowed to see, and hands off to router.js for navigation. */

var DATA = null;

if (!TOKEN || !USER || USER.role === 'Marketer') {
  window.location.href = 'index.html';
}

document.getElementById('aName').textContent = USER ? USER.name : '';
document.getElementById('aRole').textContent = USER ? USER.role.toUpperCase() : '';
document.getElementById('screenDate').textContent =
  new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

function doAdminLogout() {
  clearSession();
  window.location.href = 'index.html';
}

function loadAdmin() {
  apiCall('getBootstrap', TOKEN, {})
    .then(function (d) {
      if (isAuthError(d)) { window.location.href = 'index.html'; return; }
      DATA = d;
      buildSidebar();
      goToAllowedScreen(currentScreenKey());
    })
    .catch(function () {
      document.getElementById('content').innerHTML =
        '<div class="admin-error">Could not load data. Check your connection and refresh the page.</div>';
    });
}

function buildSidebar() {
  var keys = allowedScreens(DATA);
  var nav = document.getElementById('sidebarNav');
  nav.innerHTML = keys.map(function (key) {
    var s = ROUTER_SCREENS[key];
    return '<a href="#' + key + '" data-key="' + key + '">' +
             '<span class="code">' + s.code + '</span><span class="label">' + s.label + '</span>' +
           '</a>';
  }).join('');

  nav.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      navigateTo(a.getAttribute('data-key'), DATA);
    });
  });
}

function goToAllowedScreen(key) {
  if (allowedScreens(DATA).indexOf(key) === -1) key = 'overview';
  navigateTo(key, DATA);
}

window.addEventListener('hashchange', function () {
  if (!DATA) return;
  goToAllowedScreen(currentScreenKey());
});

loadAdmin();
