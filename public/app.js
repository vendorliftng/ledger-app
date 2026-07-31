/* Ledger — mobile field app (Marketer role).
   Talks to /api via shared.js's apiCall() — load shared.js, db.js and
   outbox.js before this file. Owner/Manager/Storekeeper never see this
   screen; they're sent to admin.html instead (see doLogin() and the
   already-signed-in check below).

   Offline: getBootstrap's reference data (products/locations/marketers/
   batches) is cached in IndexedDB so forms still populate with no signal.
   The six submit* actions queue in IndexedDB and send themselves via
   outbox.js — immediately if online, via Background Sync (Android) or the
   foreground online/visibility fallback below (iOS, and as a safety net
   everywhere) once reconnected. login/getBootstrap/saveReconciliation need
   a live connection and are not queued. */

var DATA = null;

/* Labels for the tiles this build knows how to render. Server also returns
   'history', 'auditlog', 'users' in allowedActions for some roles — those
   screens don't exist yet, so renderTiles() below only shows a tile for an
   action that's both allowed AND has a label here. */
var LABELS = {
  stockin: ['01','Receive stock'],
  loadout: ['02','Issue to marketer'],
  sale:    ['03','Record sale'],
  return:  ['04','Record return'],
  cash:    ['05','Remit cash'],
  crates:  ['06','Crates'],
  recon:   ['07','Reconciliation']
};

/* ── Service worker + offline sync plumbing ───────────────── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}

function registerBackgroundSyncIfAvailable() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then(function (reg) {
      return reg.sync.register('ledger-outbox-sync');
    }).catch(function () {}); // best-effort — the foreground fallback below covers the rest
  }
}

// iOS Safari has no Background Sync, so this foreground fallback is the
// real mechanism there — and it's a useful safety net on Android too.
window.addEventListener('online', function () { drainOutbox().then(refreshPendingCount); });
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible' && navigator.onLine) drainOutbox().then(refreshPendingCount);
});
setInterval(function () {
  if (navigator.onLine) drainOutbox().then(refreshPendingCount);
}, 60000);

function refreshPendingCount() {
  var el = document.getElementById('pendingPill');
  if (!el) return;
  outboxAll().then(function (items) {
    if (!items.length) { el.style.display = 'none'; return; }
    el.style.display = 'inline-flex';
    el.textContent = items.length + (items.length === 1 ? ' entry' : ' entries') + ' waiting to send';
  }).catch(function () {});
}

/* ── Login ─────────────────────────────────────────────── */
document.getElementById('loginBtn').onclick = doLogin;
document.getElementById('pin').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') doLogin();
});

// Already signed in from a previous visit — Marketer goes straight to the
// mobile app, everyone else belongs on the admin dashboard instead.
if (TOKEN && USER) {
  if (USER.role !== 'Marketer') { window.location.href = 'admin.html'; }
  else { showApp(); loadData(); }
}

function doLogin() {
  var pin = document.getElementById('pin').value;
  if (!pin) { showErr('Enter your PIN to continue.'); return; }
  setBusy('loginBtn', true, 'Checking…');
  apiCall('login', null, { pin: pin })
    .then(function (res) {
      setBusy('loginBtn', false, 'Sign in');
      if (!res.ok) { showErr(res.message); return; }
      setSession(res.token, res.user);
      if (USER.role !== 'Marketer') { window.location.href = 'admin.html'; return; }
      // Anything that was stuck waiting for a fresh login gets retried now.
      retryOutboxWithToken(TOKEN).then(refreshPendingCount);
      showApp();
      loadData();
    })
    .catch(function () {
      setBusy('loginBtn', false, 'Sign in');
      showErr('Could not reach the server. Check your connection and try again.');
    });
}

function showApp() {
  document.getElementById('login').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('uName').textContent = USER.name;
  document.getElementById('uRole').textContent = USER.role.toUpperCase();
}

function doLogout() {
  clearSession();
  DATA = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('login').style.display = 'flex';
  document.getElementById('pin').value = '';
  showErr('');
}

