/* Ledger — shared session/API logic, used by both the mobile app
   (index.html, Marketer role) and the admin dashboard (admin.html,
   Owner/Manager/Storekeeper). Load this before app.js or admin.js —
   both assume TOKEN/USER/apiCall/uuid/money/isAuthError already exist. */

var TOKEN = localStorage.getItem('ledger_token') || null;
var USER = null;
try { USER = JSON.parse(localStorage.getItem('ledger_user') || 'null'); } catch (e) { USER = null; }

function apiCall(fn, token, payload) {
  return fetch('/api', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ fn: fn, token: token, payload: payload || {} })
  }).then(function (res) { return res.json(); });
}

function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function money(n) {
  return (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/** A session-related rejection (expired/invalid token) — caller should send the user back to login. */
function isAuthError(res) {
  return res && res.ok === false && /session|signed in/i.test(res.message || '');
}

var toastTimer;
function toast(msg, bad) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast up' + (bad ? ' bad' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.className = 'toast' + (bad ? ' bad' : ''); }, 3800);
}

/** Basic HTML-escaping for interpolating user-entered text into markup. */
function escapeHtml(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function setSession(token, user) {
  TOKEN = token; USER = user;
  localStorage.setItem('ledger_token', TOKEN);
  localStorage.setItem('ledger_user', JSON.stringify(USER));
}

function clearSession() {
  if (TOKEN) apiCall('logout', TOKEN, {}).catch(function () {});
  TOKEN = null; USER = null;
  localStorage.removeItem('ledger_token');
  localStorage.removeItem('ledger_user');
}

/* ── SIGNATURE: the variance gauge ─────────────────────────
   Used by both the mobile app's home/reconciliation screens and the
   admin dashboard's Overview/Reconciliation screens — one rendering,
   two layouts around it. */
function gauge(r) {
  var flag = r.status === 'FLAGGED';
  var gapUnits = r.stockVariance;
  var gapCash  = r.cashVariance;
  var headline = gapUnits !== 0 ? (gapUnits > 0 ? '−' + gapUnits : '+' + Math.abs(gapUnits)) : '0';

  return '<div class="gauge ' + (flag ? 'flag' : '') + '">' +
    '<div class="band"><span class="nm">' + r.marketer + '</span>' +
      '<span class="st">' + (flag ? 'UNACCOUNTED' : 'RECONCILED') + '</span></div>' +
    '<div class="readout">' +
      '<div class="flow">' +
        '<div><div class="k">Issued</div><div class="v">' + r.issued + '</div></div>' +
        '<div><div class="k">Sold</div><div class="v">' + r.sold + '</div></div>' +
        '<div><div class="k">Returned</div><div class="v">' + r.returned + '</div></div>' +
      '</div>' +
      '<div class="gap">' +
        '<div class="k">Units</div>' +
        '<div class="v">' + headline + '</div>' +
        '<div class="sub">' + (gapCash !== 0 ? 'cash ' + money(Math.abs(gapCash)) + (gapCash > 0 ? ' short' : ' over') : 'cash clear') + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="ticks"></div>' +
  '</div>';
}
