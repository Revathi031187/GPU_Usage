"""Generates synthetic (scenario -> utilization-risk label) training data.

Monte Carlo samples realistic usage scenarios by jittering each purpose's defaults
(from data.json, i.e. straight from src/data.js), paired with a random GPU + local
model choice, then labels each row via calc_port.py (the parity-checked port of
calc.js). Growth/util/opex are jittered around the Spectro Cloud AI-TCO benchmarks
already baked into data.js (GARTNER_GROWTH, OPEX_REF) so the distribution stays
plausible.

Output: data/synthetic_scenarios.csv, with a `source` column ("synthetic") so real
usage logs can later be appended under the same schema without a rework.
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

import calc_port as cp

HERE = Path(__file__).parent
N_ROWS = 18000
SEED = 42

_DATA = json.loads((HERE / "data.json").read_text())
PURPOSE_KEYS = list(cp.PURPOSES.keys())
LOCAL_MODEL_IDS = [m["id"] for m in _DATA["MODELS"] if m.get("local")]
GPU_IDS = list(cp.GPUS.keys())
GARTNER_GROWTH = _DATA["GARTNER_GROWTH"]

# Risk thresholds on utilization_ratio (peak-load / provisioned-capacity). Named for
# what the *node* is doing, not the provisioning direction, since "under-provisioned"
# and "under-utilized" mean opposite things and are easy to swap by accident.
UNDERUTILIZED_MAX = 0.35  # below this: node(s) mostly idle — too much capacity bought for the load
OVERUTILIZED_MIN = 0.95   # above this: essentially no slack for burst above modeled peak


def jitter_log_uniform(rng, center, lo_mult, hi_mult, size):
    """Sample multiplicatively around `center`, uniform in log-space (keeps things
    positive and avoids clustering all mass near the mean like a plain gaussian)."""
    lo, hi = np.log(lo_mult), np.log(hi_mult)
    return center * np.exp(rng.uniform(lo, hi, size))


def generate(n_rows=N_ROWS, seed=SEED):
    rng = np.random.default_rng(seed)

    purposes = rng.choice(PURPOSE_KEYS, size=n_rows)
    local_models = rng.choice(LOCAL_MODEL_IDS, size=n_rows)
    gpus = rng.choice(GPU_IDS, size=n_rows)

    rows = []
    for i in range(n_rows):
        purpose_key = purposes[i]
        p = cp.PURPOSES[purpose_key]
        gpu_id = gpus[i]
        local_model_id = local_models[i]

        seats = max(1, int(jitter_log_uniform(rng, p["seats"], 0.1, 3.0, 1)[0]))
        tasks = max(1, jitter_log_uniform(rng, p["tasks"], 0.3, 2.5, 1)[0])
        days = int(rng.integers(15, 24))
        calls = max(0.1, jitter_log_uniform(rng, p["calls"], 0.5, 2.0, 1)[0])

        growth = float(np.clip(rng.normal(GARTNER_GROWTH, 20), 0, 120))
        util = float(np.clip(rng.normal(85, 8), 40, 98))
        opex = float(jitter_log_uniform(rng, 50000, 0.6, 1.8, 1)[0])
        sub = float(jitter_log_uniform(rng, 50000, 0.4, 1.6, 1)[0])
        disc = float(np.clip(rng.normal(15, 8), 0, 60))
        dep = int(rng.integers(2, 6))

        peak = float(np.clip(rng.normal(3, 1.2), 1, 8))
        sla_tps = float(np.clip(rng.normal(30, 12), 5, 80))
        conc_pct = float(np.clip(rng.normal(10, 8), 0.5, 80))

        t = cp.tokens_per_month(p, seats, tasks, days, calls)
        peak_users = cp.peak_concurrent_users(seats, conc_pct)
        nodes = cp.nodes_for(gpu_id, local_model_id, util, days, t["outTok"], peak, sla_tps, peak_users)
        util_ratio = cp.utilization_ratio(gpu_id, local_model_id, util, days, t["outTok"], peak, sla_tps, peak_users, nodes)

        if util_ratio < UNDERUTILIZED_MAX:
            risk = "underutilized"
        elif util_ratio > OVERUTILIZED_MIN:
            risk = "overutilized"
        else:
            risk = "well_utilized"

        lm = cp.MODELS[local_model_id]
        gpu = cp.GPUS[gpu_id]

        rows.append({
            "source": "synthetic",
            "purpose": purpose_key,
            "seats": seats,
            "tasks_per_day": tasks,
            "days_active": days,
            "calls_per_task": calls,
            "growth_pct": growth,
            "util_pct": util,
            "opex": opex,
            "sub": sub,
            "disc_pct": disc,
            "dep_yrs": dep,
            "peak_mult": peak,
            "sla_tps": sla_tps,
            "conc_pct": conc_pct,
            "gpu_id": gpu_id,
            "gpu_tps": gpu["tps"],
            "gpu_capex": gpu["capex"],
            "local_model_id": local_model_id,
            "local_model_params_b": lm.get("params", 0),
            "local_model_tps_factor": lm.get("tpsFactor", 1),
            "intensity_need": p["intensityNeed"],
            "monthly_calls": t["calls"],
            "in_tok_month": t["inTok"],
            "out_tok_month": t["outTok"],
            "peak_concurrent_users": peak_users,
            "nodes": nodes,
            "utilization_ratio": util_ratio,
            "risk": risk,
        })

    return pd.DataFrame(rows)


def main():
    df = generate()
    out_dir = HERE / "data"
    out_dir.mkdir(exist_ok=True)
    out_path = out_dir / "synthetic_scenarios.csv"
    df.to_csv(out_path, index=False)

    print(f"wrote {len(df)} rows to {out_path}")
    print("\nrisk label distribution:")
    print(df["risk"].value_counts(normalize=True).round(3))
    print("\nutilization_ratio summary:")
    print(df["utilization_ratio"].describe())
    print("\nnodes summary:")
    print(df["nodes"].describe())


if __name__ == "__main__":
    main()
