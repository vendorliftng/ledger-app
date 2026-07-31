/* Ledger admin — Marketers (rep profiles: name, phone, route, active).
   Distinct from Users (logins/PINs) — a User can optionally link to one of
   these, but this is the business record. Owner/Manager can add & edit;
   Storekeeper sees this read-only (the server enforces the write gate
   regardless of what buttons this screen shows). */

(function () {
  registerScreen('marketers', '06', 'Marketers', 'marketers', initMarketers);

  function initMarketers(container) {
    container.innerHTML = '<div class="admin-empty">Loading…</div>';
    apiCall('getMarketers', TOKEN, {})
      .then(function (res) {
        if (isAuthError(res)) { window.location.href = 'index.html'; return; }
        if (res.ok === false) { container.innerHTML = '<div class="admin-error">' + escapeHtml(res.message) + '</div>'; return; }
        render(container, res.marketers);
      })
      .catch(function () {
        container.innerHTML = '<div class="admin-error">Could not load marketers. Check your connection and retry.</div>';
      });
  }

  function render(container, marketers) {
    container.innerHTML = '';
    var canWrite = USER.role === 'Owner' || USER.role === 'Manager';

    renderDataTable(container, {
      columns: [
        { key: 'marketerId', label: 'ID', type: 'code' },
        { key: 'name', label: 'Name' },
        { key: 'phone', label: 'Phone', type: 'code' },
        { key: 'area', label: 'Area' },
        { key: 'active', label: 'Status', render: function (v) {
          return v ? '<span class="badge ok">Active</span>' : '<span class="badge muted">Inactive</span>';
        } }
      ],
      rows: marketers,
      rowKey: function (r) { return r.marketerId; },
      searchable: ['name', 'phone', 'area'],
      filters: [{ key: 'active', label: 'Status', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] }],
      csvFilename: 'marketers.csv',
      onRowClick: canWrite ? function (r) { openMarketerModal(container, r); } : null,
      onAdd: canWrite ? function () { openMarketerModal(container, null); } : null,
      addLabel: 'Add marketer',
      onToggleActive: canWrite ? function (row, btn) {
        handleActiveToggle(row, btn, function (newActive) {
          return apiCall('saveMarketer', TOKEN, {
            marketerId: row.marketerId, fullName: row.name, phone: row.phone, area: row.area, role: row.role, active: newActive
          });
        }, function () { initMarketers(container); });
      } : null
    });
  }

  function openMarketerModal(container, existing) {
    openModal({
      title: existing ? 'Edit marketer' : 'Add marketer',
      fields: [
        { key: 'fullName', label: 'Full name', required: true },
        { key: 'phone', label: 'Phone' },
        { key: 'area', label: 'Assigned area', placeholder: 'e.g. Yola Axis' },
        { key: 'active', label: 'Active', type: 'checkbox', checkboxLabel: 'Active' }
      ],
      initialValues: existing ? {
        fullName: existing.name, phone: existing.phone, area: existing.area, active: existing.active
      } : { active: true },
      onSubmit: function (values) {
        var payload = {
          fullName: values.fullName, phone: values.phone, area: values.area, active: values.active
        };
        if (existing) payload.marketerId = existing.marketerId;
        return apiCall('saveMarketer', TOKEN, payload);
      },
      onSuccess: function () { initMarketers(container); }
    });
  }
})();
