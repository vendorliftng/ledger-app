/* Ledger admin — Settings. Owner only. A grouped form, not a data table —
   there's a small fixed set of business configuration values. The Telegram
   Bot Token renders masked with a reveal toggle even though only Owner can
   ever reach this screen at all (defense in depth, and it discourages
   shoulder-surfing on a shared office screen). */

(function () {
  registerScreen('settings', '10', 'Settings', 'settings', initSettings);

  var GROUPS = [
    { title: 'Business', fields: ['Business Name', 'Currency Symbol'] },
    { title: 'Alerts & tolerances', fields: [
      'Expiry Alert Days', 'Stock Variance Tolerance (units)', 'Cash Variance Tolerance (NGN)', 'Credit Due Days'
    ] },
    { title: 'Daily digest (Telegram)', fields: [
      'Daily Digest Time (hour, 0-23)', 'Telegram Chat ID', 'Telegram Bot Token'
    ] }
  ];

  function fieldId(name) { return 'set_' + name.replace(/[^a-zA-Z0-9]/g, '_'); }

  function initSettings(container) {
    container.innerHTML = '<div class="admin-empty">Loading…</div>';
    apiCall('getSettings', TOKEN, {})
      .then(function (res) {
        if (isAuthError(res)) { window.location.href = 'index.html'; return; }
        if (res.ok === false) { container.innerHTML = '<div class="admin-error">' + escapeHtml(res.message) + '</div>'; return; }
        render(container, res.settings);
      })
      .catch(function () {
        container.innerHTML = '<div class="admin-error">Could not load settings. Check your connection and retry.</div>';
      });
  }

  function render(container, settings) {
    var byName = {};
    settings.forEach(function (s) { byName[s.name] = s; });

    var html = '<form id="settingsForm" style="max-width:560px">';
    GROUPS.forEach(function (group) {
      html += '<div class="eyebrow" style="margin:24px 0 10px">' + escapeHtml(group.title) + '</div><div class="card">';
      group.fields.forEach(function (name) {
        var s = byName[name] || { name: name, value: '', notes: '' };
        var isToken = name === 'Telegram Bot Token';
        var id = fieldId(name);
        html += '<label><span class="lbl">' + escapeHtml(name) + '</span>';
        if (isToken) {
          html += '<div style="display:flex;gap:8px">' +
            '<input type="password" id="' + id + '" value="' + escapeHtml(s.value) + '" style="flex:1">' +
            '<button type="button" class="ghost" style="width:auto;margin-top:0" data-reveal="' + id + '">Show</button>' +
          '</div>';
        } else {
          html += '<input type="text" id="' + id + '" value="' + escapeHtml(s.value) + '">';
        }
        html += '</label>';
        if (s.notes) html += '<div style="font-size:12.5px;color:var(--steel);margin-top:-2px">' + escapeHtml(s.notes) + '</div>';
      });
      html += '</div>';
    });
    html += '<button type="submit">Save settings</button></form>';

    container.innerHTML = html;

    Array.prototype.forEach.call(container.querySelectorAll('[data-reveal]'), function (btn) {
      btn.addEventListener('click', function () {
        var input = document.getElementById(btn.getAttribute('data-reveal'));
        var showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        btn.textContent = showing ? 'Show' : 'Hide';
      });
    });

    document.getElementById('settingsForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var values = {};
      GROUPS.forEach(function (g) {
        g.fields.forEach(function (name) {
          var input = document.getElementById(fieldId(name));
          if (input) values[name] = input.value;
        });
      });

      var btn = e.target.querySelector('button[type="submit"]');
      var original = btn.textContent;
      btn.disabled = true; btn.textContent = 'Saving…';
      apiCall('saveSettings', TOKEN, { values: values })
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
})();
