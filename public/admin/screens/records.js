/* Ledger admin — Records. Browse, add, and edit the 6 field-capture types
   (Stock In, Load Out, Sales, Returns, Cash, Crates) via the already-
   existing getRecentRecords_, submit* and editRecord_ endpoints.

   "Add" uses the exact same table-with-a-modal pattern as Marketers/
   Products/Locations — deliberately not a separate screen with its own
   layout, so there's one interaction to learn for "add a thing," not two.
   Which tabs offer an Add button depends on DATA.allowedActions (Storekeeper
   can add Stock In but not a Sale, for instance) — same source the mobile
   app's own tiles read from, so nothing's offered here the server would
   reject anyway.

   Editing a row opens a modal with several fields at once for convenience,
   but the backend only patches one field per call — its onSubmit diffs
   against the original values and fires one editRecord call per changed
   field, in sequence, stopping at the first rejection so a partial failure
   is never silent. */

(function () {
  var TABS = ['Stock In', 'Load Out', 'Sales', 'Returns', 'Cash Remittance', 'Crates'];

  var TAB_CONFIGS = {
    'Stock In': {
      idField: 'Entry ID',
      columns: ['Entry ID', 'Date', 'SKU', 'Batch No', 'Quantity', 'Unit Cost', 'Recorded By'],
      editable: [
        { key: 'Quantity', label: 'Quantity', type: 'number' },
        { key: 'Batch No', label: 'Batch number' },
        { key: 'Unit Cost', label: 'Unit cost', type: 'number' },
        { key: 'Notes', label: 'Notes' }
      ],
      searchable: ['SKU', 'Batch No', 'Recorded By']
    },
    'Load Out': {
      idField: 'Load ID',
      columns: ['Load ID', 'Date', 'Marketer', 'Destination', 'SKU', 'Batch No', 'Quantity', 'Crates Out', 'Recorded By'],
      editable: [
        { key: 'Quantity', label: 'Quantity', type: 'number' },
        { key: 'Crates Out', label: 'Crates out', type: 'number' },
        { key: 'Destination', label: 'Destination' },
        { key: 'Notes', label: 'Notes' }
      ],
      searchable: ['Marketer', 'SKU', 'Destination', 'Recorded By']
    },
    'Sales': {
      idField: 'Sale ID',
      columns: ['Sale ID', 'Date', 'Marketer', 'Location', 'Customer', 'SKU', 'Quantity', 'Unit Price', 'Amount', 'Payment Type', 'Recorded By'],
      editable: [
        { key: 'Quantity', label: 'Quantity', type: 'number' },
        { key: 'Unit Price', label: 'Unit price', type: 'number' },
        { key: 'Customer', label: 'Customer' },
        { key: 'Payment Type', label: 'Payment', type: 'select', options: ['Cash', 'Transfer', 'Credit', 'Part Payment'] }
      ],
      searchable: ['Marketer', 'Customer', 'SKU', 'Recorded By']
    },
    'Returns': {
      idField: 'Return ID',
      columns: ['Return ID', 'Date', 'Marketer', 'SKU', 'Batch No', 'Quantity', 'Reason', 'Condition', 'Recorded By'],
      editable: [
        { key: 'Quantity', label: 'Quantity', type: 'number' },
        { key: 'Reason', label: 'Reason', type: 'select', options: ['Unsold', 'Damaged', 'Expired', 'Wrong Item', 'Customer Rejected'] },
        { key: 'Condition', label: 'Condition', type: 'select', options: ['Good - Restock', 'Pending Write-Off', 'Write Off'],
          help: 'Only Owner/Manager can finalize "Write Off".' }
      ],
      searchable: ['Marketer', 'SKU', 'Recorded By']
    },
    'Cash Remittance': {
      idField: 'Remit ID',
      columns: ['Remit ID', 'Date', 'Marketer', 'Amount', 'Received By', 'Notes'],
      editable: [
        { key: 'Amount', label: 'Amount', type: 'number' },
        { key: 'Notes', label: 'Notes' }
      ],
      searchable: ['Marketer', 'Received By']
    },
    'Crates': {
      idField: 'Entry ID',
      columns: ['Entry ID', 'Date', 'Marketer', 'Location', 'Crates Out', 'Crates Returned', 'Recorded By'],
      editable: [
        { key: 'Crates Out', label: 'Crates out', type: 'number' },
        { key: 'Crates Returned', label: 'Crates returned', type: 'number' },
        { key: 'Location', label: 'Location' }
      ],
      searchable: ['Marketer', 'Location', 'Recorded By']
    }
  };

  // Which server action creates a row on this tab, and which allowedActions
  // key gates whether this role's "Add" button should even be offered —
  // the same keys the mobile app's tiles filter on (see app.js's LABELS).
  var CREATE_META = {
    'Stock In':        { fn: 'submitStockIn', actionKey: 'stockin', addLabel: 'Add stock in' },
    'Load Out':        { fn: 'submitLoadOut', actionKey: 'loadout', addLabel: 'Add load out' },
    'Sales':           { fn: 'submitSale',    actionKey: 'sale',    addLabel: 'Add sale' },
    'Returns':         { fn: 'submitReturn',  actionKey: 'return',  addLabel: 'Add return' },
    'Cash Remittance': { fn: 'submitCash',    actionKey: 'cash',    addLabel: 'Add cash remittance' },
    'Crates':          { fn: 'submitCrates',  actionKey: 'crates',  addLabel: 'Add crates entry' }
  };

  var CREATE_FIELDS = {
    'Stock In': function (DATA) {
      return {
        fields: [
          { key: 'date', label: 'Date', type: 'date', required: true },
          { key: 'sku', label: 'Product', type: 'select', options: productOptions(DATA), required: true },
          { key: 'batch', label: 'Batch number', placeholder: 'B-1180', required: true },
          { key: 'qty', label: 'Quantity', type: 'number', required: true },
          { key: 'production', label: 'Production date', type: 'date' },
          { key: 'expiry', label: 'Expiry date', type: 'date' },
          { key: 'unitCost', label: 'Unit cost', type: 'number' },
          { key: 'source', label: 'Source' }
        ],
        initialValues: { date: today(), production: today(), source: 'Production' }
      };
    },
    'Load Out': function (DATA) {
      return {
        fields: [
          { key: 'date', label: 'Date', type: 'date', required: true },
          { key: 'marketer', label: 'Marketer', type: 'select', options: marketerOptions(DATA), required: true },
          { key: 'destination', label: 'Destination', type: 'select', options: locationOptions(DATA, function (l) { return l.type !== 'Cold Room'; }) },
          { key: 'sku', label: 'Product', type: 'select', options: productOptions(DATA), required: true },
          { key: 'batch', label: 'Batch', type: 'select', options: batchOptions(DATA) },
          { key: 'qty', label: 'Quantity', type: 'number', required: true },
          { key: 'crates', label: 'Crates out', type: 'number' }
        ],
        initialValues: { date: today(), crates: 0 }
      };
    },
    'Sales': function (DATA) {
      return {
        fields: [
          { key: 'date', label: 'Date', type: 'date', required: true },
          { key: 'marketer', label: 'Marketer', type: 'select', options: marketerOptions(DATA), required: true },
          { key: 'location', label: 'Location', type: 'select', options: locationOptions(DATA, function (l) { return l.type === 'Access Point' || l.type === 'Axis'; }) },
          { key: 'customer', label: 'Customer', placeholder: 'Shop or trader name' },
          { key: 'sku', label: 'Product', type: 'select', options: productOptions(DATA), required: true },
          { key: 'qty', label: 'Quantity', type: 'number', required: true },
          { key: 'price', label: 'Unit price', type: 'number', required: true },
          { key: 'payment', label: 'Payment', type: 'select', options: ['Cash', 'Transfer', 'Credit', 'Part Payment'] }
        ],
        initialValues: { date: today(), payment: 'Cash' }
      };
    },
    'Returns': function (DATA) {
      return {
        fields: [
          { key: 'date', label: 'Date', type: 'date', required: true },
          { key: 'marketer', label: 'Marketer', type: 'select', options: marketerOptions(DATA), required: true },
          { key: 'sku', label: 'Product', type: 'select', options: productOptions(DATA), required: true },
          { key: 'batch', label: 'Batch', type: 'select', options: batchOptions(DATA) },
          { key: 'qty', label: 'Quantity', type: 'number', required: true },
          { key: 'reason', label: 'Reason', type: 'select', options: ['Unsold', 'Damaged', 'Expired', 'Wrong Item', 'Customer Rejected'] },
          // 'Write Off' is deliberately never offered here, for any role — same
          // rule the mobile app follows. It's only ever reached later, via the
          // Condition field in the edit modal above, restricted server-side to
          // Owner/Manager.
          { key: 'condition', label: 'Condition', type: 'select', options: ['Good - Restock', 'Pending Write-Off'] }
        ],
        initialValues: { date: today(), reason: 'Unsold', condition: 'Good - Restock' }
      };
    },
    'Cash Remittance': function (DATA) {
      return {
        fields: [
          { key: 'date', label: 'Date', type: 'date', required: true },
          { key: 'marketer', label: 'Marketer', type: 'select', options: marketerOptions(DATA), required: true },
          { key: 'amount', label: 'Amount', type: 'number', required: true },
          { key: 'notes', label: 'Note', placeholder: 'Full / part payment' }
        ],
        initialValues: { date: today() }
      };
    },
    'Crates': function (DATA) {
      return {
        fields: [
          { key: 'date', label: 'Date', type: 'date', required: true },
          { key: 'marketer', label: 'Marketer', type: 'select', options: marketerOptions(DATA), required: true },
          { key: 'location', label: 'Location', type: 'select', options: locationOptions(DATA, function (l) { return l.type !== 'Cold Room'; }) },
          { key: 'out', label: 'Crates out', type: 'number' },
          { key: 'back', label: 'Crates returned', type: 'number' }
        ],
        initialValues: { date: today(), out: 0, back: 0 }
      };
    }
  };

  function today() { return new Date().toISOString().slice(0, 10); }
  function productOptions(DATA) { return DATA.products.map(function (p) { return { value: p.sku, label: p.name }; }); }
  function marketerOptions(DATA) { return DATA.marketers.map(function (m) { return m.name; }); }
  function locationOptions(DATA, filterFn) { return DATA.locations.filter(filterFn).map(function (l) { return l.name; }); }
  function batchOptions(DATA) {
    return [{ value: '', label: '— any —' }].concat(DATA.batches.map(function (b) {
      return { value: b.batch, label: b.batch + ' · ' + b.sku + ' · exp ' + b.expiry };
    }));
  }

  registerScreen('records', '02', 'Records', 'history', initRecords);

  function initRecords(container, DATA) {
    var state = { tab: TABS[0] };
    container.innerHTML = '<div class="toolbar" id="tabBar"></div><div id="recordsBody"></div>';
    renderTabBar(container, state, DATA);
    loadTab(container, state, DATA);
  }

  function renderTabBar(container, state, DATA) {
    var bar = container.querySelector('#tabBar');
    bar.innerHTML = TABS.map(function (t) {
      return '<button type="button" class="ghost tab-btn' + (t === state.tab ? ' tab-btn-active' : '') +
        '" data-tab="' + escapeHtml(t) + '">' + escapeHtml(t) + '</button>';
    }).join('');
    Array.prototype.forEach.call(bar.querySelectorAll('button'), function (btn) {
      btn.addEventListener('click', function () {
        state.tab = btn.getAttribute('data-tab');
        renderTabBar(container, state, DATA);
        loadTab(container, state, DATA);
      });
    });
  }

  function loadTab(container, state, DATA) {
    var body = container.querySelector('#recordsBody');
    body.innerHTML = '<div class="admin-empty">Loading…</div>';
    apiCall('getRecentRecords', TOKEN, { tab: state.tab, days: 14 })
      .then(function (res) {
        if (isAuthError(res)) { window.location.href = 'index.html'; return; }
        if (res.ok === false) { body.innerHTML = '<div class="admin-error">' + escapeHtml(res.message) + '</div>'; return; }
        renderTable(container, state, res.records, DATA);
      })
      .catch(function () {
        body.innerHTML = '<div class="admin-error">Could not load records. Check your connection and retry.</div>';
      });
  }

  function renderTable(container, state, records, DATA) {
    var body = container.querySelector('#recordsBody');
    body.innerHTML = '';
    var cfg = TAB_CONFIGS[state.tab];
    var meta = CREATE_META[state.tab];
    var canCreate = (DATA.allowedActions || []).indexOf(meta.actionKey) !== -1;

    var columns = cfg.columns.map(function (key) {
      var isNum = /Quantity|Amount|Price|Cost|Crates/.test(key);
      return { key: key, label: key, type: isNum ? 'num' : 'text' };
    });
    // Edited is a flag getRecentRecords_ computes from the Audit Log, not a
    // real sheet column — surfaced as its own badge column so a change is
    // visible right on the row, not just buried in the separate Audit Log
    // screen (which Storekeeper/Marketer can't even open).
    columns.push({ key: 'Edited', label: 'Edited', render: function (v) {
      return v ? '<span class="badge warn">Edited</span>' : '';
    } });

    renderDataTable(body, {
      columns: columns,
      rows: records,
      rowKey: function (r) { return r[cfg.idField]; },
      searchable: cfg.searchable,
      csvFilename: state.tab.toLowerCase().replace(/\s+/g, '-') + '-records.csv',
      onRowClick: function (r) { openEditModal(container, state, cfg, r, DATA); },
      rowClass: function (r) { return r.Edited ? 'row-edited' : ''; },
      onAdd: canCreate ? function () { openAddModal(container, state, DATA); } : null,
      addLabel: meta.addLabel
    });
  }

  function openAddModal(container, state, DATA) {
    var meta = CREATE_META[state.tab];
    var built = CREATE_FIELDS[state.tab](DATA);

    openModal({
      title: meta.addLabel,
      fields: built.fields,
      initialValues: built.initialValues,
      submitLabel: 'Record',
      onSubmit: function (values) {
        var payload = Object.assign({}, values, { clientRef: uuid() });
        return apiCall(meta.fn, TOKEN, payload);
      },
      onSuccess: function () { loadTab(container, state, DATA); }
    });
  }

  function openEditModal(container, state, cfg, record, DATA) {
    var fields = cfg.editable.map(function (f) {
      return {
        key: f.key, label: f.label,
        type: f.type === 'select' ? 'select' : (f.type === 'number' ? 'number' : 'text'),
        options: f.options, help: f.help
      };
    });
    var initialValues = {};
    fields.forEach(function (f) { initialValues[f.key] = record[f.key]; });

    openModal({
      title: state.tab + ' — ' + record[cfg.idField],
      fields: fields,
      initialValues: initialValues,
      submitLabel: 'Save changes',
      onSubmit: function (values) {
        var changed = fields.filter(function (f) { return String(values[f.key]) !== String(initialValues[f.key]); });
        if (!changed.length) return Promise.resolve({ ok: true, message: 'No changes made.' });

        var chain = Promise.resolve({ ok: true });
        changed.forEach(function (f) {
          chain = chain.then(function (prev) {
            if (prev.ok === false) return prev; // stop at the first rejection, surface it plainly
            return apiCall('editRecord', TOKEN, { tab: state.tab, id: record[cfg.idField], field: f.key, newValue: values[f.key] });
          });
        });
        return chain.then(function (res) {
          return res.ok === false ? res : { ok: true, message: changed.length + ' field(s) updated.' };
        });
      },
      onSuccess: function () { loadTab(container, state, DATA); }
    });
  }
})();
