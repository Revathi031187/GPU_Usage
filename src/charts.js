import { fmt, fmtFull, pct } from './calc.js'
import { RAMP, ENTERPRISE_FLOOR, GARTNER_GROWTH } from './data.js'

// ---- forecast cumulative-spend chart ----
export function buildChart(S, f) {
  const W = 720, H = 260, pad = { l: 56, r: 16, t: 14, b: 26 }
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b
  const maxV = Math.max(f.apiSeries[f.apiSeries.length - 1], f.hybSeries[f.hybSeries.length - 1], 1)
  const n = f.labels.length
  const x = (i) => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * iw)
  const y = (v) => pad.t + ih - (v / maxV) * ih
  const path = (arr) => arr.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ')

  // gridlines (4)
  let g = ''
  for (let k = 0; k <= 4; k++) {
    const gv = (maxV * k) / 4, gy = y(gv)
    g += '<line class="grid" x1="' + pad.l + '" y1="' + gy.toFixed(1) + '" x2="' + (W - pad.r) + '" y2="' + gy.toFixed(1) + '"/>'
    g += '<text class="axtxt" x="' + (pad.l - 8) + '" y="' + (gy + 3).toFixed(1) + '" text-anchor="end">' + fmt(gv) + '</text>'
  }
  // year ticks
  let xt = ''
  for (let yr = 0; yr <= S.horizon; yr++) {
    const i = Math.min(n - 1, yr * 12 - 1); const xx = yr === 0 ? pad.l : x(i)
    xt += '<text class="axtxt" x="' + xx.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">Y' + yr + '</text>'
  }
  // savings fill (between api and hybrid where api>hybrid)
  const fillTop = f.apiSeries.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ')
  const fillBot = f.hybSeries.map((v, i) => 'L' + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).reverse().join(' ')
  const fill = '<path d="' + fillTop + ' ' + fillBot + ' Z" fill="var(--good)" opacity="0.10"/>'

  // payback marker
  let pbm = ''
  if (f.payback) {
    const i = f.payback - 1, px = x(i), py = y(f.hybSeries[i])
    pbm = '<line x1="' + px.toFixed(1) + '" y1="' + pad.t + '" x2="' + px.toFixed(1) + '" y2="' + (pad.t + ih) + '" stroke="var(--good)" stroke-dasharray="3 3" stroke-width="1"/>' +
      '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="5" fill="var(--good)" stroke="var(--surface)" stroke-width="2"/>'
  }
  // endpoints
  const eApi = '<circle cx="' + x(n - 1).toFixed(1) + '" cy="' + y(f.apiSeries[n - 1]).toFixed(1) + '" r="3.5" fill="var(--bad)"/>'
  const eHyb = '<circle cx="' + x(n - 1).toFixed(1) + '" cy="' + y(f.hybSeries[n - 1]).toFixed(1) + '" r="3.5" fill="var(--accent)"/>'

  const svg = g + fill +
    '<path d="' + path(f.apiSeries) + '" fill="none" stroke="var(--bad)" stroke-width="2.4"/>' +
    '<path d="' + path(f.hybSeries) + '" fill="none" stroke="var(--accent)" stroke-width="2.4"/>' +
    pbm + eApi + eHyb + xt

  const hint = 'over ' + S.horizon + ' yr · ' + pct(S.growth) + '/yr growth'

  // verdict callout
  const totalSave = f.cumApi - f.cumHybrid
  const pbTxt = f.payback ? (f.payback < 12 ? 'about ' + f.payback + ' months' : (f.payback / 12).toFixed(1) + ' years')
    : 'not within ' + S.horizon + ' years at these inputs'
  let verdict
  if (totalSave > 0) {
    verdict = '<span><b>' + fmt(totalSave) + '</b> cumulative saving over ' + S.horizon + ' years — the hybrid path pays back in <b>' + pbTxt + '</b>. ' +
      'Baseline all-API spend reaches <b>' + fmt(f.cumApi) + '</b> vs <b>' + fmt(f.cumHybrid) + '</b> hybrid.</span>'
  } else {
    verdict = '<span>At this scale the all-API path is still cheaper over ' + S.horizon + ' years (payback ' + pbTxt + '). ' +
      'Local GPU economics turn positive at higher volume, more owned hardware, or a larger local share.</span>'
  }

  return { svg, hint, verdict }
}

