import { PURPOSES, gpu, model } from './data.js'

// ---------- formatting ----------
export const fmt = (n) => {
  if (!isFinite(n)) return '—'
  const a = Math.abs(n)
  if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'
  if (a >= 1e3) return '$' + (n / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'K'
  return '$' + Math.round(n).toLocaleString('en-US')
}
export const fmtFull = (n) => (isFinite(n) ? '$' + Math.round(n).toLocaleString('en-US') : '—')
export const pct = (n) => (n >= 0 ? '+' : '') + n.toFixed(0) + '%'
export const num = (n) => Math.round(n).toLocaleString('en-US')

const purpose = (S) => PURPOSES[S.purpose]

// Fit score (0–100): purpose-weighted blend of a model's quality & intensity.
export function fitScore(m, P) {
  return 100 * (P.wQ * (m.quality / 5) + P.wI * (m.intensity / 5))
}
// Value score: fit delivered per $1k/month of API spend (null for GPU-only models).
export function valueScore(m, P, monthlyCost) {
  if (monthlyCost == null || monthlyCost <= 0) return null
  return fitScore(m, P) / (monthlyCost / 1000)
}

// ---------- core math ----------
export function monthlyCalls(S) {
  return S.seats * S.tasks * S.days * S.calls
}
export function tokensPerMonth(S) {
  const p = purpose(S), c = monthlyCalls(S)
  return { inTok: c * p.in, outTok: c * p.out, calls: c }
}
// API $/month for a given model at full volume
export function apiCost(m, inTok, outTok) {
  return (inTok / 1e6) * m.in + (outTok / 1e6) * m.out
}
export function apiCostSelected(S, inTok, outTok) {
  return (inTok / 1e6) * S.pin + (outTok / 1e6) * S.pout
}
// per-node sustained throughput (tokens/sec) for the selected local model.
// A node is rated for a ~70B dense model; larger models serve fewer tok/s, smaller more.
export function nodeEffTps(S) {
  const g = gpu(S.gpu)
  const lm = model(S.localModel)
  const factor = lm && lm.tpsFactor ? lm.tpsFactor : 1
  return g.tps * factor
}

// convert a monthly output-token volume into average & peak generation rates (tokens/sec).
// peak = avg × traffic burst factor — sizing must serve the peak, not the monthly average.
export function rateStats(S, outTokMonth) {
  const activeSec = Math.max(1, S.days) * 24 * 3600
  const avgTps = outTokMonth / activeSec
  const peakTps = avgTps * Math.max(1, S.peak || 1)
  return { avgTps, peakTps, activeSec }
}

// peak concurrent users = seats × concurrency%, so it scales with team size.
export function peakConcurrentUsers(S) {
  return (S.seats || 0) * ((S.concPct || 0) / 100)
}

// how many concurrent user streams one node can serve while still meeting the
// per-user latency SLA (tokens/sec/user). Aggregate node throughput split across
// N streams gives nodeEffTps/N each; keep that ≥ SLA → N ≤ nodeEffTps / SLA.
export function maxStreamsPerNode(S) {
  const sla = Math.max(1, S.slaTps || 1)
  return Math.max(1, Math.floor(nodeEffTps(S) / sla))
}

// constraint 1 — THROUGHPUT: nodes to serve the peak token-generation rate with headroom.
export function nodesThroughput(S, outTokMonth) {
  if (outTokMonth <= 0) return 0
  const usable = nodeEffTps(S) * (S.util / 100)
  const { peakTps } = rateStats(S, outTokMonth)
  return Math.max(1, Math.ceil(peakTps / usable))
}

// constraint 2 — CONCURRENCY / SLA: nodes to serve peak simultaneous users at the SLA speed.
export function nodesConcurrency(S, peakUsersEff) {
  if (!peakUsersEff || peakUsersEff <= 0) return 0
  return Math.ceil(peakUsersEff / maxStreamsPerNode(S))
}

// nodes required = the binding constraint (max of throughput and concurrency).
// Driven by: local model (nodeEffTps), users×tasks×traffic (peakTps), SLA + peak
// concurrent users (concurrency), and util target (headroom to balance workload).
export function nodesFor(S, outTokMonth, peakUsersEff) {
  return Math.max(nodesThroughput(S, outTokMonth), nodesConcurrency(S, peakUsersEff))
}
export function nodeMonthlyRun(S) {
  // opex + subscription per node per month (recurring, excl capex)
  return (S.opex + S.sub) / 12
}
export function nodeCapex(S) {
  const g = gpu(S.gpu)
  return g.capex * (1 - S.disc / 100)
}

// build month-by-month forecast
export function forecast(S) {
  const t = tokensPerMonth(S)
  const base = { inTok: t.inTok, outTok: t.outTok }
  const months = S.horizon * 12
  const localShare = 1 - S.frontier / 100

  let cumApi = 0, cumHybrid = 0
  let payback = null
  const apiSeries = [], hybSeries = [], labels = []
  let curNodes0 = 0

  for (let m = 1; m <= months; m++) {
    const mult = Math.pow(1 + S.growth / 100, (m - 1) / 12)
    const inTok = base.inTok * mult, outTok = base.outTok * mult

    // baseline: all frontier API on selected model
    const apiM = apiCostSelected(S, inTok, outTok)
    cumApi += apiM

    // hybrid: frontier share on API + local for the rest
    const fInTok = inTok * (S.frontier / 100), fOutTok = outTok * (S.frontier / 100)
    const frontierApiM = apiCostSelected(S, fInTok, fOutTok)

    const localOutTok = outTok * localShare
    const peakUsersLocal = peakConcurrentUsers(S) * localShare * mult
    const needNodes = nodesFor(S, localOutTok, peakUsersLocal)
    // buy nodes as needed (unless owned)
    let capexM = 0
    if (S.owns !== 'yes') {
      if (needNodes > curNodes0) { capexM = (needNodes - curNodes0) * nodeCapex(S); curNodes0 = needNodes }
    } else { curNodes0 = needNodes }
    const runM = needNodes * nodeMonthlyRun(S)
    const hybM = frontierApiM + runM + capexM
    cumHybrid += hybM

    if (payback === null && cumHybrid <= cumApi && m > 1) payback = m

    apiSeries.push(cumApi); hybSeries.push(cumHybrid)
    labels.push(m)
  }

  // current (month-1) monthly figures
  const cur = {
    apiMonth: apiCostSelected(S, base.inTok, base.outTok),
    frontierMonth: apiCostSelected(S, base.inTok * (S.frontier / 100), base.outTok * (S.frontier / 100)),
    nodes: nodesFor(S, base.outTok * localShare, peakConcurrentUsers(S) * localShare),
  }
  cur.runMonth = cur.nodes * nodeMonthlyRun(S)
  cur.hybridMonth = cur.frontierMonth + cur.runMonth + (S.owns === 'yes' ? 0 : (cur.nodes * nodeCapex(S)) / (S.dep * 12))
  cur.savingMonth = cur.apiMonth - cur.hybridMonth

  return { apiSeries, hybSeries, labels, payback, cur, months, cumApi, cumHybrid, tokens: t }
}