function showErr(msg) { document.getElementById('loginErr').textContent = msg; }

/* ── Bootstrap ─────────────────────────────────────────── */
function loadData() {
  apiCall('getBootstrap', TOKEN, {})
    .then(function (d) {
      if (isAuthError(d)) { toast(d.message, true); doLogout(); return; }
      DATA = d;
      saveReferenceData(d).catch(function () {});
      hideOfflineBanner();
      renderTiles();
      renderSummary(); // also refreshes the pending-count pill
      fillSelects();
      setToday();
    })
    .catch(function () {
      loadReferenceData().then(function (cached) {
        if (!cached) { toast('Could not load data. Check your connection and retry.', true); return; }
        DATA = cached.data;
        showOfflineBanner(cached.savedAt);
        renderTiles();
        renderSummary();
        fillSelects();
        setToday();
      }).catch(function () {
        toast('Could not load data. Check your connection and retry.', true);
      });
    });
}

function showOfflineBanner(savedAt) {
  var el = document.getElementById('offlineBanner');
  if (!el) return;
  var when = savedAt
    ? new Date(savedAt).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
    : 'earlier';
  el.textContent = 'Offline — showing data saved at ' + when;
  el.style.display = 'block';
}

function hideOfflineBanner() {
  var el = document.getElementById('offlineBanner');
  if (el) el.style.display = 'none';
}

function renderTiles() {
  var allowed = (DATA.allowedActions || []).filter(function (a) { return LABELS[a]; });
  document.getElementById('tiles').innerHTML = allowed.map(function (a) {
    return '<div class="tile" onclick="go(\'' + a + '\')">' +
             '<div class="n">' + LABELS[a][0] + '</div>' +
             '<div class="t">' + LABELS[a][1] + '</div>' +
           '</div>';
  }).join('');
}

function renderSummary() {
  var s = DATA.summary;
  document.getElementById('mSales').textContent  = money(s.salesValue);
  document.getElementById('mCash').textContent   = money(s.cashIn);
  document.getElementById('mCredit').textContent = money(s.credit);
  document.getElementById('mExp').textContent    = s.expiring + (s.expiring === 1 ? ' batch' : ' batches');
  document.getElementById('todayLabel').textContent =
    new Date().toLocaleDateString(undefined, { weekday:'long', day:'numeric', month:'long' });

  var flagged = (s.recon || []).filter(function (r) { return r.status === 'FLAGGED'; });
  document.getElementById('reconHome').innerHTML =
    (flagged.length
      ? '<div class="eyebrow" style="margin:24px 0 8px">Needs attention</div>' + flagged.map(gauge).join('')
      : '') +
    '<span class="pending-pill" id="pendingPill" style="display:none"></span>';
  refreshPendingCount();
}

/* ── Navigation ────────────────────────────────────────── */
function go(screen) {
  var all = document.querySelectorAll('.screen');
  for (var i = 0; i < all.length; i++) all[i].classList.remove('on');
  document.getElementById('s-' + screen).classList.add('on');
  window.scrollTo(0, 0);
  if (screen === 'recon') renderRecon();
  if (screen === 'home') refresh();
}

function refresh() {
  apiCall('getBootstrap', TOKEN, {})
    .then(function (d) {
      if (isAuthError(d)) { toast(d.message, true); doLogout(); return; }
      DATA = d;
      saveReferenceData(d).catch(function () {});
      hideOfflineBanner();
      renderSummary();
    })
    .catch(function () {
      // Already on cached data, or the user is just mid-session offline —
      // don't nag on every silent refresh, the banner already said so once.
      refreshPendingCount();
    });
}

function renderRecon() {
  var rows = DATA.summary.recon || [];
  document.getElementById('reconList').innerHTML = rows.length
    ? rows.map(gauge).join('')
    : '<div class="empty">Nothing issued today yet. Reconciliation appears once stock goes out.</div>';
}

