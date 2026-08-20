"""Trains the utilization-risk classifier from tools/ml/data/synthetic_scenarios.csv.

Feature set is deliberately the RAW scenario descriptors only (seats, tasks, growth,
gpu/model specs, ...) — never the precomputed `nodes`/`utilization_ratio` columns,
which would make this a lookup rather than a model. The model has to learn the same
max(throughput-constraint, concurrency-constraint) relationship calc.js expresses in
closed form, from the raw inputs alone — today that makes it a close approximation of
the exact math (only synthetic data exists), but the same feature set will keep
working once real usage logs (which won't obey the idealized formulas exactly) are
unioned into the training set.

FEATURE_COLUMNS below is the single source of truth for feature name + order; the JS
side (src/reco/features.js) must mirror it exactly — see that file's header comment.
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report

HERE = Path(__file__).parent

NUMERIC_COLUMNS = [
    "seats", "tasks_per_day", "days_active", "calls_per_task",
    "growth_pct", "util_pct", "peak_mult", "sla_tps", "conc_pct",
    "gpu_tps", "gpu_capex", "local_model_params_b", "local_model_tps_factor",
    "intensity_need",
    # engineered — the multiplicative interactions (seats*tasks*days*calls,
    # seats*conc_pct) that a shallow axis-aligned tree can't easily discover on
    # its own from the raw factors; these are still pre-label physical quantities,
    # not the utilization_ratio/nodes target itself.
    "monthly_calls", "in_tok_month", "out_tok_month", "peak_concurrent_users",
]
CATEGORICAL_COLUMNS = ["purpose", "gpu_id", "local_model_id"]
FEATURE_COLUMNS = NUMERIC_COLUMNS + CATEGORICAL_COLUMNS  # order matters — mirrored in JS
LABEL_COLUMN = "risk"
RISK_CLASSES = ["underutilized", "well_utilized", "overutilized"]  # fixed order — mirrored in JS


def load_encoded():
    df = pd.read_csv(HERE / "data" / "synthetic_scenarios.csv")

    cat_values = {}
    encoded = {}
    for col in NUMERIC_COLUMNS:
        encoded[col] = df[col].astype(float)
    for col in CATEGORICAL_COLUMNS:
        cats = sorted(df[col].unique().tolist())
        cat_values[col] = cats
        code = {v: i for i, v in enumerate(cats)}
        encoded[col] = df[col].map(code).astype(float)

    X = pd.DataFrame(encoded)[FEATURE_COLUMNS]
    y = df[LABEL_COLUMN].map({v: i for i, v in enumerate(RISK_CLASSES)})
    return X, y, cat_values


def main():
    X, y, cat_values = load_encoded()
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # A single shallow tree (tried first) capped out around 89% test accuracy with
    # weak recall on the rarer "well"/"over" classes. GradientBoostingClassifier
    # scored higher (~96%) but its exact prediction requires replaying learning-rate
    # scaling, a log-odds base score, and softmax across per-class trees in JS — an
    # easy place to introduce a silent numeric mismatch. RandomForestClassifier gets
    # nearly the same lift (~93%) as a plain, safe-to-port average of independent
    # per-tree leaf-probability vectors — no init/scaling/softmax to get subtly
    # wrong — so it's the one that ships.
    clf = RandomForestClassifier(
        n_estimators=30, max_depth=10, min_samples_leaf=6,
        random_state=42, class_weight="balanced_subsample",
    )
    clf.fit(X_train, y_train)

    train_acc = accuracy_score(y_train, clf.predict(X_train))
    test_acc = accuracy_score(y_test, clf.predict(X_test))
    print(f"train accuracy: {train_acc:.4f}")
    print(f"test accuracy:  {test_acc:.4f}")
    print()
    print(classification_report(y_test, clf.predict(X_test), target_names=RISK_CLASSES, zero_division=0))
    total_nodes = sum(t.tree_.node_count for t in clf.estimators_)
    print(f"forest: {len(clf.estimators_)} trees, {total_nodes} total nodes")

    # persist for export_tree.py
    import joblib
    joblib.dump(
        {"clf": clf, "feature_columns": FEATURE_COLUMNS, "cat_values": cat_values, "risk_classes": RISK_CLASSES},
        HERE / "trained_model.joblib",
    )
    print(f"\nwrote {HERE / 'trained_model.joblib'}")


if __name__ == "__main__":
    main()
