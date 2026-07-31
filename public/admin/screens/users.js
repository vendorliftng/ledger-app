/* Ledger admin — Users (staff logins/PINs). Owner only, both to view and to
   change — wired to the getUsers_/saveUser_ endpoints that already existed
   before this dashboard did. A User can optionally link to a Marketer
   profile (see marketers.js) via 'Linked Marketer'. */

(function () {
  var ROLES = ['Owner', 'Manager', 'Storekeeper', 'Marketer'];

  registerScreen('users', '09', 'Users', 'users', initUsers);

  function initUsers(container, DATA) {
    container.innerHTML = '<div class="admin-empty">Loading…</div>';
    apiCall('getUsers', TOKEN, {})
      .then(function (res) {
        if (isAuthError(res)) { window.location.href = 'index.html'; return; }
        if (res.ok === false) { container.innerHTML = '<div class="admin-error">' + escapeHtml(res.message) + '</div>'; return; }
        render(container, res.users, DATA);
      })
      .catch(function () {
        container.innerHTML = '<div class="admin-error">Could not load users. Check your connection and retry.</div>';
      });
  }

  function render(container, users, DATA) {
    container.innerHTML = '';

    renderDataTable(container, {
      columns: [
        { key: 'userId', label: 'ID', type: 'code' },
        { key: 'name', label: 'Name' },
        { key: 'role', label: 'Role' },
        { key: 'marketer', label: 'Linked marketer' },
        { key: 'active', label: 'Status', render: function (v) {
          return v ? '<span class="badge ok">Active</span>' : '<span class="badge muted">Inactive</span>';
        } }
      ],
      rows: users,
      rowKey: function (r) { return r.userId; },
      searchable: ['name', 'marketer'],
      filters: [
        { key: 'role', label: 'Role', options: ROLES },
        { key: 'active', label: 'Status', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] }
      ],
      csvFilename: 'users.csv',
      onRowClick: function (r) { openUserModal(container, r, DATA); },
      onAdd: function () { openUserModal(container, null, DATA); },
      addLabel: 'Add user',
      onToggleActive: function (row, btn) {
        // saveUser_ requires a valid 4-digit PIN in the payload even when
        // nothing about the PIN is changing, so it has to be carried over
        // from the row (getUsers_ does include it) — a partial payload
        // would fail the PIN check.
        handleActiveToggle(row, btn, function (newActive) {
          return apiCall('saveUser', TOKEN, {
            userId: row.userId, fullName: row.name, role: row.role, pin: row.pin, marketer: row.marketer, active: newActive
          });
        }, function () { initUsers(container, DATA); });
      }
    });
  }

  function openUserModal(container, existing, DATA) {
    var marketerOptions = [{ value: '', label: '— none —' }].concat(
      (DATA.marketers || []).map(function (m) { return m.name; })
    );

    openModal({
      title: existing ? 'Edit user' : 'Add user',
      fields: [
        { key: 'fullName', label: 'Full name', required: true },
        { key: 'role', label: 'Role', type: 'select', options: ROLES, required: true },
        { key: 'pin', label: 'PIN', placeholder: '4 digits', required: true,
          help: existing ? 'Leave as-is unless you want to change it.' : 'Must be exactly 4 digits, and not already used by another active person.' },
        { key: 'marketer', label: 'Linked marketer', type: 'select', options: marketerOptions,
          help: 'Only matters if Role is Marketer — this is what scopes them to their own route.' },
        { key: 'active', label: 'Active', type: 'checkbox', checkboxLabel: 'Active' }
      ],
      initialValues: existing ? {
        fullName: existing.name, role: existing.role, pin: existing.pin, marketer: existing.marketer, active: existing.active
      } : { role: 'Marketer', active: true },
      onSubmit: function (values) {
        var payload = {
          fullName: values.fullName, role: values.role, pin: values.pin,
          marketer: values.marketer, active: values.active
        };
        if (existing) payload.userId = existing.userId;
        return apiCall('saveUser', TOKEN, payload);
      },
      onSuccess: function () { initUsers(container, DATA); }
    });
  }
})();
