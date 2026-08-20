// The real recommender: a deterministic grid-search over calc.js's existing pure
// functions (exact, instant, no approximation) — NOT a trained model. GPU sizing,
// node counts, and the hybrid split all have a closed-form answer already; a model
// trained on synthetic data generated from that same math would only reintroduce
// error for no gain. The one judgment call the formulas don't cleanly express —
// whether a given local-model/GPU pairing is under/well/over-utilized for the
// predicted load — is delegated to the trained classifier in treeModel.js.
import { MODELS, PURPOSES, GPUS } from '../data.js'
import {
  fitScore, valueScore, apiCost, tokensPerMonth,
  nodesFor, nodeCapex, nodeMonthlyRun, peakConcurrentUsers, forecast, fmtFull,
} from '../calc.js'
import { predictRisk } from './treeModel.js'
import { buildRiskFeatures } from './features.js'
import riskModel from '../ml/utilization-risk-model.json' with { type: 'json' }

const FRONTIER_MODELS = MODELS.filter((m) => !m.local)
const LOCAL_MODELS = MODELS.filter((m) => m.local)
const FRONTIER_STEPS = Array.from({ length: 21 }, (_, i) => i * 5) // 0, 5, ..., 100

// 0 = best (no waste, or genuinely well-matched); 2 = worst (hardware bought and idle).
function riskRank(risk, nodes) {
  if (nodes === 0) return 0
  return { well_utilized: 0, overutilized: 1, underutilized: 2 }[risk.label]
}

// A model whose intensity falls far short of the workload's need is disqualified
// regardless of cost (some slack: a purpose needing 4 tolerates a 3). Without this
// gate, cost-minimization alone would happily downgrade an agentic workload to the
// cheapest tiny model — the quality bar has to hold before cost/utilization compete.
function meetsQualityBar(lm, p) {
  return lm.intensity >= p.intensityNeed - 1
}

// valueScore (fit per $1k/mo) alone almost always favors the cheapest tier, since
// API price varies ~100x across models while fit varies only ~2x — so pure
// value-maximization degenerates into "always recommend the cheapest model"
// regardless of purpose. Gating on quality first, then maximizing value among
// candidates that actually clear the bar, is what keeps the pick purpose-sensitive.
function pickFrontierModel(S0, p, t) {
  const qualified = FRONTIER_MODELS.filter((m) => meetsQualityBar(m, p))
  const pool = qualified.length ? qualified : FRONTIER_MODELS

  let best = null
  for (const m of pool) {
    const cost = apiCost(m, t.inTok, t.outTok)
    const val = valueScore(m, p, cost)
    const fit = fitScore(m, p)
    const better = !best || val > best.val || (val === best.val && fit > best.fit) ||
      (val === best.val && fit === best.fit && cost < best.cost)
    if (better) best = { m, cost, val, fit }
  }
  return best
}