function doSaveRecon() {
  if (!navigator.onLine) {
    toast('Reconciliation needs a connection — try again once you have signal.', true);
    return;
  }
  setBusy('saveRecon', true, 'Saving…');
  apiCall('saveReconciliation', TOKEN, {})
    .then(function (res) {
      setBusy('saveRecon', false, "Save today's reconciliation");
      if (isAuthError(res)) { toast(res.message, true); doLogout(); return; }
      toast(res.message, !res.ok);
    })
    .catch(function () {
      setBusy('saveRecon', false, "Save today's reconciliation");
      toast('Not saved — no connection.', true);
    });
}

/* ── Populate selects ──────────────────────────────────── */
function fillSelects() {
  var prodOpts = DATA.products.map(function (p) {
    return '<option value="' + p.sku + '" data-price="' + p.price + '" data-cost="' + p.cost + '">' + p.name + '</option>';
  }).join('');

  var sellPoints = DATA.locations.filter(function (l) {
    return l.type === 'Access Point' || l.type === 'Axis';
  });
  var locOpts = sellPoints.map(function (l) { return '<option>' + l.name + '</option>'; }).join('');
  var destOpts = DATA.locations.filter(function (l) { return l.type !== 'Cold Room'; })
    .map(function (l) { return '<option>' + l.name + '</option>'; }).join('');
  var mktOpts = DATA.marketers.map(function (m) { return '<option>' + m.name + '</option>'; }).join('');
  var batchOpts = '<option value="">— any —</option>' + DATA.batches.map(function (b) {
    return '<option value="' + b.batch + '">' + b.batch + ' · ' + b.sku + ' · exp ' + b.expiry + '</option>';
  }).join('');

  set('si_sku', prodOpts); set('lo_sku', prodOpts); set('sa_sku', prodOpts); set('rt_sku', prodOpts);
  set('lo_mkt', mktOpts);  set('sa_mkt', mktOpts);  set('rt_mkt', mktOpts);
  set('ca_mkt', mktOpts);  set('cr_mkt', mktOpts);
  set('lo_dest', destOpts);
  set('sa_loc', locOpts);  set('cr_loc', locOpts);
  set('lo_batch', batchOpts); set('rt_batch', batchOpts);

  // A marketer only ever files their own records — lock and hide the picker
  if (USER.role === 'Marketer' && USER.marketer) {
    ['sa','rt','ca','cr'].forEach(function (p) {
      var sel = document.getElementById(p + '_mkt');
      if (sel) { sel.value = USER.marketer; }
      var wrap = document.getElementById(p + '_mktWrap');
      if (wrap) wrap.style.display = 'none';
    });
  }

  // Auto-fill unit price from the product, and live-total the sale
  var skuSel = document.getElementById('sa_sku');
  var priceIn = document.getElementById('sa_price');
  var qtyIn = document.getElementById('sa_qty');
  function syncPrice() {
    var opt = skuSel.options[skuSel.selectedIndex];
    if (opt && !priceIn.value) priceIn.value = opt.getAttribute('data-price') || '';
    syncTotal();
  }
  function syncTotal() {
    var t = (Number(qtyIn.value) || 0) * (Number(priceIn.value) || 0);
    document.getElementById('sa_total').textContent = money(t);
  }
  skuSel.onchange = function () { priceIn.value = ''; syncPrice(); };
  qtyIn.oninput = syncTotal;
  priceIn.oninput = syncTotal;
  syncPrice();

  // Unit cost auto-fills on receipt (blank for roles that don't see cost)
  var siSku = document.getElementById('si_sku');
  siSku.onchange = function () {
    var opt = siSku.options[siSku.selectedIndex];
    document.getElementById('si_cost').value = opt ? (opt.getAttribute('data-cost') || '') : '';
  };
  siSku.onchange();
}

function set(id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; }

function setToday() {
  var t = new Date().toISOString().slice(0, 10);
  ['si_date','lo_date','sa_date','rt_date','ca_date','cr_date','si_prod'].forEach(function (id) {
    var el = document.getElementById(id); if (el) el.value = t;
  });
}

/* ── Collectors ────────────────────────────────────────── */
function v(id) { var el = document.getElementById(id); return el ? el.value : ''; }

