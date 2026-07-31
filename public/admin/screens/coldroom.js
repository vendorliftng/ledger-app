/* Ledger admin — Cold Room Stock. Read-only view of the live stock
   position (the same numbers as the Sheet's "Cold Room Stock" tab, already
   fully computed there — this just reads the result). Stock Value is
   hidden from Manager (same reasoning as Products' Cost). */

(function () {
  registerScreen('coldroom', '04', 'Cold Room', 'coldroom', initColdRoom);

  function initColdRoom(container) {
    container.innerHTML = '<div class="admin-empty">Loading…</div>';
    apiCall('getColdRoomStock', TOKEN, {})
      .then(function (res) {
        if (isAuthError(res)) { window.location.href = 'index.html'; return; }
        if (res.ok === false) { container.innerHTML = '<div class="admin-error">' + escapeHtml(res.message) + '</div>'; return; }
        render(container, res.stock);
      })
      .catch(function () {
        container.innerHTML = '<div class="admin-error">Could not load stock. Check your connection and retry.</div>';
      });
  }

  function render(container, stock) {
    container.innerHTML = '';
    var showValue = USER.role !== 'Manager';

    var columns = [
      { key: 'sku', label: 'SKU', type: 'code' },
      { key: 'name', label: 'Product' },
      { key: 'currentStock', label: 'Current stock', type: 'num' }
    ];
    if (showValue) columns.push({ key: 'stockValue', label: 'Value', type: 'num', render: function (v) { return money(v); } });
    columns.push({ key: 'nearestExpiry', label: 'Nearest expiry', type: 'code' });
    columns.push({ key: 'daysToExpiry', label: 'Days left', type: 'num' });
    columns.push({ key: 'status', label: 'Status', render: statusBadge });

    renderDataTable(container, {
      columns: columns,
      rows: stock,
      rowKey: function (r) { return r.sku; },
      searchable: ['sku', 'name'],
      filters: [{ key: 'status', label: 'Status', options: ['OK', '⚠ Expiring soon', 'Out of stock'] }],
      csvFilename: 'cold-room-stock.csv'
    });
  }

  function statusBadge(v) {
    if (v === 'Out of stock') return '<span class="badge bad">Out of stock</span>';
    if (String(v).indexOf('Expiring') !== -1) return '<span class="badge warn">Expiring soon</span>';
    return '<span class="badge ok">' + escapeHtml(v) + '</span>';
  }
})();
