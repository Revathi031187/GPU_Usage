import { GPUS, gpu } from './data.js'
import { assetCapexNet, assetMonthlyTCO } from './calc.js'

// Sample cost assumptions for the illustrative fleet (mirrors DEFAULT_STATE's
// opex/sub/disc/dep defaults in data.js) — this module has no shared state with
// the cost calculator, so it carries its own small assumption set.
export const NODE_COST_ASSUMPTIONS = { discPct: 15, opexYr: 50000, subYr: 50000, depYears: 3 }

export const avgUtil = (node) => node.hourly.reduce((a, b) => a + b, 0) / node.hourly.length
export const peakUtil = (node) => Math.max(...node.hourly)
export const minUtil = (node) => Math.min(...node.hourly)

export function nodeMonthlyTCO(node, assumptions = NODE_COST_ASSUMPTIONS) {
  const capexNet = assetCapexNet(gpu(node.gpuId).capex, assumptions.discPct)
  return assetMonthlyTCO(capexNet, assumptions.opexYr, assumptions.subYr, assumptions.depYears)
}

// $/mo paid for capacity that sat idle, against ANY baseline (100% would be full use)
export function idleWasteMonthly(node, assumptions = NODE_COST_ASSUMPTIONS) {
  return nodeMonthlyTCO(node, assumptions) * (1 - avgUtil(node) / 100)
}

// $/mo gap specifically against the app's flat-util-% planning assumption —
// a different claim from idleWasteMonthly: this is "how wrong the 85% guess was,"
// not "how much idle capacity exists in absolute terms."
export function provisioningGapMonthly(node, assumedUtilPct, assumptions = NODE_COST_ASSUMPTIONS) {
  const gapPct = Math.max(0, assumedUtilPct - avgUtil(node))
  return nodeMonthlyTCO(node, assumptions) * (gapPct / 100)
}

// Cheapest GPU platform whose derated throughput still covers this node's observed
// load. Returns null if nothing fits the target ceiling (the node is already
// loaded beyond what any target-constrained platform can show as "right-sized" —
// that's an under-provisioning case, not a cost-saving one), if the current
// platform is already the cheapest fit, or if the "cheaper" option wouldn't
// actually save money once opex/subscription/depreciation are included.
export function suggestRightSize(node, targetUtilPct, assumptions = NODE_COST_ASSUMPTIONS) {
  const current = gpu(node.gpuId)
  const observedLoadTps = current.tps * (avgUtil(node) / 100)
  const fits = GPUS.filter((g) => g.tps * (targetUtilPct / 100) >= observedLoadTps)
  if (!fits.length) return null
  const cheapest = fits.reduce((best, g) => (g.capex < best.capex ? g : best), fits[0])
  if (cheapest.id === current.id) return null
  const currentMonthly = nodeMonthlyTCO(node, assumptions)
  const suggestedMonthly = assetMonthlyTCO(
    assetCapexNet(cheapest.capex, assumptions.discPct), assumptions.opexYr, assumptions.subYr, assumptions.depYears,
  )
  const monthlySaving = currentMonthly - suggestedMonthly
  if (monthlySaving <= 0) return null
  return { suggestedGpuId: cheapest.id, capexDelta: cheapest.capex - current.capex, monthlySaving }
}

export function fleetSummary(nodes, assumedUtilPct, targetUtilPct, assumptions = NODE_COST_ASSUMPTIONS) {
  const avgFleetUtil = nodes.reduce((a, n) => a + avgUtil(n), 0) / nodes.length
  const totalIdleWaste = nodes.reduce((a, n) => a + idleWasteMonthly(n, assumptions), 0)
  const totalProvisioningGap = nodes.reduce((a, n) => a + provisioningGapMonthly(n, assumedUtilPct, assumptions), 0)
  const rightSizeCount = nodes.filter((n) => suggestRightSize(n, targetUtilPct, assumptions) != null).length
  return { avgFleetUtil, totalIdleWaste, totalProvisioningGap, rightSizeCount }
}