function collectStockIn() {
  if (!v('si_sku') || !v('si_qty') || !v('si_batch')) return err('Product, batch and quantity are required.');
  return { date:v('si_date'), sku:v('si_sku'), batch:v('si_batch'), qty:v('si_qty'),
           production:v('si_prod'), expiry:v('si_exp'), unitCost:v('si_cost'), source:v('si_src') };
}
function collectLoadOut() {
  if (!v('lo_mkt') || !v('lo_sku') || !v('lo_qty')) return err('Marketer, product and quantity are required.');
  return { date:v('lo_date'), marketer:v('lo_mkt'), destination:v('lo_dest'), sku:v('lo_sku'),
           batch:v('lo_batch'), qty:v('lo_qty'), crates:v('lo_crates') };
}
function collectSale() {
  var m = USER.role === 'Marketer' ? USER.marketer : v('sa_mkt');
  if (!m || !v('sa_sku') || !v('sa_qty') || !v('sa_price')) return err('Product, quantity and price are required.');
  return { date:v('sa_date'), marketer:m, location:v('sa_loc'), customer:v('sa_cust'),
           sku:v('sa_sku'), qty:v('sa_qty'), price:v('sa_price'), payment:v('sa_pay') };
}
function collectReturn() {
  var m = USER.role === 'Marketer' ? USER.marketer : v('rt_mkt');
  if (!m || !v('rt_sku') || !v('rt_qty')) return err('Product and quantity are required.');
  return { date:v('rt_date'), marketer:m, sku:v('rt_sku'), batch:v('rt_batch'),
           qty:v('rt_qty'), reason:v('rt_reason'), condition:v('rt_cond') };
}
function collectCash() {
  var m = USER.role === 'Marketer' ? USER.marketer : v('ca_mkt');
  if (!m || !v('ca_amt')) return err('Enter the amount remitted.');
  return { date:v('ca_date'), marketer:m, amount:v('ca_amt'), notes:v('ca_note') };
}
function collectCrates() {
  var m = USER.role === 'Marketer' ? USER.marketer : v('cr_mkt');
  if (!m) return err('Select a marketer.');
  return { date:v('cr_date'), marketer:m, location:v('cr_loc'), out:v('cr_out'), back:v('cr_back') };
}

function err(msg) { toast(msg, true); return null; }

/* ── Submit ────────────────────────────────────────────── */
function submit(fn, collector) {
  var payload = collector();
  if (!payload) return;
  payload.clientRef = uuid(); // lets a retried/duplicated send be recognised and skipped, online or off
  var btn = event.target;
  var original = btn.textContent;
  btn.disabled = true; btn.textContent = 'Saving…';

  enqueueSubmission(fn, payload, TOKEN).then(function (result) {
    btn.disabled = false; btn.textContent = original;
    refreshPendingCount();

    if (result.sent) {
      toast(result.message || 'Saved.', false);
      clearForm(btn);
      refresh();
    } else if (result.reason === 'offline') {
      toast('Queued — will send on its own once you have signal.', 'warn');
      clearForm(btn);
      registerBackgroundSyncIfAvailable();
    } else if (result.reason === 'auth') {
      toast('Saved on this phone — sign in again to send it to the office.', 'warn');
      clearForm(btn);
    } else {
      // A definitive rejection (a real business-rule error) — don't clear
      // the form, so the mistake can be fixed and resubmitted.
      toast(result.message || 'Could not save.', true);
    }
  });
}

function clearForm(btn) {
  var card = btn.closest('.card');
  if (!card) return;
  card.querySelectorAll('input').forEach(function (i) {
    if (i.type !== 'date' && i.id !== 'si_src') i.value = '';
  });
  var total = document.getElementById('sa_total');
  if (total) total.textContent = money(0);
}

/* ── Utils ─────────────────────────────────────────────── */
function setBusy(id, busy, text) {
  var b = document.getElementById(id);
  if (!b) return;
  b.disabled = busy; b.textContent = text;
}
