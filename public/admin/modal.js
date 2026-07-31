/* Ledger admin — the one reusable add/edit modal, driven by a field-config
   array. Every "Add"/edit-row screen is built on this.

   openModal({
     title: 'Add marketer',
     fields: [
       { key:'fullName', label:'Full name', required:true },
       { key:'phone', label:'Phone' },
       { key:'area', label:'Assigned area', type:'select', options:[...] },
       { key:'active', label:'Active', type:'checkbox', checkboxLabel:'Active' }
     ],
     initialValues: {...} | null,   // null/omitted = "Add" mode
     submitLabel: 'Save',
     onSubmit(values) -> Promise<{ok,message}>,
     onSuccess?(res)
   })
*/

function openModal(opts) {
  closeModal(); // only one at a time

  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'activeModal';

  var fieldsHtml = opts.fields.map(function (f) {
    var val = opts.initialValues ? opts.initialValues[f.key] : undefined;
    var input;

    if (f.type === 'select') {
      input = '<select id="mf_' + f.key + '">' +
        f.options.map(function (o) {
          var ov = (o && typeof o === 'object') ? o.value : o;
          var ol = (o && typeof o === 'object') ? o.label : o;
          return '<option value="' + escapeHtml(ov) + '"' + (String(val) === String(ov) ? ' selected' : '') + '>' + escapeHtml(ol) + '</option>';
        }).join('') + '</select>';
    } else if (f.type === 'checkbox') {
      input = '<label style="display:flex;align-items:center;gap:8px;margin-top:6px">' +
        '<input type="checkbox" id="mf_' + f.key + '" style="width:auto;min-height:auto"' + (val ? ' checked' : '') + '>' +
        '<span style="font-family:var(--body);font-size:14px;color:var(--ink);text-transform:none;letter-spacing:0">' +
          escapeHtml(f.checkboxLabel || 'Active') + '</span></label>';
    } else {
      input = '<input type="' + (f.type || 'text') + '" id="mf_' + f.key + '" value="' + escapeHtml(val == null ? '' : val) + '"' +
        (f.placeholder ? ' placeholder="' + escapeHtml(f.placeholder) + '"' : '') + '>';
    }

    var labelHtml = f.type === 'checkbox' ? '' : '<label for="mf_' + f.key + '"><span class="lbl">' + escapeHtml(f.label) + '</span></label>';
    return '<div class="modal-field">' + labelHtml + input +
      (f.help ? '<div style="font-size:12.5px;color:var(--steel);margin-top:4px">' + escapeHtml(f.help) + '</div>' : '') +
      '<div class="field-error" id="mf_err_' + f.key + '"></div></div>';
  }).join('');

  overlay.innerHTML =
    '<div class="modal-panel">' +
      '<h2>' + escapeHtml(opts.title) + '</h2>' +
      '<form id="modalForm">' + fieldsHtml +
        '<div class="modal-actions">' +
          '<button type="submit">' + escapeHtml(opts.submitLabel || 'Save') + '</button>' +
          '<button type="button" class="ghost" id="modalCancel">Cancel</button>' +
        '</div>' +
      '</form>' +
    '</div>';

  document.body.appendChild(overlay);

  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
  overlay.querySelector('#modalCancel').addEventListener('click', closeModal);
  document.addEventListener('keydown', escListener);

  overlay.querySelector('#modalForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var values = {};
    var valid = true;

    opts.fields.forEach(function (f) {
      var el = document.getElementById('mf_' + f.key);
      var errEl = document.getElementById('mf_err_' + f.key);
      errEl.textContent = '';
      var v = f.type === 'checkbox' ? el.checked : el.value;
      if (f.required && (v === '' || v == null)) {
        errEl.textContent = f.label + ' is required.';
        valid = false;
      }
      values[f.key] = v;
    });
    if (!valid) return;

    var submitBtn = overlay.querySelector('button[type="submit"]');
    var original = submitBtn.textContent;
    submitBtn.disabled = true; submitBtn.textContent = 'Saving…';

    opts.onSubmit(values)
      .then(function (res) {
        submitBtn.disabled = false; submitBtn.textContent = original;
        if (res && res.ok === false) { toast(res.message, true); return; }
        toast((res && res.message) || 'Saved.', false);
        closeModal();
        if (opts.onSuccess) opts.onSuccess(res);
      })
      .catch(function () {
        submitBtn.disabled = false; submitBtn.textContent = original;
        toast('Could not save — check your connection.', true);
      });
  });
}

function escListener(e) { if (e.key === 'Escape') closeModal(); }

function closeModal() {
  var el = document.getElementById('activeModal');
  if (el) el.remove();
  document.removeEventListener('keydown', escListener);
}
