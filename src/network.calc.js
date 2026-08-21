import { assetCapexNet, assetMonthlyTCO } from './calc.js'
import { REFERENCE_YEAR } from './network.data.js'

export function deviceAgeYears(device, refYear = REFERENCE_YEAR) {
  return refYear - device.purchaseYear
}

export function deviceMonthlyTCO(device, discPct = 0) {
  const capexNet = assetCapexNet(device.capex, discPct)
  return assetMonthlyTCO(capexNet, device.opexYr, 0, device.refreshCycleYears)
}

// ratio of age to refresh cycle — >1 overdue, 0.8-1 due soon, otherwise ok
export function refreshStatus(device, refYear = REFERENCE_YEAR) {
  const ratio = deviceAgeYears(device, refYear) / device.refreshCycleYears
  if (ratio > 1) return 'overdue'
  if (ratio >= 0.8) return 'due-soon'
  return 'ok'
}

export function isConsolidationCandidate(device, utilThresholdPct) {
  return device.avgUtilPct < utilThresholdPct && device.peakUtilPct < utilThresholdPct * 1.6
}

export function fleetTotals(devices, discPct = 0, utilThresholdPct = 30, refYear = REFERENCE_YEAR) {
  const totalMonthlyTCO = devices.reduce((a, d) => a + deviceMonthlyTCO(d, discPct), 0)
  const overdueCount = devices.filter((d) => refreshStatus(d, refYear) === 'overdue').length
  const candidates = devices.filter((d) => isConsolidationCandidate(d, utilThresholdPct))
  const consolidationSavingMonthly = candidates.reduce((a, d) => a + deviceMonthlyTCO(d, discPct), 0)
  return { totalMonthlyTCO, overdueCount, consolidationCount: candidates.length, consolidationSavingMonthly }
}