// ---- benchmark bar vs Ramp percentiles ----
export function buildBenchmark(S, f) {
  const x0 = 52, x1 = 668, yT = 60
  const spend = f.cur.apiMonth
  const lo = 10000, hi = Math.max(1000000, spend * 1.15)
  const lx = (v) => Math.log10(Math.max(lo, Math.min(hi, v)))
  const X = (v) => x0 + ((lx(v) - lx(lo)) / (lx(hi) - lx(lo))) * (x1 - x0)
  const marks = [
    { v: ENTERPRISE_FLOOR, l: fmt(ENTERPRISE_FLOOR) + ' floor' },
    { v: RAMP.p90, l: 'Ramp p90' },
    { v: RAMP.avg, l: 'Ramp avg' },
    { v: RAMP.p95, l: 'p95' },
    { v: RAMP.p99, l: 'p99' },
  ]
  let s = '<rect x="' + x0 + '" y="' + (yT - 3) + '" width="' + (x1 - x0) + '" height="6" rx="3" fill="var(--surface-3)"/>'
  s += '<rect x="' + x0 + '" y="' + (yT - 3) + '" width="' + Math.max(0, X(spend) - x0).toFixed(1) + '" height="6" rx="3" fill="var(--accent)" opacity="0.4"/>'
  marks.forEach((m) => {
    const xx = X(m.v).toFixed(1)
    s += '<line class="tick" x1="' + xx + '" y1="' + (yT - 8) + '" x2="' + xx + '" y2="' + (yT + 8) + '"/>'
    s += '<text class="tk-lab" x="' + xx + '" y="' + (yT + 22) + '" text-anchor="middle" style="font-size:9.5px">' + m.l + '</text>'
    s += '<text class="tk-lab" x="' + xx + '" y="' + (yT - 12) + '" text-anchor="middle" style="font-size:9px;opacity:.75">' + fmt(m.v) + '</text>'
  })
  const ux = X(spend).toFixed(1)
  s += '<polygon points="' + ux + ',' + (yT - 9) + ' ' + (ux - 5) + ',' + (yT - 17) + ' ' + (ux + 5) + ',' + (yT - 17) + '" fill="var(--accent)"/>'
  s += '<circle cx="' + ux + '" cy="' + yT + '" r="5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>'
  s += '<text x="' + ux + '" y="' + (yT - 24) + '" text-anchor="middle" style="fill:var(--accent-strong);font-size:11px;font-weight:700;font-family:var(--mono)">YOU ' + fmt(spend) + '</text>'

  let pos
  if (spend < ENTERPRISE_FLOOR) pos = '<b>below</b> the ' + fmt(ENTERPRISE_FLOOR) + ' mid-market floor — at this level frontier APIs usually beat owning a GPU node'
  else if (spend < RAMP.p90) pos = 'in the enterprise band, below Ramp’s 90th percentile (' + fmt(RAMP.p90) + '/mo)'
  else if (spend < RAMP.avg) pos = '<b>above</b> Ramp’s 90th percentile — heavier than most businesses'
  else if (spend < RAMP.p95) pos = 'around the Ramp <b>average</b> (' + fmtFull(RAMP.avg) + '/mo) — top decile of AI spenders'
  else if (spend < RAMP.p99) pos = 'between the 95th and 99th percentile — among the very heaviest AI spenders'
  else pos = '<b>above</b> Ramp’s 99th percentile (' + fmt(RAMP.p99) + '/mo) — hyperscale token spend'
  const note = '<span>Your all-API spend of <b class="num">' + fmt(spend) + '/mo</b> sits ' + pos + '. You model <b>' + pct(S.growth) + '/yr</b> growth vs Gartner’s <b>' + GARTNER_GROWTH + '%</b> industry forecast for 2026.</span>'

  return { svg: s, note }
}
