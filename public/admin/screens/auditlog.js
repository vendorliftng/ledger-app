/* Ledger admin — Audit Log. Read-only view of every edit anyone has made,
   wired to the already-existing getAuditLog_ endpoint. This is the whole
   reason edits don't need a per-edit Telegram ping — Owner/Manager just
   check here. */

(function () {
  registerScreen('auditlog', '09', 'Audit Log', 'auditlog', initAuditLog);

  function initAuditLog(container) {
    container.innerHTML = '<div class="admin-empty">Loading…</div>';
    apiCall('getAuditLog', TOKEN, { days: 30 })
      .then(function (res) {
        if (isAuthError(res)) { window.location.href = 'index.html'; return; }
        if (res.ok === false) { container.innerHTML = '<div class="admin-error">' + escapeHtml(res.message) + '</div>'; return; }
        render(container, res.entries);
      })
      .catch(function () {
        container.innerHTML = '<div class="admin-error">Could not load the audit log. Check your connection and retry.</div>';
      });
  }

  function render(container, entries) {
    container.innerHTML = '';
    renderDataTable(container, {
      columns: [
        { key: 'when', label: 'When', type: 'code' },
        { key: 'editor', label: 'Editor' },
        { key: 'role', label: 'Role' },
        { key: 'tab', label: 'Record type' },
        { key: 'recordId', label: 'Record', type: 'code' },
        { key: 'field', label: 'Field' },
        { key: 'oldValue', label: 'Old value', type: 'code' },
        { key: 'newValue', label: 'New value', type: 'code' }
      ],
      rows: entries,
      rowKey: function (r) { return r.recordId + '-' + r.when + '-' + r.field; },
      searchable: ['editor', 'tab', 'recordId', 'field'],
      filters: [{ key: 'role', label: 'Role', options: ['Owner', 'Manager', 'Storekeeper', 'Marketer'] }],
      csvFilename: 'audit-log.csv'
    });
  }
})();
