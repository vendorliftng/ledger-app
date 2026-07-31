/* Ledger admin — the one reusable data table: search, column filters,
   sortable headers, CSV export. Every admin list screen is built on this.

   renderDataTable(container, {
     columns: [{ key, label, type: 'text'|'num'|'code', render?(val,row) }],
     rows: [...],                 // plain array of objects
     rowKey(row) -> string,       // unique id, used for row click wiring
     searchable: ['name','sku'],  // which keys the search box matches against
     filters: [{ key, label, options: [...] }],
     onRowClick?(row),
     onAdd?(), addLabel?: 'Add marketer',
     csvFilename?: 'marketers.csv',
     onToggleActive?(row, buttonEl), // if set, the 'active' column becomes a
                                      // one-click Active/Inactive button —
                                      // matches how a checkbox column feels
                                      // on the Sheet, no modal needed just to
                                      // flip a status
     rowClass?(row) -> string        // extra class(es) on that row's <tr>
   })
*/

function renderDataTable(container, opts) {
  var state = { search: '', filters: {}, sortKey: opts.defaultSort || null, sortDir: 'asc' };

  var wrap = document.createElement('div');
  wrap.innerHTML =
    '<div class="toolbar">' +
      (opts.searchable && opts.searchable.length ? '<input type="search" placeholder="Search…" class="dt-search">' : '') +
      (opts.filters || []).map(function (f) {
        return '<select class="dt-filter" data-key="' + f.key + '">' +
          '<option value="">' + escapeHtml(f.label) + ' — all</option>' +
          f.options.map(function (o) {
            var ov = (o && typeof o === 'object') ? o.value : o;
            var ol = (o && typeof o === 'object') ? o.label : o;
            return '<option value="' + escapeHtml(ov) + '">' + escapeHtml(ol) + '</option>';
          }).join('') +
          '</select>';
      }).join('') +
      '<span class="spacer"></span>' +
      '<span class="count dt-count"></span>' +
      (opts.csvFilename ? '<button type="button" class="ghost dt-export"></button>' : '') +
      (opts.onAdd ? '<button type="button" class="dt-add">' + escapeHtml(opts.addLabel || 'Add') + '</button>' : '') +
    '</div>' +
    '<div class="table-wrap"><table class="data-table"><thead><tr>' +
      opts.columns.map(function (c) { return '<th data-key="' + c.key + '">' + escapeHtml(c.label) + '</th>'; }).join('') +
    '</tr></thead><tbody class="dt-body"></tbody></table></div>';

  container.appendChild(wrap);

  var searchEl = wrap.querySelector('.dt-search');
  var filterEls = wrap.querySelectorAll('.dt-filter');
  var countEl = wrap.querySelector('.dt-count');
  var bodyEl = wrap.querySelector('.dt-body');
  var headEls = wrap.querySelectorAll('thead th');
  var exportBtn = wrap.querySelector('.dt-export');
  var addBtn = wrap.querySelector('.dt-add');

  if (searchEl) searchEl.addEventListener('input', function () { state.search = searchEl.value.toLowerCase(); render(); });
  filterEls.forEach(function (sel) {
    sel.addEventListener('change', function () {
      var key = sel.getAttribute('data-key');
      if (sel.value) state.filters[key] = sel.value; else delete state.filters[key];
      render();
    });
  });
  headEls.forEach(function (th) {
    th.addEventListener('click', function () {
      var key = th.getAttribute('data-key');
      if (state.sortKey === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      else { state.sortKey = key; state.sortDir = 'asc'; }
      render();
    });
  });
  if (exportBtn) exportBtn.addEventListener('click', function () {
    downloadCsv(opts.csvFilename, rowsToCsv(opts.columns, getFilteredRows()));
  });
  if (addBtn) addBtn.addEventListener('click', function () { opts.onAdd(); });

  function getFilteredRows() {
    var rows = opts.rows.filter(function (r) {
      if (state.search && opts.searchable) {
        var hit = opts.searchable.some(function (k) {
          return String(r[k] == null ? '' : r[k]).toLowerCase().indexOf(state.search) !== -1;
        });
        if (!hit) return false;
      }
      for (var key in state.filters) {
        if (String(r[key]) !== state.filters[key]) return false;
      }
      return true;
    });
    if (state.sortKey) {
      rows = rows.slice().sort(function (a, b) {
        var av = a[state.sortKey], bv = b[state.sortKey];
        if (av == null) av = '';
        if (bv == null) bv = '';
        var cmp = (typeof av === 'number' && typeof bv === 'number') ? av - bv : String(av).localeCompare(String(bv));
        return state.sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return rows;
  }

  function render() {
    var rows = getFilteredRows();
    countEl.textContent = rows.length + ' of ' + opts.rows.length;
    if (exportBtn) exportBtn.textContent = 'Export CSV (' + rows.length + ')';

    headEls.forEach(function (th) {
      th.classList.remove('sort-asc', 'sort-desc');
      if (th.getAttribute('data-key') === state.sortKey) th.classList.add(state.sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    });

    bodyEl.innerHTML = rows.length ? rows.map(function (r, i) {
      var cells = opts.columns.map(function (c) {
        var val = r[c.key];
        var display;
        if (c.key === 'active' && opts.onToggleActive) {
          display = '<button type="button" class="badge-toggle badge ' + (val ? 'ok' : 'muted') + '" data-toggle-idx="' + i + '">' +
            (val ? 'Active' : 'Inactive') + '</button>';
        } else {
          display = c.render ? c.render(val, r) : escapeHtml(val);
        }
        var cls = c.type === 'num' ? 'num' : (c.type === 'code' ? 'code' : '');
        return '<td class="' + cls + '">' + display + '</td>';
      }).join('');
      var rowCls = (opts.onRowClick ? 'clickable' : '') + (opts.rowClass ? ' ' + opts.rowClass(r) : '');
      return '<tr class="' + rowCls + '" data-id="' + escapeHtml(opts.rowKey ? opts.rowKey(r) : '') + '">' + cells + '</tr>';
    }).join('') : '<tr><td colspan="' + opts.columns.length + '" class="admin-empty">No matching rows.</td></tr>';

    if (opts.onRowClick) {
      Array.prototype.forEach.call(bodyEl.querySelectorAll('tr[data-id]'), function (tr, i) {
        tr.addEventListener('click', function () { opts.onRowClick(rows[i]); });
      });
    }

    if (opts.onToggleActive) {
      Array.prototype.forEach.call(bodyEl.querySelectorAll('.badge-toggle'), function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation(); // don't also open the row's edit modal
          var idx = Number(btn.getAttribute('data-toggle-idx'));
          opts.onToggleActive(rows[idx], btn);
        });
      });
    }
  }

  render();
  return { refresh: render };
}

function rowsToCsv(columns, rows) {
  function esc(v) {
    v = v == null ? '' : String(v);
    if (/[",\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
    return v;
  }
  var lines = [columns.map(function (c) { return esc(c.label); }).join(',')];
  rows.forEach(function (r) {
    lines.push(columns.map(function (c) { return esc(r[c.key]); }).join(','));
  });
  return lines.join('\r\n');
}

/**
 * Common pattern behind every onToggleActive handler: flip the value,
 * disable the button while it's in flight, submit, then either reload
 * (success) or re-enable and leave it as-is with the server's reason
 * (rejection — e.g. a location that's still an active parent of another).
 */
function handleActiveToggle(row, btn, submitFn, reloadFn) {
  var newActive = !row.active;
  btn.disabled = true;
  submitFn(newActive)
    .then(function (res) {
      if (res && res.ok === false) {
        toast(res.message, true);
        btn.disabled = false;
        return;
      }
      toast(newActive ? 'Marked active.' : 'Marked inactive.', false);
      reloadFn();
    })
    .catch(function () {
      toast('Could not update — check your connection.', true);
      btn.disabled = false;
    });
}

function downloadCsv(filename, csvText) {
  var blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}
