// Sample tenant billing data for a GPU-as-a-Service simulation — illustrative,
// not real client accounts. Generic names only.

export const TENANTS = [
  { id: 't1', name: 'Tenant Alpha', pricing: 'gpuhr', gpuHoursMonth: 420, rate: 2.10 },
  { id: 't2', name: 'Tenant Beta', pricing: 'tokens', tokensMonthM: 1800, rate: 1.20 },
  { id: 't3', name: 'Tenant Gamma', pricing: 'gpuhr', gpuHoursMonth: 180, rate: 1.85 },
  { id: 't4', name: 'Tenant Delta', pricing: 'tokens', tokensMonthM: 640, rate: 1.50 },
  { id: 't5', name: 'Tenant Epsilon', pricing: 'gpuhr', gpuHoursMonth: 95, rate: 2.40 },
]

// plausible on-demand rate presets — deliberately cheaper than the frontier API
// prices in data.js's MODELS ($3-$15/1M tokens), so "monetize the discount" holds together
export const GAAS_RATE_PRESETS = { gpuhr: [1.85, 2.10, 2.40, 2.75], tokens: [0.90, 1.20, 1.50, 2.00] }

export const RESERVE_HEADROOM_PCT_DEFAULT = 20 // % of freed capacity always held back for the owner's own workloads
export const REFERENCE_GPU_ID = 'h200' // used to convert token-priced tenants into GPU-hour equivalents
export const HOURS_PER_MONTH = 24 * 30
