# Utilization-risk model — retraining

The recommender in `src/reco/gridSearch.js` is a deterministic grid-search over the
same cost/capacity math as `src/calc.js` — GPU sizing, node counts, and the hybrid
split all have an exact closed-form answer, so nothing here needs to be trained.
The one thing that IS trained is a small classifier that judges whether a given
local-model/GPU pairing would be **under/well/over-utilized** for the predicted
load — the qualitative call the formulas don't cleanly express. It ships to the app
as `src/ml/utilization-risk-model.json` (~500 KB), loaded and walked by
`src/reco/treeModel.js` with no ML runtime dependency.

## Setup

```bash
# from tools/ml/, using any Python 3.10+ (a 3.14 alpha here segfaults on numpy —
# use a stable release; a venv at tools/ml/venv/ is gitignored and expected)
python -m venv venv
./venv/Scripts/pip install numpy pandas scikit-learn joblib   # Scripts/ on Windows, bin/ elsewhere
```

## Regenerate + retrain (run in order, from `tools/ml/`)

```bash
node export_data.mjs        # dumps src/data.js -> data.json (single source of truth, no drift)
./venv/Scripts/python gen_synthetic.py   # Monte Carlo scenarios -> data/synthetic_scenarios.csv
./venv/Scripts/python train.py           # trains the RandomForest -> trained_model.joblib, prints accuracy
./venv/Scripts/python export_tree.py     # exports -> ../../src/ml/utilization-risk-model.json
```

Then rebuild the app (`npm run build`) so the new model is bundled.

## Parity check (run after touching calc_port.py or calc.js)

`calc_port.py` is a hand-ported copy of the pure math in `src/calc.js` — it's the
label source for synthetic data, so it must stay numerically identical to the real
thing. Verify with real calc.js output (not hand-transcribed numbers):

```bash
node parity_scenarios.mjs           # computes ground truth from the real calc.js
./venv/Scripts/python parity_check.py  # diffs calc_port.py against it
```

## Why a RandomForest, not GradientBoosting

GradientBoosting scored higher in testing (~96% vs ~91% test accuracy) but its exact
prediction requires replaying learning-rate scaling, a log-odds base score, and a
softmax across per-class trees — an easy place for the hand-rolled JS port to
silently diverge from sklearn's math. A RandomForest's prediction is just the
average of independent per-tree leaf-probability vectors — trivial to port exactly,
so it's the one that ships. See the comments in `train.py` and `export_tree.py`.

## Why the feature set excludes `nodes`/`utilization_ratio`

Those columns are what the label is derived from — including them as *inputs* would
turn training into a lookup. The model is given only raw scenario descriptors
(seats, tasks, growth, GPU/model specs, ...) plus a few engineered multiplicative
combinations (`monthly_calls`, `in_tok_month`, `out_tok_month`, `peak_concurrent_users`)
that a shallow tree can't easily rediscover on its own — see the comment in
`train.py`. Today, with only synthetic data, this makes the classifier a close
approximation of `calc_port.py`'s exact math. Once real usage logs exist (which
won't obey the idealized `peak × avg` burst assumption exactly), the same feature
set keeps working — append real rows to `data/synthetic_scenarios.csv` with
`source` set to something other than `"synthetic"` and retrain.

## Files

| File | Purpose |
|---|---|
| `export_data.mjs` | Dumps `src/data.js` (MODELS/PURPOSES/GPUS/benchmarks) to `data.json` |
| `calc_port.py` | Python port of `src/calc.js`'s pure math — the label source |
| `parity_scenarios.mjs` / `parity_check.py` | Verifies `calc_port.py` matches `calc.js` exactly |
| `gen_synthetic.py` | Monte Carlo scenario generator + risk labeling |
| `train.py` | Trains the RandomForest classifier |
| `export_tree.py` | Exports the trained forest to `src/ml/utilization-risk-model.json` |
