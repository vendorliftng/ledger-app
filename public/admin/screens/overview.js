/* Ledger admin — Overview screen. Today's KPI cards + flagged marketers
   (reusing the exact getBootstrap data the mobile app's home screen uses),
   plus 30-day trend charts loaded in after the initial paint. */

(function () {
  registerScreen('overview', '01', 'Overview', null, initOverview);

  function initOverview(container, DATA) {
    var s = DATA.summary;
    var flagged = (s.recon || []).filter(function (r) { return r.status === 'FLAGGED'; });

    container.innerHTML =
      '<div class="kpi-row">' +
        kpi('Sales today', money(s.salesValue)) +
        kpi('Cash in', money(s.cashIn)) +
        kpi('On credit', money(s.credit)) +
        kpi('Expiring', s.expiring + (s.expiring === 1 ? ' batch' : ' batches'), s.expiring > 0) +
      '</div>' +
      '<div class="eyebrow" style="margin:28px 0 10px">Needs attention</div>' +
      (flagged.length
        ? '<div class="gauge-grid">' + flagged.map(gauge).join('') + '</div>'
        : '<div class="admin-empty">No variance flagged today — everyone reconciles clean so far.</div>') +
      '<div class="eyebrow" style="margin:32px 0 10px">Trends (last 30 days)</div>' +
      '<div class="chart-grid" id="trendCharts"><div class="admin-empty">Loading charts…</div></div>';

    loadTrends(container);
  }

  function kpi(label, value, warn) {
    return '<div class="stat' + (warn ? ' warn' : '') + '"><div class="k">' + label + '</div><div class="v">' + value + '</div></div>';
  }

  function loadTrends(container) {
    var target = container.querySelector('#trendCharts');
    var canSeeVariance = USER.role === 'Owner' || USER.role === 'Manager';

    Promise.all([
      apiCall('getRecentRecords', TOKEN, { tab: 'Sales', days: 30 }),
      apiCall('getRecentRecords', TOKEN, { tab: 'Cash Remittance', days: 30 }),
      canSeeVariance ? apiCall('getReconciliationHistory', TOKEN, { days: 30 }) : Promise.resolve({ ok: true, entries: [] })
    ]).then(function (results) {
      var salesRes = results[0], cashRes = results[1], reconRes = results[2];
      var salesByDay = groupSum(salesRes.records || [], 'Date', 'Amount');
      var cashByDay = groupSum(cashRes.records || [], 'Date', 'Amount');

      var cards =
        chartCard('Sales', lineChartSVG(salesByDay, { formatValue: money })) +
        chartCard('Cash remitted', lineChartSVG(cashByDay, { formatValue: money, color: 'var(--clear)' }));

      if (canSeeVariance) {
        cards += chartCard('Marketers flagged / day', lineChartSVG(groupFlaggedCount(reconRes.entries || []), { color: 'var(--short)' }));
      }

      cards += chartCard('Stock value', '<div class="admin-empty">Coming soon — needs a daily snapshot mechanism that doesn\'t exist yet (Cold Room Stock is a live-only view).</div>');

      target.innerHTML = cards;
    }).catch(function () {
      target.innerHTML = '<div class="admin-error">Could not load trend charts. Check your connection and refresh.</div>';
    });
  }

  function chartCard(title, inner) {
    return '<div class="chart-card"><div class="chart-title">' + escapeHtml(title) + '</div>' + inner + '</div>';
  }

  function groupSum(records, dateKey, valueKey) {
    var byDay = {};
    records.forEach(function (r) {
      var d = r[dateKey];
      byDay[d] = (byDay[d] || 0) + (Number(r[valueKey]) || 0);
    });
    return Object.keys(byDay).sort().map(function (d) { return { label: shortDate(d), value: byDay[d] }; });
  }

  function groupFlaggedCount(entries) {
    var flaggedByDay = {}, allDays = {};
    entries.forEach(function (r) {
      allDays[r.date] = true;
      if (r.status === 'FLAGGED') flaggedByDay[r.date] = (flaggedByDay[r.date] || 0) + 1;
    });
    return Object.keys(allDays).sort().map(function (d) { return { label: shortDate(d), value: flaggedByDay[d] || 0 }; });
  }

  function shortDate(iso) {
    var parts = String(iso).split('-');
    return parts.length === 3 ? parts[1] + '/' + parts[2] : iso;
  }
})();
