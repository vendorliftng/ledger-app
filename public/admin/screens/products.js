/* Ledger admin — Products (catalogue: SKU, name, price, cost, shelf life).
   SKU is the natural key — immutable once created, since every transaction
   tab references it. Cost is hidden from Manager (same rule as the mobile
   app's getBootstrap) — the server already omits it in the response; this
   screen just doesn't render a Cost column at all for that role, rather
   than showing an always-blank one. */

(function () {
  registerScreen('products', '06', 'Products', 'products', initProducts);

  function initProducts(container) {
    container.innerHTML = '<div class="admin-empty">Loading…</div>';
    apiCall('getProducts', TOKEN, {})
      .then(function (res) {
        if (isAuthError(res)) { window.location.href = 'index.html'; return; }
        if (res.ok === false) { container.innerHTML = '<div class="admin-error">' + escapeHtml(res.message) + '</div>'; return; }
        render(container, res.products);
      })
      .catch(function () {
        container.innerHTML = '<div class="admin-error">Could not load products. Check your connection and retry.</div>';
      });
  }

  function render(container, products) {
    container.innerHTML = '';
    var canWrite = USER.role === 'Owner' || USER.role === 'Manager';
    var showCost = USER.role === 'Owner' || USER.role === 'Storekeeper';

    var columns = [
      { key: 'sku', label: 'SKU', type: 'code' },
      { key: 'name', label: 'Product' },
      { key: 'size', label: 'Size', type: 'code' },
      { key: 'price', label: 'Price', type: 'num', render: function (v) { return money(v); } }
    ];
    if (showCost) columns.push({ key: 'cost', label: 'Cost', type: 'num', render: function (v) { return money(v); } });
    columns.push({ key: 'shelfLife', label: 'Shelf life', type: 'num', render: function (v) { return v + 'd'; } });
    columns.push({ key: 'active', label: 'Status', render: function (v) {
      return v ? '<span class="badge ok">Active</span>' : '<span class="badge muted">Inactive</span>';
    } });

    renderDataTable(container, {
      columns: columns,
      rows: products,
      rowKey: function (r) { return r.sku; },
      searchable: ['sku', 'name', 'flavour', 'size'],
      filters: [{ key: 'active', label: 'Status', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] }],
      csvFilename: 'products.csv',
      onRowClick: canWrite ? function (r) { openProductModal(container, r, showCost); } : null,
      onAdd: canWrite ? function () { openProductModal(container, null, showCost); } : null,
      addLabel: 'Add product'
    });
  }

  function openProductModal(container, existing, showCost) {
    var fields = [
      { key: 'sku', label: 'SKU', required: true, placeholder: 'e.g. ADM-ST-250',
        help: existing ? 'SKU can\'t be changed once created — it\'s used by every past record.' : 'Choose carefully — this becomes permanent once saved.' },
      { key: 'name', label: 'Product name', required: true },
      { key: 'flavour', label: 'Flavour' },
      { key: 'size', label: 'Size', placeholder: 'e.g. 250ml' },
      { key: 'unit', label: 'Unit', placeholder: 'e.g. Bottle' },
      { key: 'packSize', label: 'Pack size', type: 'number' },
      { key: 'price', label: 'Selling price', type: 'number', required: true }
    ];
    if (showCost) fields.push({ key: 'cost', label: 'Cost price', type: 'number' });
    fields.push({ key: 'shelfLife', label: 'Shelf life (days)', type: 'number' });
    fields.push({ key: 'active', label: 'Active', type: 'checkbox', checkboxLabel: 'Active' });

    openModal({
      title: existing ? 'Edit product' : 'Add product',
      fields: fields,
      initialValues: existing || { active: true },
      onSubmit: function (values) {
        if (existing && values.sku !== existing.sku) values.sku = existing.sku; // immutable, ignore any tampering
        return apiCall('saveProduct', TOKEN, values);
      },
      onSuccess: function () { initProducts(container); }
    });

    // SKU is the key — lock the field once editing an existing product.
    if (existing) {
      var skuInput = document.getElementById('mf_sku');
      if (skuInput) skuInput.disabled = true;
    }
  }
})();
