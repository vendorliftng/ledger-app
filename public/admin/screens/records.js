/* Ledger admin — Records. Browse and edit the 6 field-capture types
   (Stock In, Load Out, Sales, Returns, Cash, Crates) via the already-
   existing getRecentRecords_/editRecord_ endpoints. Editing a row opens a
   modal with several fields at once for convenience, but the backend only
   patches one field per call — onSubmit below diffs against the original
   values and fires one editRecord call per changed field, in sequence,
   stopping at the first rejection so a partial failure is never silent. */

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

  registerScreen('records', '02', 'Records', 'history', initRecords);

  function initRecords(container) {
    var state = { tab: TABS[0] };
    container.innerHTML = '<div class="toolbar" id="tabBar"></div><div id="recordsBody"></div>';
    renderTabBar(container, state);
    loadTab(container, state);
  }

  function renderTabBar(container, state) {
    var bar = container.querySelector('#tabBar');
    bar.innerHTML = TABS.map(function (t) {
      return '<button type="button" class="ghost tab-btn' + (t === state.tab ? ' tab-btn-active' : '') +
        '" data-tab="' + escapeHtml(t) + '">' + escapeHtml(t) + '</button>';
    }).join('');
    Array.prototype.forEach.call(bar.querySelectorAll('button'), function (btn) {
      btn.addEventListener('click', function () {
        state.tab = btn.getAttribute('data-tab');
        renderTabBar(container, state);
        loadTab(container, state);
      });
    });
  }

  function loadTab(container, state) {
    var body = container.querySelector('#recordsBody');
    body.innerHTML = '<div class="admin-empty">Loading…</div>';
    apiCall('getRecentRecords', TOKEN, { tab: state.tab, days: 14 })
      .then(function (res) {
        if (isAuthError(res)) { window.location.href = 'index.html'; return; }
        if (res.ok === false) { body.innerHTML = '<div class="admin-error">' + escapeHtml(res.message) + '</div>'; return; }
        renderTable(container, state, res.records);
      })
      .catch(function () {
        body.innerHTML = '<div class="admin-error">Could not load records. Check your connection and retry.</div>';
      });
  }

  function renderTable(container, state, records) {
    var body = container.querySelector('#recordsBody');
    body.innerHTML = '';
    var cfg = TAB_CONFIGS[state.tab];
    var columns = cfg.columns.map(function (key) {
      var isNum = /Quantity|Amount|Price|Cost|Crates/.test(key);
      return { key: key, label: key, type: isNum ? 'num' : 'text' };
    });

    renderDataTable(body, {
      columns: columns,
      rows: records,
      rowKey: function (r) { return r[cfg.idField]; },
      searchable: cfg.searchable,
      csvFilename: state.tab.toLowerCase().replace(/\s+/g, '-') + '-records.csv',
      onRowClick: function (r) { openEditModal(container, state, cfg, r); }
    });
  }

  function openEditModal(container, state, cfg, record) {
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
      onSuccess: function () { loadTab(container, state); }
    });
  }
})();
