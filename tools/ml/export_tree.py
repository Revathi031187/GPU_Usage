"""Exports tools/ml/trained_model.joblib to src/ml/utilization-risk-model.json — a
plain array of trees, each a flat array of nodes, for src/reco/treeModel.js to walk.

Node shape: internal `{f, t, l, r}` (feature index, threshold, left/right child
index); leaf `{p: [pUnder, pWell, pOver]}` (class-probability vector from that
tree's training-sample leaf counts). Forest prediction = average leaf `p` vectors
across all trees, argmax over RISK_CLASSES — implemented in src/reco/treeModel.js.

cat_values / risk_classes / feature_columns are included so the JS side has the
exact same categorical encoding and feature order used at training time.
"""
import json
from pathlib import Path

import joblib
import numpy as np

HERE = Path(__file__).parent
OUT_PATH = HERE.parent.parent / "src" / "ml" / "utilization-risk-model.json"


def export_tree(tree, n_classes):
    t = tree.tree_
    nodes = []
    for i in range(t.node_count):
        if t.children_left[i] == t.children_right[i] == -1:  # leaf (sklearn uses -1, not TREE_LEAF const, but equivalent)
            counts = t.value[i][0]
            total = counts.sum()
            probs = (counts / total) if total > 0 else np.zeros(n_classes)
            nodes.append({"p": [round(float(x), 5) for x in probs]})
        else:
            nodes.append({
                "f": int(t.feature[i]),
                "t": round(float(t.threshold[i]), 6),
                "l": int(t.children_left[i]),
                "r": int(t.children_right[i]),
            })
    return nodes


def main():
    bundle = joblib.load(HERE / "trained_model.joblib")
    clf = bundle["clf"]
    n_classes = len(bundle["risk_classes"])

    forest = [export_tree(est, n_classes) for est in clf.estimators_]

    out = {
        "featureColumns": bundle["feature_columns"],
        "catValues": bundle["cat_values"],
        "riskClasses": bundle["risk_classes"],
        "forest": forest,
    }

    OUT_PATH.parent.mkdir(exist_ok=True)
    OUT_PATH.write_text(json.dumps(out, separators=(",", ":")))
    size_kb = OUT_PATH.stat().st_size / 1024
    print(f"wrote {OUT_PATH} — {len(forest)} trees, {size_kb:.1f} KB")


if __name__ == "__main__":
    main()
