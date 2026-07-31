/* Ledger admin — bootstrap. Guards the page (Owner/Manager/Storekeeper
   only), loads data, builds the sidebar from whatever screens the role is
   allowed to see, and hands off to router.js for navigation. */

var DATA = null;

if (!TOKEN || !USER || USER.role === 'Marketer') {
  window.location.href = 'index.html';
}

// The service worker exists for the mobile app's offline field capture
// (registered in app.js) — admin is a desk tool with no offline need. But
// a service worker's scope is the whole origin, so one registered earlier
// from a mobile-app visit on this same browser/device silently ends up
// "in charge" of this page too, including the Sign out navigation below.
// That mismatch — this page never asked for it, has no way to know its
// version, and can't be sure it's the latest build — is what's actually
// behind "sign out goes to a broken page": get rid of it here so every
// request this page makes, sign-out included, always goes straight to the
// network instead of through code this page has no visibility into.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function (regs) {
    regs.forEach(function (r) { r.unregister(); });
  }).catch(function () {});
}

document.getElementById('aName').textContent = USER ? USER.name : '';
document.getElementById('aRole').textContent = USER ? USER.role.toUpperCase() : '';
document.getElementById('screenDate').textContent =
  new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

function doAdminLogout() {
  clearSession();
  window.location.href = 'index.html';
}

/* ── Mobile sidebar drawer ─────────────────────────────────── */
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarBackdrop').classList.add('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarBackdrop').classList.remove('open');
}
document.getElementById('menuToggle').addEventListener('click', openSidebar);
document.getElementById('sidebarBackdrop').addEventListener('click', closeSidebar);

function loadAdmin() {
  apiCall('getBootstrap', TOKEN, {})
    .then(function (d) {
      if (isAuthError(d)) { window.location.href = 'index.html'; return; }
      DATA = d;
      // Same 'Business Name' Settings row the login screen reads (via
      // getBranding) — getBootstrap already carries it for any signed-in
      // role, so no extra call is needed here.
      if (DATA.settings && DATA.settings.business) {
        document.getElementById('sidebarBrand').textContent = DATA.settings.business;
        document.title = DATA.settings.business + ' — Admin';
      }
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
      closeSidebar(); // no-op on desktop where it was never "open"
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
