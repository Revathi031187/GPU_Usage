// Computes calc.js outputs for a handful of scenarios directly from the real
// source, so parity_check.py can diff calc_port.py against ground truth instead
// of hand-transcribed expected values.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { PURPOSES, model, gpu } from '../../src/data.js'
import {
  nodeEffTps, rateStats, peakConcurrentUsers, maxStreamsPerNode,
  nodesThroughput, nodesConcurrency, nodesFor, apiCostSelected,
  nodeMonthlyRun, nodeCapex, tokensPerMonth,
} from '../../src/calc.js'

const here = dirname(fileURLToPath(import.meta.url))

const scenarios = [
  { purpose: 'coding', model: 'sonnet', pin: 3, pout: 15, seats: 400, tasks: 90, days: 22, calls: 1.5,
    gpu: 'h200', localModel: 'llama70b', opex: 50000, sub: 50000, disc: 15, util: 85, peak: 3, slaTps: 30, concPct: 10 },
  { purpose: 'agent', model: 'sonnet', pin: 3, pout: 15, seats: 200, tasks: 40, days: 22, calls: 4,
    gpu: 'h200', localModel: 'llama405b', opex: 50000, sub: 50000, disc: 15, util: 85, peak: 3, slaTps: 30, concPct: 10 },
  { purpose: 'chat', model: 'gpt4omini', pin: 0.15, pout: 0.6, seats: 1000, tasks: 30, days: 22, calls: 1,
    gpu: 'l40s', localModel: 'llama8b', opex: 50000, sub: 50000, disc: 15, util: 85, peak: 2, slaTps: 20, concPct: 5 },
  { purpose: 'annot', model: 'gpt4omini', pin: 0.15, pout: 0.6, seats: 40, tasks: 1500, days: 22, calls: 1,
    gpu: 'h200', localModel: 'llama405b', opex: 50000, sub: 50000, disc: 15, util: 85, peak: 1.5, slaTps: 15, concPct: 20 },
]

const results = scenarios.map((S) => {
  const p = PURPOSES[S.purpose]
  const t = tokensPerMonth({ ...S, calls: S.calls })
  const peakUsers = peakConcurrentUsers(S)
  const nThru = nodesThroughput(S, t.outTok)
  const nConc = nodesConcurrency(S, peakUsers)
  const nodes = nodesFor(S, t.outTok, peakUsers)
  return {
    input: S,
    inTok: t.inTok, outTok: t.outTok, calls: t.calls,
    nodeEffTps: nodeEffTps(S),
    peakTps: rateStats(S, t.outTok).peakTps,
    avgTps: rateStats(S, t.outTok).avgTps,
    peakConcurrentUsers: peakUsers,
    maxStreamsPerNode: maxStreamsPerNode(S),
    nodesThroughput: nThru,
    nodesConcurrency: nConc,
    nodesFor: nodes,
    nodeMonthlyRun: nodeMonthlyRun(S),
    nodeCapex: nodeCapex(S),
    apiCostSelected: apiCostSelected(S, t.inTok, t.outTok),
  }
})

writeFileSync(join(here, 'parity_scenarios.json'), JSON.stringify(results, null, 2))
console.log('wrote tools/ml/parity_scenarios.json —', results.length, 'scenarios')
