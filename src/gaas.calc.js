import { gpu } from './data.js'
import { UTIL_NODES } from './utilization.data.js'
import { avgUtil } from './utilization.calc.js'
import { HOURS_PER_MONTH, REFERENCE_GPU_ID } from './gaas.data.js'

export function tenantBill(tenant) {
  return tenant.pricing === 'gpuhr' ? tenant.gpuHoursMonth * tenant.rate : tenant.tokensMonthM * tenant.rate
}

// freed capacity across the sample fleet — same nodes/utilization the GPU
// Utilization tab identified, minus a reserved headroom % kept back for the
// owner's own workloads. Deliberately imports the Module 1 dataset directly
// (data-level reuse, not shared React state) so both tabs describe the same fleet.
export function freedCapacityGpuHoursMonth(nodes = UTIL_NODES, reservePct = 20) {
  return nodes.reduce((total, n) => {
    const idleShare = 1 - avgUtil(n) / 100
    const reserved = idleShare * (reservePct / 100)
    return total + HOURS_PER_MONTH * Math.max(0, idleShare - reserved)
  }, 0)
}

// converts a token-priced tenant's monthly volume into an equivalent GPU-hours
// figure using a fixed reference GPU's throughput — lets 'gpuhr' and 'tokens'
// tenants be compared/summed on one axis (freed capacity is measured in hours).
export function tenantGpuHoursEquivalent(tenant, refGpuId = REFERENCE_GPU_ID) {
  if (tenant.pricing === 'gpuhr') return tenant.gpuHoursMonth
  const refGpu = gpu(refGpuId)
  const tokensMonth = tenant.tokensMonthM * 1e6
  return tokensMonth / (refGpu.tps * 3600)
}

export function monetizationSummary(tenants, freedHoursMonth) {
  const monetizedHours = tenants.reduce((a, t) => a + tenantGpuHoursEquivalent(t), 0)
  const monetizedRevenue = tenants.reduce((a, t) => a + tenantBill(t), 0)
  const unmonetizedHours = Math.max(0, freedHoursMonth - monetizedHours)
  const pctMonetized = freedHoursMonth > 0 ? Math.min(100, (monetizedHours / freedHoursMonth) * 100) : 0
  return { monetizedHours, monetizedRevenue, unmonetizedHours, pctMonetized }
}
