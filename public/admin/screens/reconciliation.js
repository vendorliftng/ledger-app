/* Ledger admin — Reconciliation. Today's variance (same gauges as the
   mobile app's own reconciliation screen) plus a 30-day history table.
   Owner/Manager only — matches Storekeeper never having 'recon' in
   ROLE_ACTIONS, so this screen is never even offered to them. */

(function () {
  registerScreen('recon', '04', 'Reconciliation', 'recon', initRecon);

  function initRecon(container, DATA) {
    var rows = (DATA.summary && DATA.summary.recon) || [];
    var canSave = USER.role === 'Owner' || USER.role === 'Manager';

    container.innerHTML =
      '<div class="screen-head">' +
        '<div class="eyebrow">Today — issued vs sold vs returned vs cash</div>' +
        (canSave ? '<div class="actions"><button type="button" id="saveReconBtn">Save today\'s reconciliation</button></div>' : '') +
      '</div>' +
      (rows.length
        ? '<div class="gauge-grid">' + rows.map(gauge).join('') + '</div>'
        : '<div class="admin-empty">Nothing issued today yet. Reconciliation appears once stock goes out.</div>') +
      '<div class="eyebrow" style="margin:32px 0 10px">History (last 30 days)</div>' +
      '<div id="reconHistory"><div class="admin-empty">Loading…</div></div>';

    if (canSave) {
      document.getElementById('saveReconBtn').addEventListener('click', function () {
        var btn = this;
        var original = btn.textContent;
        btn.disabled = true; btn.textContent = 'Saving…';
        apiCall('saveReconciliation', TOKEN, {})
          .then(function (res) {
            btn.disabled = false; btn.textContent = original;
            toast(res.message, !res.ok);
          })
          .catch(function () {
            btn.disabled = false; btn.textContent = original;
            toast('Not saved — no connection.', true);
          });
      });
    }

    loadHistory(container);
  }

  function loadHistory(container) {
    var target = container.querySelector('#reconHistory');
    apiCall('getReconciliationHistory', TOKEN, { days: 30 })
      .then(function (res) {
        if (isAuthError(res)) { window.location.href = 'index.html'; return; }
        if (res.ok === false) { target.innerHTML = '<div class="admin-error">' + escapeHtml(res.message) + '</div>'; return; }
        target.innerHTML = '';
        renderDataTable(target, {
          columns: [
            { key: 'date', label: 'Date', type: 'code' },
            { key: 'marketer', label: 'Marketer' },
            { key: 'issued', label: 'Issued', type: 'num' },
            { key: 'sold', label: 'Sold', type: 'num' },
            { key: 'returned', label: 'Returned', type: 'num' },
            { key: 'stockVariance', label: 'Stock var.', type: 'num' },
            { key: 'cashVariance', label: 'Cash var.', type: 'num', render: function (v) { return money(v); } },
            { key: 'status', label: 'Status', render: function (v) {
              return v === 'FLAGGED' ? '<span class="badge bad">Flagged</span>' : '<span class="badge ok">Clear</span>';
            } }
          ],
          rows: res.entries,
          rowKey: function (r) { return r.date + '-' + r.marketer; },
          searchable: ['marketer'],
          filters: [{ key: 'status', label: 'Status', options: [{ value: 'FLAGGED', label: 'Flagged' }, { value: 'CLEAR', label: 'Clear' }] }],
          csvFilename: 'reconciliation-history.csv'
        });
      })
      .catch(function () {
        target.innerHTML = '<div class="admin-error">Could not load history. Check your connection and retry.</div>';
      });
  }
})();
