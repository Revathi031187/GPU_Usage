// Builds the raw (pre-encoding) feature object for the utilization-risk model.
// Column names must mirror tools/ml/train.py's NUMERIC_COLUMNS + CATEGORICAL_COLUMNS
// exactly — change one only together with the other, then rerun
// tools/ml/gen_synthetic.py -> train.py -> export_tree.py (see tools/ml/README.md).
import { PURPOSES, model, gpu } from '../data.js'
import { monthlyCalls, tokensPerMonth, peakConcurrentUsers } from '../calc.js'

export function buildRiskFeatures(S, gpuId, localModelId) {
  const p = PURPOSES[S.purpose]
  const g = gpu(gpuId)
  const lm = model(localModelId)
  const t = tokensPerMonth(S)
  return {
    seats: S.seats,
    tasks_per_day: S.tasks,
    days_active: S.days,
    calls_per_task: S.calls,
    growth_pct: S.growth,
    util_pct: S.util,
    peak_mult: S.peak,
    sla_tps: S.slaTps,
    conc_pct: S.concPct,
    gpu_tps: g.tps,
    gpu_capex: g.capex,
    local_model_params_b: lm.params || 0,
    local_model_tps_factor: lm.tpsFactor || 1,
    intensity_need: p.intensityNeed,
    monthly_calls: monthlyCalls(S),
    in_tok_month: t.inTok,
    out_tok_month: t.outTok,
    peak_concurrent_users: peakConcurrentUsers(S),
    purpose: S.purpose,
    gpu_id: gpuId,
    local_model_id: localModelId,
  }
}
