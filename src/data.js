// ---------- data ----------
// quality  = output correctness/polish (1–5)
// intensity = ability to sustain complex, multi-step, long-context reasoning (1–5)
export const MODELS = [
  { id: 'opus',     name: 'Claude Opus 4.5',   vendor: 'Anthropic',       tier: 'Frontier',  in: 15,   out: 75,   color: '#8B5CF6', quality: 5.0, intensity: 5.0 },
  { id: 'sonnet',   name: 'Claude Sonnet 4.5', vendor: 'Anthropic',       tier: 'Balanced',  in: 3,    out: 15,   color: '#0B968E', quality: 4.5, intensity: 4.5 },
  { id: 'haiku',    name: 'Claude Haiku 4.5',  vendor: 'Anthropic',       tier: 'Fast',      in: 0.80, out: 4,    color: '#2DA6C7', quality: 3.5, intensity: 3.0 },
  { id: 'gpt4o',    name: 'GPT-4o',            vendor: 'OpenAI',          tier: 'Frontier',  in: 2.50, out: 10,   color: '#10B981', quality: 4.5, intensity: 4.5 },
  { id: 'gpt4omini',name: 'GPT-4o mini',       vendor: 'OpenAI',          tier: 'Fast',      in: 0.15, out: 0.60, color: '#34D399', quality: 3.0, intensity: 2.5 },
  { id: 'gemini',   name: 'Gemini 1.5 Pro',    vendor: 'Google',          tier: 'Balanced',  in: 1.25, out: 5,    color: '#4285F4', quality: 4.0, intensity: 4.5 },
  { id: 'deepseek', name: 'DeepSeek-V3',       vendor: 'DeepSeek',        tier: 'Value',     in: 0.27, out: 1.10, color: '#EAB308', quality: 3.5, intensity: 4.0 },
  // ---- free / open-weight models you self-host (no per-token API fee; runs on your GPU) ----
  // params = billions (active for MoE); tpsFactor = per-node throughput vs a ~70B dense
  // reference (bigger models are slower / need more of the node, so serve fewer tokens/sec).
  { id: 'llama405b', name: 'Llama 3.1 405B',   vendor: 'Meta · open',     tier: 'Open/self', in: 0,    out: 0,    color: '#FB923C', local: true, open: true, license: 'Llama 3.1', quality: 4.5, intensity: 4.5, params: 405, tpsFactor: 0.25 },
  { id: 'llama70b', name: 'Llama 3.1 70B',     vendor: 'Meta · open',     tier: 'Open/self', in: 0,    out: 0,    color: '#F97316', local: true, open: true, license: 'Llama 3.1', quality: 3.5, intensity: 3.5, params: 70,  tpsFactor: 1.0 },
  { id: 'llama8b',  name: 'Llama 3.1 8B',      vendor: 'Meta · open',     tier: 'Open/self', in: 0,    out: 0,    color: '#FDBA74', local: true, open: true, license: 'Llama 3.1', quality: 2.5, intensity: 2.0, params: 8,   tpsFactor: 5.0 },
  { id: 'mixtral',  name: 'Mixtral 8x22B',     vendor: 'Mistral · open',  tier: 'Open/self', in: 0,    out: 0,    color: '#DA7756', local: true, open: true, license: 'Apache-2.0', quality: 4.0, intensity: 4.0, params: 39,  tpsFactor: 1.6 },
  { id: 'qwen72b',  name: 'Qwen2.5 72B',       vendor: 'Alibaba · open',  tier: 'Open/self', in: 0,    out: 0,    color: '#EF4444', local: true, open: true, license: 'Qwen',      quality: 3.5, intensity: 3.5, params: 72,  tpsFactor: 1.0 },
  { id: 'qwen32b',  name: 'Qwen2.5 32B',       vendor: 'Alibaba · open',  tier: 'Open/self', in: 0,    out: 0,    color: '#F87171', local: true, open: true, license: 'Apache-2.0', quality: 3.3, intensity: 3.2, params: 32,  tpsFactor: 2.0 },
  { id: 'gemma27b', name: 'Gemma 2 27B',       vendor: 'Google · open',   tier: 'Open/self', in: 0,    out: 0,    color: '#60A5FA', local: true, open: true, license: 'Gemma',     quality: 3.3, intensity: 3.0, params: 27,  tpsFactor: 2.4 },
]

