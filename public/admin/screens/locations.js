/* Ledger admin — Locations (hierarchy: Cold Room -> State -> Axis -> Access
   Point, via a Parent field). Validation (no self-parent, no cycles, can't
   deactivate an active parent) happens server-side in saveLocation_ — this
   screen just surfaces whatever message comes back. */

(function () {
  // Mirrors Config.gs's LOCATION_TYPES — small, stable list, not worth a
  // round-trip to fetch.
  var LOCATION_TYPES = ['Cold Room', 'State', 'Axis', 'Access Point'];

  registerScreen('locations', '08', 'Locations', 'locations', initLocations);

  function initLocations(container) {
    container.innerHTML = '<div class="admin-empty">Loading…</div>';
    apiCall('getLocations', TOKEN, {})
      .then(function (res) {
        if (isAuthError(res)) { window.location.href = 'index.html'; return; }
        if (res.ok === false) { container.innerHTML = '<div class="admin-error">' + escapeHtml(res.message) + '</div>'; return; }
        render(container, res.locations);
      })
      .catch(function () {
        container.innerHTML = '<div class="admin-error">Could not load locations. Check your connection and retry.</div>';
      });
  }

  function render(container, locations) {
    container.innerHTML = '';
    var canWrite = USER.role === 'Owner' || USER.role === 'Manager';

    renderDataTable(container, {
      columns: [
        { key: 'locationId', label: 'ID', type: 'code' },
        { key: 'name', label: 'Name' },
        { key: 'type', label: 'Type' },
        { key: 'parent', label: 'Parent' },
        { key: 'active', label: 'Status', render: function (v) {
          return v ? '<span class="badge ok">Active</span>' : '<span class="badge muted">Inactive</span>';
        } }
      ],
      rows: locations,
      rowKey: function (r) { return r.locationId; },
      searchable: ['name', 'parent', 'contact'],
      filters: [
        { key: 'type', label: 'Type', options: LOCATION_TYPES },
        { key: 'active', label: 'Status', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] }
      ],
      csvFilename: 'locations.csv',
      onRowClick: canWrite ? function (r) { openLocationModal(container, r, locations); } : null,
      onAdd: canWrite ? function () { openLocationModal(container, null, locations); } : null,
      addLabel: 'Add location',
      onToggleActive: canWrite ? function (row, btn) {
        // Deactivating a location that's still an active parent of another
        // is rejected server-side (saveLocation_) — the toggle just surfaces
        // that message via handleActiveToggle rather than silently failing.
        handleActiveToggle(row, btn, function (newActive) {
          var payload = Object.assign({}, row, { active: newActive });
          return apiCall('saveLocation', TOKEN, payload);
        }, function () { initLocations(container); });
      } : null
    });
  }

  function openLocationModal(container, existing, allLocations) {
    var parentOptions = [{ value: '', label: '— none (top level) —' }].concat(
      allLocations
        .filter(function (l) { return !existing || l.locationId !== existing.locationId; })
        .map(function (l) { return l.name; })
    );

    openModal({
      title: existing ? 'Edit location' : 'Add location',
      fields: [
        { key: 'name', label: 'Name', required: true },
        { key: 'type', label: 'Type', type: 'select', options: LOCATION_TYPES, required: true },
        { key: 'parent', label: 'Parent', type: 'select', options: parentOptions },
        { key: 'contact', label: 'Contact' },
        { key: 'active', label: 'Active', type: 'checkbox', checkboxLabel: 'Active' }
      ],
      initialValues: existing || { active: true },
      onSubmit: function (values) {
        if (existing) values.locationId = existing.locationId;
        return apiCall('saveLocation', TOKEN, values);
      },
      onSuccess: function () { initLocations(container); }
    });
  }
})();
