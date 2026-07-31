/* Ledger admin — hand-rolled inline-SVG charts. No external library/CDN,
   matching the rest of this project. Colors are passed as CSS custom
   property references (e.g. 'var(--chill)') so they inherit the page's
   theme automatically. */

/**
 * points: [{ label, value }], already in chronological order.
 * opts: { width, height, color, formatValue(v) }
 */
function lineChartSVG(points, opts) {
  opts = opts || {};
  var width = opts.width || 560, height = opts.height || 180;
  var padL = 46, padR = 12, padT = 14, padB = 26;
  var innerW = width - padL - padR, innerH = height - padT - padB;
  var color = opts.color || 'var(--chill)';
  var fmt = opts.formatValue || function (v) { return String(Math.round(v)); };

  if (!points.length) {
    return '<svg viewBox="0 0 ' + width + ' ' + height + '" width="100%" height="' + height + '"></svg>' +
      '<div class="admin-empty">No data yet for this window.</div>';
  }

  var values = points.map(function (p) { return p.value; });
  var maxV = Math.max.apply(null, values.concat([0]));
  var minV = Math.min.apply(null, values.concat([0]));
  if (maxV === minV) maxV = minV + 1;

  function x(i) { return padL + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW); }
  function y(v) { return padT + innerH - ((v - minV) / (maxV - minV)) * innerH; }

  var linePts = points.map(function (p, i) { return x(i) + ',' + y(p.value); }).join(' ');
  var areaPts = linePts + ' ' + x(points.length - 1) + ',' + (padT + innerH) + ' ' + x(0) + ',' + (padT + innerH);

  var gridLines = '';
  var steps = 3;
  for (var g = 0; g <= steps; g++) {
    var gv = minV + (maxV - minV) * (g / steps);
    var gy = y(gv);
    gridLines += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (width - padR) + '" y2="' + gy + '" stroke="var(--rule)" stroke-width="1"/>';
    gridLines += '<text x="' + (padL - 8) + '" y="' + (gy + 4) + '" text-anchor="end" font-family="var(--data)" font-size="10" fill="var(--steel)">' + escapeHtml(fmt(gv)) + '</text>';
  }

  var xLabels = '';
  var labelIdxs = points.length > 1 ? [0, Math.floor((points.length - 1) / 2), points.length - 1] : [0];
  labelIdxs.forEach(function (i) {
    xLabels += '<text x="' + x(i) + '" y="' + (height - 6) + '" text-anchor="middle" font-family="var(--data)" font-size="10" fill="var(--steel)">' + escapeHtml(points[i].label) + '</text>';
  });

  var last = points[points.length - 1];

  return '<svg viewBox="0 0 ' + width + ' ' + height + '" width="100%" height="' + height + '" preserveAspectRatio="xMidYMid meet">' +
    gridLines +
    '<polygon points="' + areaPts + '" fill="' + color + '" opacity="0.09"></polygon>' +
    '<polyline points="' + linePts + '" fill="none" stroke="' + color + '" stroke-width="2"></polyline>' +
    '<circle cx="' + x(points.length - 1) + '" cy="' + y(last.value) + '" r="4" fill="' + color + '"></circle>' +
    '<text x="' + x(points.length - 1) + '" y="' + (y(last.value) - 10) + '" text-anchor="end" font-family="var(--data)" font-size="12" font-weight="600" fill="' + color + '">' + escapeHtml(fmt(last.value)) + '</text>' +
    xLabels +
  '</svg>';
}

/** categories: [label,...], values: [number,...], same length. */
function barChartSVG(categories, values, opts) {
  opts = opts || {};
  var width = opts.width || 560, height = opts.height || 180;
  var padL = 46, padR = 12, padT = 14, padB = 30;
  var innerW = width - padL - padR, innerH = height - padT - padB;
  var color = opts.color || 'var(--chill)';
  var maxV = Math.max.apply(null, values.concat([1]));
  var gap = innerW / values.length;
  var barW = gap * 0.6;

  var bars = values.map(function (v, i) {
    var h = (v / maxV) * innerH;
    var bx = padL + i * gap + (gap - barW) / 2;
    var by = padT + innerH - h;
    return '<rect x="' + bx + '" y="' + by + '" width="' + barW + '" height="' + h + '" fill="' + color + '"></rect>' +
      '<text x="' + (bx + barW / 2) + '" y="' + (height - 10) + '" text-anchor="middle" font-family="var(--data)" font-size="10" fill="var(--steel)">' + escapeHtml(String(categories[i])) + '</text>';
  }).join('');

  return '<svg viewBox="0 0 ' + width + ' ' + height + '" width="100%" height="' + height + '">' +
    '<line x1="' + padL + '" y1="' + (padT + innerH) + '" x2="' + (width - padR) + '" y2="' + (padT + innerH) + '" stroke="var(--rule)"></line>' +
    bars +
  '</svg>';
}