// purpose presets: tokens per LLM call + typical calls/task
// `best` = recommended model id for this workload, `bestWhy` = one-line rationale.
// `intensityNeed` (1–5) = how demanding the workload is; `wQ`/`wI` = how much the
// purpose weights model quality vs. intensity when scoring fit (wQ + wI = 1).
export const PURPOSES = {
  coding: { name: 'Coding assistant', in: 4000, out: 1500, calls: 1.5, seats: 400, tasks: 90,
            desc: 'IDE completions + chat across an eng org. Output-heavy, agent chains common.',
            best: 'sonnet', bestWhy: 'Strong coding quality with balanced cost; handles agent chains well.',
            bestOpen: 'llama405b', bestOpenWhy: 'Near-frontier open weights — best self-hosted coder when you keep IP in-house.',
            intensityNeed: 4, wQ: 0.5, wI: 0.5 },
  agent:  { name: 'Agentic workflow', in: 8000, out: 3000, calls: 4, seats: 200, tasks: 40,
            desc: 'Multi-step tool-using agents. Several LLM calls per task, large context.',
            best: 'sonnet', bestWhy: 'Reliable tool-use over long context without frontier (Opus) pricing.',
            bestOpen: 'llama405b', bestOpenWhy: 'Highest-intensity open model for multi-step tool use on your own GPUs.',
            intensityNeed: 5, wQ: 0.4, wI: 0.6 },
  chat:   { name: 'Chat assistant / copilot', in: 500, out: 800, calls: 1, seats: 1000, tasks: 30,
            desc: 'Internal Q&A copilot. Short prompts, conversational output.',
            best: 'gpt4omini', bestWhy: 'Fast and cheap — plenty for short conversational Q&A at high seat counts.',
            bestOpen: 'llama8b', bestOpenWhy: 'Tiny, fast open model — cheapest to self-host for high-volume short chat.',
            intensityNeed: 2, wQ: 0.6, wI: 0.4 },
  rag:    { name: 'RAG / knowledge search', in: 3000, out: 500, calls: 1, seats: 500, tasks: 40,
            desc: 'Retrieval-augmented answers. Big input context, concise output.',
            best: 'gemini', bestWhy: 'Large context window suits big retrieval inputs; concise, low-cost output.',
            bestOpen: 'mixtral', bestOpenWhy: 'Apache-2.0 MoE with strong long-context handling for retrieval inputs.',
            intensityNeed: 3, wQ: 0.5, wI: 0.5 },
  summ:   { name: 'Summarization / extraction', in: 6000, out: 800, calls: 1, seats: 150, tasks: 200,
            desc: 'Documents in, structured summaries out. Input-dominated.',
            best: 'haiku', bestWhy: 'Cheap, fast, and accurate enough for input-heavy summarization at volume.',
            bestOpen: 'gemma27b', bestOpenWhy: 'Compact, efficient open model — cheap to self-host for input-heavy summarization.',
            intensityNeed: 3, wQ: 0.6, wI: 0.4 },
  annot:  { name: 'Data annotation / labeling', in: 1500, out: 200, calls: 1, seats: 40, tasks: 1500,
            desc: 'LLM-as-labeler over a dataset. Very high call volume, tiny outputs.',
            best: 'gpt4omini', bestWhy: 'Lowest token cost for very high-volume labeling with tiny outputs.',
            bestOpen: 'llama8b', bestOpenWhy: 'Smallest open model — highest throughput per GPU for bulk labeling.',
            intensityNeed: 2, wQ: 0.55, wI: 0.45 },
}

// GPU node platforms: capex, sustained aggregate output tokens/sec, power note
export const GPUS = [
  { id: 'h200',  name: '8× NVIDIA H200 node', capex: 600000, tps: 14000, note: '8× H200 141GB · Supermicro-class' },
  { id: 'mi325', name: '8× AMD MI325X node',  capex: 450000, tps: 13000, note: '8× Instinct MI325X · Supermicro-class' },
  { id: 'l40s',  name: '4× NVIDIA L40S node', capex: 90000,  tps: 3000,  note: 'entry inference node' },
  { id: 'a100',  name: '8× NVIDIA A100 node', capex: 170000, tps: 8000,  note: 'prior-gen, cost-efficient' },
]

export const DEV_TIERS = [{ n: 'Light', v: 100 }, { n: 'Typical', v: 550 }, { n: 'Heavy / agentic', v: 1000 }]

// ---- benchmark data (from Spectro Cloud AI-TCO case study) ----
export const RAMP = { avg: 140842, p90: 73030, p95: 211409, p99: 831338 } // monthly business AI spend
export const ENTERPRISE_FLOOR = 35000   // realistic mid-market threshold
export const GARTNER_GROWTH = 47        // % worldwide AI spend growth, 2026
export const EFF_BAND = [2.9, 4.1]      // Dell/ESG: on-prem vs API cost-effectiveness
export const OPEX_REF = { powerShare: 0.22, kwhPerNode: 79854, pue: 1.54 } // ~$11K power+cooling / $39K rack+ops of $50K
export const MAX_REDUCTION = 70         // Inference Launchpad: up to 70% inference cost reduction

export const BENEFITS = [
  { ic: '🛡️', h: 'Data stays in your perimeter', p: 'Prompts and source code never leave your network — the case against sending IP to a public API.' },
  { ic: '🔎', h: 'Visibility into model usage', p: 'An intelligent proxy meters every request, so you finally see which teams and tasks drive spend.' },
  { ic: '⚡', h: 'Fast lane to production', p: 'Turnkey stack serves traffic in ~1 day on validated hardware, OpenAI-compatible — IDEs and tools unchanged.' },
  { ic: '🔌', h: 'Runs anywhere, even air-gapped', p: 'Connected or fully disconnected, with Day-2 ops built in — up to 70% frontier-token spend removed.' },
]

// default scenario state
export const DEFAULT_STATE = {
  purpose: 'coding', model: 'sonnet', pin: 3, pout: 15,
  seats: 400, tasks: 90, days: 22, calls: 1.5,
  frontier: 20, gpu: 'h200', growth: 30, horizon: 3, owns: 'no',
  opex: 50000, sub: 50000, disc: 15, dep: 3, util: 85,
  localModel: 'llama70b', peak: 3, slaTps: 30, concPct: 10,
  sortK: 'cost', sortDir: 1,
  cmpA: 'sonnet', cmpB: 'gpt4o',
}

// ---------- lookups ----------
export const model = (id) => MODELS.find((m) => m.id === id)
export const gpu = (id) => GPUS.find((g) => g.id === id)
