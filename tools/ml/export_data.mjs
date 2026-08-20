// Dumps src/data.js (MODELS, PURPOSES, GPUS) to tools/ml/data.json so the Python
// synthetic-data generator reads the exact same source of truth as the app — no
// hand-mirrored copy to drift out of sync. Re-run after any edit to src/data.js.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { MODELS, PURPOSES, GPUS, RAMP, EFF_BAND, OPEX_REF, GARTNER_GROWTH } from '../../src/data.js'

const here = dirname(fileURLToPath(import.meta.url))
const out = { MODELS, PURPOSES, GPUS, RAMP, EFF_BAND, OPEX_REF, GARTNER_GROWTH }
writeFileSync(join(here, 'data.json'), JSON.stringify(out, null, 2))
console.log('wrote tools/ml/data.json')
