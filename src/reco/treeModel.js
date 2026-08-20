// Generic random-forest inference: walks the JSON export produced by
// tools/ml/export_tree.py (trained_model.joblib -> utilization-risk-model.json).
// No ML runtime dependency — each tree is a flat array of nodes; a leaf holds a
// class-probability vector `p`, an internal node holds `{f: featureIdx, t: threshold,
// l: leftChildIdx, r: rightChildIdx}`. Forest prediction = average of every tree's
// leaf `p` vector, argmax over riskClasses.

function walkTree(nodes, features) {
  let i = 0
  while (true) {
    const n = nodes[i]
    if (n.p) return n.p
    i = features[n.f] <= n.t ? n.l : n.r
  }
}

// featureVector must be built by encodeFeatures() below — same order/encoding
// the Python side used (model.featureColumns / model.catValues).
export function predictForest(model, featureVector) {
  const nClasses = model.riskClasses.length
  const sum = new Array(nClasses).fill(0)
  for (const tree of model.forest) {
    const p = walkTree(tree, featureVector)
    for (let c = 0; c < nClasses; c++) sum[c] += p[c]
  }
  const n = model.forest.length
  const probs = sum.map((s) => s / n)
  let best = 0
  for (let c = 1; c < nClasses; c++) if (probs[c] > probs[best]) best = c
  return { label: model.riskClasses[best], confidence: probs[best], probs }
}

// rawFeatures: plain object keyed by feature name (see src/reco/features.js).
// Categorical fields are encoded via the same sorted-category index the Python
// training used (model.catValues[col] is that sorted list); an unseen category
// (shouldn't happen — all real values were present in training) falls back to 0.
export function encodeFeatures(model, rawFeatures) {
  return model.featureColumns.map((col) => {
    const v = rawFeatures[col]
    const cats = model.catValues[col]
    if (!cats) return Number(v)
    const idx = cats.indexOf(v)
    return idx === -1 ? 0 : idx
  })
}

export function predictRisk(model, rawFeatures) {
  return predictForest(model, encodeFeatures(model, rawFeatures))
}