// Sizes the local model + GPU platform against the CURRENT frontier% as the
// reference local share (breaks the circularity: sizing needs a share assumption,
// the final split search below needs a model/GPU already chosen).
//
// Selection order is deliberately (1) risk rank, (2) cost, (3) fit — NOT fit-first.
// Fit-first would always pick the biggest/highest-quality open model (Llama 3.1
// 405B has the top quality+intensity score for every purpose, so it wins every
// fit-based tie-break outright) regardless of whether the usage volume justifies
// it. Gating on quality first, then minimizing cost among well-utilized options,
// is what actually makes the recommendation usage-aware.
function pickLocalModelAndGpu(S0, p, t) {
  const localShare = 1 - S0.frontier / 100
  const localOutTok = t.outTok * localShare
  const peakUsersLocal = peakConcurrentUsers(S0) * localShare

  const qualified = LOCAL_MODELS.filter((lm) => meetsQualityBar(lm, p))
  const pool = qualified.length ? qualified : LOCAL_MODELS // fallback: nothing clears the bar, consider all

  let best = null
  for (const lm of pool) {
    const fit = fitScore(lm, p)
    for (const g of GPUS) {
      const S1 = { ...S0, localModel: lm.id, gpu: g.id }
      const nodes = nodesFor(S1, localOutTok, peakUsersLocal)
      const risk = nodes === 0
        ? { label: 'no_local_hosting', confidence: 1 }
        : predictRisk(riskModel, buildRiskFeatures(S1, g.id, lm.id))
      const monthlyCost = nodes * nodeMonthlyRun(S1) +
        (S1.owns === 'yes' ? 0 : (nodes * nodeCapex(S1)) / (S1.dep * 12))
      const rank = riskRank(risk, nodes)
      const candidate = { lm, g, nodes, risk, monthlyCost, fit, rank }
      const better = !best || rank < best.rank ||
        (rank === best.rank && monthlyCost < best.monthlyCost) ||
        (rank === best.rank && monthlyCost === best.monthlyCost && fit > best.fit)
      if (better) best = candidate
    }
  }
  return best
}

// Grid-searches frontier% (with model/localModel/gpu already fixed) to minimize
// forecast()'s cumulative hybrid cost over the scenario's horizon.
function pickFrontierSplit(S0, frontierPick, localPick) {
  let best = null
  for (const fp of FRONTIER_STEPS) {
    const S2 = {
      ...S0,
      model: frontierPick.m.id, pin: frontierPick.m.in, pout: frontierPick.m.out,
      localModel: localPick.lm.id, gpu: localPick.g.id, frontier: fp,
    }
    const f = forecast(S2)
    if (!best || f.cumHybrid < best.f.cumHybrid) best = { fp, f }
  }
  return best
}

function buildRationale(p, frontierPick, localPick, splitPick) {
  const frontier =
    `Best balance of quality and intensity for ${p.name} at ${fmtFull(frontierPick.cost)}/mo API cost.`

  let local
  if (localPick.nodes === 0) {
    local = `At this usage level, self-hosting doesn't clear the bar yet — staying on the frontier API is cheaper than buying dedicated hardware.`
  } else {
    const gpuName = localPick.g.name.replace(/^\d+× /, '')
    const pct = Math.round((localPick.risk.confidence ?? 0) * 100)
    if (localPick.risk.label === 'underutilized') {
      local = `Would sit mostly idle at this seat count on ${gpuName} (${pct}% confidence) — a smaller GPU or fewer local seats would use hardware more efficiently.`
    } else if (localPick.risk.label === 'overutilized') {
      local = `Leaves little headroom for traffic bursts on ${gpuName} (${pct}% confidence) — consider an extra node or a lower SLA target.`
    } else {
      local = `Right-sized for this workload on ${gpuName} (${pct}% confidence well-utilized).`
    }
  }

  const split = `${splitPick.fp}% kept on the frontier API minimizes total spend over the forecast horizon.`

  return { frontier, local, split }
}

export function recommendFor(purposeKey, baseS) {
  const p = PURPOSES[purposeKey]
  const S0 = { ...baseS, purpose: purposeKey }
  const t = tokensPerMonth(S0)

  const frontierPick = pickFrontierModel(S0, p, t)
  const localPick = pickLocalModelAndGpu(S0, p, t)
  const splitPick = pickFrontierSplit(S0, frontierPick, localPick)

  return {
    frontierModel: frontierPick.m.id,
    frontierPin: frontierPick.m.in,
    frontierPout: frontierPick.m.out,
    localModel: localPick.lm.id,
    gpu: localPick.g.id,
    frontierPct: splitPick.fp,
    nodes: splitPick.f.cur.nodes,
    risk: localPick.risk,
    fitScoreFrontier: frontierPick.fit,
    fitScoreLocal: localPick.fit,
    rationale: buildRationale(p, frontierPick, localPick, splitPick),
  }
}
