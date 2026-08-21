// Sample/synthetic GPU fleet utilization data — NOT live telemetry. Demonstrates
// what a real utilization data layer would let the app compute (see calc.js's
// flat `util%` assumption, which this module exists to challenge with a more
// realistic, if illustrative, per-node picture).
//
// Deterministic (sine wave + fixed jitter), not Math.random() — so these numbers
// are stable across reloads instead of silently changing every page load, which
// would undercut the "this is a fixed illustrative sample" framing.

const JITTER = [3, -2, 4, -5, 1, 2, -3, 5, -1, -4, 2, 3, -2, 1, -3, 4, 0, -1, 2, -4, 3, 1, -2, 0]

function diurnal(base, amp, phase) {
  return Array.from({ length: 24 }, (_, h) => {
    const wave = Math.sin(((h - phase) / 24) * Math.PI * 2)
    return Math.max(2, Math.min(98, Math.round(base + amp * wave + JITTER[h])))
  })
}

// mirrors DEFAULT_STATE.util in data.js — the flat planning assumption this module challenges
export const ASSUMED_FLAT_UTIL = 85

export const UTIL_NODES = [
  { id: 'n1', name: 'gpu-node-01', gpuId: 'h200', pool: 'coding-assistant', hourly: diurnal(38, 20, 14) },
  { id: 'n2', name: 'gpu-node-02', gpuId: 'h200', pool: 'coding-assistant', hourly: diurnal(44, 18, 13) },
  { id: 'n3', name: 'gpu-node-03', gpuId: 'mi325', pool: 'rag-search', hourly: diurnal(61, 15, 15) },
  { id: 'n4', name: 'gpu-node-04', gpuId: 'a100', pool: 'batch-annotation', hourly: diurnal(72, 10, 10) },
  { id: 'n5', name: 'gpu-node-05', gpuId: 'h200', pool: 'chat-copilot', hourly: diurnal(29, 22, 16) },
  { id: 'n6', name: 'gpu-node-06', gpuId: 'l40s', pool: 'dev-sandbox', hourly: diurnal(18, 12, 12) },
  { id: 'n7', name: 'gpu-node-07', gpuId: 'mi325', pool: 'agentic-flows', hourly: diurnal(55, 20, 14) },
  { id: 'n8', name: 'gpu-node-08', gpuId: 'h200', pool: 'coding-assistant', hourly: diurnal(48, 17, 13) },
]
