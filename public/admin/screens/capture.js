/* Ledger admin — Record Entry. The six field-capture forms (Stock In, Load
   Out, Sale, Return, Cash, Crates) ported for desk use. The backend has
   always allowed Owner/Manager/Storekeeper to submit these (submitStockIn/
   submitLoadOut accept Storekeeper; submitSale/submitReturn/submitCash/
   submitCrates accept Owner/Manager) — but until this screen existed there
   was no way to actually do it from the admin dashboard, only from the
   mobile app, which is Marketer-only. Tabs shown are whichever of these six
   keys this role's DATA.allowedActions actually includes — the same source
   the mobile app's tiles use, so nothing is offered here that the server
   would reject anyway.
   Desk users aren't scoped to one marketer the way a Marketer-role login
   is, so every form here shows a Marketer picker (unlike the mobile forms,
   which hide it for that role). Not queued offline like the mobile app —
   admin is a desk tool, same assumption sw.js already documents. */

(function () {
  var TABS = [
    { key: 'stockin', label: 'Stock In', fn: 'submitStockIn', build: buildStockIn, collect: collectStockIn },
    { key: 'loadout', label: 'Load Out', fn: 'submitLoadOut', build: buildLoadOut, collect: collectLoadOut },
    { key: 'sale',    label: 'Sale',     fn: 'submitSale',    build: buildSale,    collect: collectSale },
    { key: 'return',  label: 'Return',   fn: 'submitReturn',  build: buildReturn,  collect: collectReturn },
    { key: 'cash',    label: 'Cash',     fn: 'submitCash',    build: buildCash,    collect: collectCash },
    { key: 'crates',  label: 'Crates',   fn: 'submitCrates',  build: buildCrates,  collect: collectCrates }
  ];

  registerScreen('capture', '02', 'Record Entry', null, initCapture);

  function initCapture(container, DATA) {
    var allowed = TABS.filter(function (t) { return (DATA.allowedActions || []).indexOf(t.key) !== -1; });
    if (!allowed.length) {
      container.innerHTML = '<div class="admin-empty">Your role can\'t record new entries here.</div>';
      return;
    }
    var state = { tab: allowed[0].key };
    container.innerHTML = '<div class="toolbar" id="capTabBar"></div><div id="capBody"></div>';
    renderTabBar(container, state, allowed, DATA);
    renderForm(container, state, allowed, DATA);
  }

  function renderTabBar(container, state, allowed, DATA) {
    var bar = container.querySelector('#capTabBar');
    bar.innerHTML = allowed.map(function (t) {
      return '<button type="button" class="ghost tab-btn' + (t.key === state.tab ? ' tab-btn-active' : '') +
        '" data-tab="' + t.key + '">' + escapeHtml(t.label) + '</button>';
    }).join('');
    Array.prototype.forEach.call(bar.querySelectorAll('button'), function (btn) {
      btn.addEventListener('click', function () {
        state.tab = btn.getAttribute('data-tab');
        renderTabBar(container, state, allowed, DATA);
        renderForm(container, state, allowed, DATA);
      });
    });
  }

  function renderForm(container, state, allowed, DATA) {
    var body = container.querySelector('#capBody');
    var tab = allowed.filter(function (t) { return t.key === state.tab; })[0];
    body.innerHTML = '<div class="capture-wrap"><div class="card" id="capCard"></div></div>';
    var card = body.querySelector('#capCard');
    tab.build(card, DATA);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Record';
    card.appendChild(btn);

    btn.addEventListener('click', function () {
      var payload = tab.collect(card);
      if (!payload) return;
      payload.clientRef = uuid();
      var original = btn.textContent;
      btn.disabled = true; btn.textContent = 'Saving…';
      apiCall(tab.fn, TOKEN, payload)
        .then(function (res) {
          btn.disabled = false; btn.textContent = original;
          if (isAuthError(res)) { window.location.href = 'index.html'; return; }
          toast(res.message || (res.ok === false ? 'Could not save.' : 'Saved.'), res.ok === false);
          if (res.ok !== false) {
            tab.build(card, DATA); // fresh blank form, ready for the next entry
            card.appendChild(btn);
          }
        })
        .catch(function () {
          btn.disabled = false; btn.textContent = original;
          toast('Not saved — no connection.', true);
        });
    });
  }

  function today() { return new Date().toISOString().slice(0, 10); }
  function val(card, id) { var el = card.querySelector('#' + id); return el ? el.value : ''; }
  function err(msg) { toast(msg, true); return null; }
  function field(label, inputHtml) { return '<label><span class="lbl">' + escapeHtml(label) + '</span>' + inputHtml + '</label>'; }

  function productOptions(DATA) {
    return DATA.products.map(function (p) {
      return '<option value="' + p.sku + '" data-price="' + p.price + '" data-cost="' + (p.cost || '') + '">' + escapeHtml(p.name) + '</option>';
    }).join('');
  }
  function marketerOptions(DATA) {
    return DATA.marketers.map(function (m) { return '<option>' + escapeHtml(m.name) + '</option>'; }).join('');
  }
  function batchOptions(DATA) {
    return '<option value="">— any —</option>' + DATA.batches.map(function (b) {
      return '<option value="' + escapeHtml(b.batch) + '">' + escapeHtml(b.batch) + ' · ' + escapeHtml(b.sku) + ' · exp ' + escapeHtml(b.expiry) + '</option>';
    }).join('');
  }
  function locationOptions(DATA, filterFn) {
    return DATA.locations.filter(filterFn).map(function (l) { return '<option>' + escapeHtml(l.name) + '</option>'; }).join('');
  }

  /* ── Stock In ─────────────────────────────────────────── */
  function buildStockIn(card, DATA) {
    card.innerHTML =
      field('Date', '<input type="date" id="cap_date" value="' + today() + '">') +
      field('Product', '<select id="cap_sku">' + productOptions(DATA) + '</select>') +
      field('Batch number', '<input id="cap_batch" placeholder="B-1180">') +
      field('Quantity', '<input type="number" id="cap_qty" min="1">') +
      field('Production date', '<input type="date" id="cap_prod" value="' + today() + '">') +
      field('Expiry date', '<input type="date" id="cap_exp">') +
      field('Unit cost', '<input type="number" id="cap_cost">') +
      field('Source', '<input id="cap_src" value="Production">');

    var skuSel = card.querySelector('#cap_sku');
    var costIn = card.querySelector('#cap_cost');
    skuSel.onchange = function () {
      var opt = skuSel.options[skuSel.selectedIndex];
      costIn.value = opt ? (opt.getAttribute('data-cost') || '') : '';
    };
    skuSel.onchange();
  }
  function collectStockIn(card) {
    if (!val(card, 'cap_sku') || !val(card, 'cap_qty') || !val(card, 'cap_batch')) return err('Product, batch and quantity are required.');
    return { date: val(card, 'cap_date'), sku: val(card, 'cap_sku'), batch: val(card, 'cap_batch'), qty: val(card, 'cap_qty'),
             production: val(card, 'cap_prod'), expiry: val(card, 'cap_exp'), unitCost: val(card, 'cap_cost'), source: val(card, 'cap_src') };
  }

  /* ── Load Out ─────────────────────────────────────────── */
  function buildLoadOut(card, DATA) {
    card.innerHTML =
      field('Date', '<input type="date" id="cap_date" value="' + today() + '">') +
      field('Marketer', '<select id="cap_mkt">' + marketerOptions(DATA) + '</select>') +
      field('Destination', '<select id="cap_dest">' + locationOptions(DATA, function (l) { return l.type !== 'Cold Room'; }) + '</select>') +
      field('Product', '<select id="cap_sku">' + productOptions(DATA) + '</select>') +
      field('Batch', '<select id="cap_batch">' + batchOptions(DATA) + '</select>') +
      field('Quantity', '<input type="number" id="cap_qty" min="1">') +
      field('Crates out', '<input type="number" id="cap_crates" value="0">');
  }
  function collectLoadOut(card) {
    if (!val(card, 'cap_mkt') || !val(card, 'cap_sku') || !val(card, 'cap_qty')) return err('Marketer, product and quantity are required.');
    return { date: val(card, 'cap_date'), marketer: val(card, 'cap_mkt'), destination: val(card, 'cap_dest'), sku: val(card, 'cap_sku'),
             batch: val(card, 'cap_batch'), qty: val(card, 'cap_qty'), crates: val(card, 'cap_crates') };
  }

  /* ── Sale ─────────────────────────────────────────────── */
  function buildSale(card, DATA) {
    card.innerHTML =
      field('Date', '<input type="date" id="cap_date" value="' + today() + '">') +
      field('Marketer', '<select id="cap_mkt">' + marketerOptions(DATA) + '</select>') +
      field('Location', '<select id="cap_loc">' + locationOptions(DATA, function (l) { return l.type === 'Access Point' || l.type === 'Axis'; }) + '</select>') +
      field('Customer', '<input id="cap_cust" placeholder="Shop or trader name">') +
      field('Product', '<select id="cap_sku">' + productOptions(DATA) + '</select>') +
      field('Quantity', '<input type="number" id="cap_qty" min="1">') +
      field('Unit price', '<input type="number" id="cap_price">') +
      field('Payment', '<select id="cap_pay"><option>Cash</option><option>Transfer</option><option>Credit</option><option>Part Payment</option></select>') +
      '<div class="stat" style="margin-top:14px"><div class="k">Amount</div><div class="v" id="cap_total">0</div></div>';

    var skuSel = card.querySelector('#cap_sku');
    var priceIn = card.querySelector('#cap_price');
    var qtyIn = card.querySelector('#cap_qty');
    var totalEl = card.querySelector('#cap_total');
    function syncTotal() { totalEl.textContent = money((Number(qtyIn.value) || 0) * (Number(priceIn.value) || 0)); }
    skuSel.onchange = function () {
      var opt = skuSel.options[skuSel.selectedIndex];
      priceIn.value = opt ? (opt.getAttribute('data-price') || '') : '';
      syncTotal();
    };
    qtyIn.oninput = syncTotal;
    priceIn.oninput = syncTotal;
    skuSel.onchange();
  }
  function collectSale(card) {
    if (!val(card, 'cap_mkt') || !val(card, 'cap_sku') || !val(card, 'cap_qty') || !val(card, 'cap_price')) return err('Marketer, product, quantity and price are required.');
    return { date: val(card, 'cap_date'), marketer: val(card, 'cap_mkt'), location: val(card, 'cap_loc'), customer: val(card, 'cap_cust'),
             sku: val(card, 'cap_sku'), qty: val(card, 'cap_qty'), price: val(card, 'cap_price'), payment: val(card, 'cap_pay') };
  }

  /* ── Return ───────────────────────────────────────────── */
  function buildReturn(card, DATA) {
    card.innerHTML =
      field('Date', '<input type="date" id="cap_date" value="' + today() + '">') +
      field('Marketer', '<select id="cap_mkt">' + marketerOptions(DATA) + '</select>') +
      field('Product', '<select id="cap_sku">' + productOptions(DATA) + '</select>') +
      field('Batch', '<select id="cap_batch">' + batchOptions(DATA) + '</select>') +
      field('Quantity', '<input type="number" id="cap_qty" min="1">') +
      field('Reason', '<select id="cap_reason"><option>Unsold</option><option>Damaged</option><option>Expired</option><option>Wrong Item</option><option>Customer Rejected</option></select>') +
      field('Condition', '<select id="cap_cond"><option>Good - Restock</option><option>Pending Write-Off</option></select>');
  }
  function collectReturn(card) {
    if (!val(card, 'cap_mkt') || !val(card, 'cap_sku') || !val(card, 'cap_qty')) return err('Marketer, product and quantity are required.');
    return { date: val(card, 'cap_date'), marketer: val(card, 'cap_mkt'), sku: val(card, 'cap_sku'), batch: val(card, 'cap_batch'),
             qty: val(card, 'cap_qty'), reason: val(card, 'cap_reason'), condition: val(card, 'cap_cond') };
  }

  /* ── Cash ─────────────────────────────────────────────── */
  function buildCash(card, DATA) {
    card.innerHTML =
      field('Date', '<input type="date" id="cap_date" value="' + today() + '">') +
      field('Marketer', '<select id="cap_mkt">' + marketerOptions(DATA) + '</select>') +
      field('Amount', '<input type="number" id="cap_amt">') +
      field('Note', '<input id="cap_note" placeholder="Full / part payment">');
  }
  function collectCash(card) {
    if (!val(card, 'cap_mkt') || !val(card, 'cap_amt')) return err('Marketer and amount are required.');
    return { date: val(card, 'cap_date'), marketer: val(card, 'cap_mkt'), amount: val(card, 'cap_amt'), notes: val(card, 'cap_note') };
  }

  /* ── Crates ───────────────────────────────────────────── */
  function buildCrates(card, DATA) {
    card.innerHTML =
      field('Date', '<input type="date" id="cap_date" value="' + today() + '">') +
      field('Marketer', '<select id="cap_mkt">' + marketerOptions(DATA) + '</select>') +
      field('Location', '<select id="cap_loc">' + locationOptions(DATA, function (l) { return l.type !== 'Cold Room'; }) + '</select>') +
      field('Crates out', '<input type="number" id="cap_out" value="0">') +
      field('Crates returned', '<input type="number" id="cap_back" value="0">');
  }
  function collectCrates(card) {
    if (!val(card, 'cap_mkt')) return err('Select a marketer.');
    return { date: val(card, 'cap_date'), marketer: val(card, 'cap_mkt'), location: val(card, 'cap_loc'), out: val(card, 'cap_out'), back: val(card, 'cap_back') };
  }
})();
