"""Line-for-line Python port of the pure math in ../../src/calc.js.

This is the label source for synthetic training data — it must stay numerically
identical to calc.js. Re-check with parity_check.py after any edit to either file.
Data (MODELS/PURPOSES/GPUS/RAMP/EFF_BAND/OPEX_REF) comes from data.json, generated
by export_data.mjs directly from src/data.js — never hand-copy those values here.
"""
import json
import math
from pathlib import Path

_DATA = json.loads((Path(__file__).parent / "data.json").read_text())
MODELS = {m["id"]: m for m in _DATA["MODELS"]}
PURPOSES = _DATA["PURPOSES"]
GPUS = {g["id"]: g for g in _DATA["GPUS"]}


def fit_score(m, p):
    """calc.js fitScore(m, P)"""
    return 100 * (p["wQ"] * (m["quality"] / 5) + p["wI"] * (m["intensity"] / 5))


def monthly_calls(seats, tasks, days, calls):
    """calc.js monthlyCalls(S)"""
    return seats * tasks * days * calls


def tokens_per_month(purpose, seats, tasks, days, calls):
    """calc.js tokensPerMonth(S)"""
    c = monthly_calls(seats, tasks, days, calls)
    return {"inTok": c * purpose["in"], "outTok": c * purpose["out"], "calls": c}


def api_cost_selected(pin, pout, in_tok, out_tok):
    """calc.js apiCostSelected(S, inTok, outTok)"""
    return (in_tok / 1e6) * pin + (out_tok / 1e6) * pout


def node_eff_tps(gpu_id, local_model_id):
    """calc.js nodeEffTps(S)"""
    g = GPUS[gpu_id]
    lm = MODELS[local_model_id]
    factor = lm.get("tpsFactor") or 1
    return g["tps"] * factor


def rate_stats(days, out_tok_month, peak):
    """calc.js rateStats(S, outTokMonth)"""
    active_sec = max(1, days) * 24 * 3600
    avg_tps = out_tok_month / active_sec
    peak_tps = avg_tps * max(1, peak or 1)
    return {"avgTps": avg_tps, "peakTps": peak_tps, "activeSec": active_sec}


def peak_concurrent_users(seats, conc_pct):
    """calc.js peakConcurrentUsers(S)"""
    return (seats or 0) * ((conc_pct or 0) / 100)


def max_streams_per_node(gpu_id, local_model_id, sla_tps):
    """calc.js maxStreamsPerNode(S)"""
    sla = max(1, sla_tps or 1)
    return max(1, math.floor(node_eff_tps(gpu_id, local_model_id) / sla))


def nodes_throughput(gpu_id, local_model_id, util, days, out_tok_month, peak):
    """calc.js nodesThroughput(S, outTokMonth)"""
    if out_tok_month <= 0:
        return 0
    usable = node_eff_tps(gpu_id, local_model_id) * (util / 100)
    peak_tps = rate_stats(days, out_tok_month, peak)["peakTps"]
    return max(1, math.ceil(peak_tps / usable))


def nodes_concurrency(gpu_id, local_model_id, sla_tps, peak_users_eff):
    """calc.js nodesConcurrency(S, peakUsersEff)"""
    if not peak_users_eff or peak_users_eff <= 0:
        return 0
    return math.ceil(peak_users_eff / max_streams_per_node(gpu_id, local_model_id, sla_tps))


def nodes_for(gpu_id, local_model_id, util, days, out_tok_month, peak, sla_tps, peak_users_eff):
    """calc.js nodesFor(S, outTokMonth, peakUsersEff) — binding constraint = max of the two."""
    return max(
        nodes_throughput(gpu_id, local_model_id, util, days, out_tok_month, peak),
        nodes_concurrency(gpu_id, local_model_id, sla_tps, peak_users_eff),
    )


def node_monthly_run(opex, sub):
    """calc.js nodeMonthlyRun(S)"""
    return (opex + sub) / 12


def node_capex(gpu_id, disc):
    """calc.js nodeCapex(S)"""
    return GPUS[gpu_id]["capex"] * (1 - disc / 100)


def utilization_ratio(gpu_id, local_model_id, util, days, out_tok_month, peak, sla_tps, peak_users_eff, nodes):
    """Not in calc.js — the fraction of provisioned capacity actually used, the
    quantity the risk classifier is trained to judge (calc.js only computes the
    *count* of nodes needed, never how slack that count is)."""
    if nodes <= 0:
        return 0.0
    usable = node_eff_tps(gpu_id, local_model_id) * (util / 100) * nodes
    peak_tps = rate_stats(days, out_tok_month, peak)["peakTps"]
    tput_ratio = (peak_tps / usable) if usable > 0 else 0.0
    streams_cap = max_streams_per_node(gpu_id, local_model_id, sla_tps) * nodes
    conc_ratio = (peak_users_eff / streams_cap) if streams_cap > 0 else 0.0
    return max(tput_ratio, conc_ratio)
