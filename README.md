# AI Inference Cost Calculator — React

A React + Vite port of `ai-cost-calculator.html`. It models the economics of running LLM
inference on **frontier APIs vs. a hybrid frontier-API + local-GPU** setup, with live KPIs,
benchmarks, a multi-year forecast, a per-model cost table, and hardware capacity planning.

> Built as a safe replacement for `cost-llm-calculator-phonautogram.zip`, which was **not** a
> project — it contained a batch file launching an unknown `util.exe` (a malware-delivery
> pattern). That archive was never run.

## Features

- **Scenario controls** — purpose preset (coding, agentic, chat, RAG, summarization, annotation),
  model + editable per-token prices, seats/tasks/days/calls, frontier share, GPU platform,
  growth rate, forecast horizon, and advanced opex/capex assumptions.
- **KPIs** — all-API monthly, hybrid monthly, monthly saving, and payback period.
- **Benchmark bar** — your spend positioned against Ramp percentiles (p90/avg/p95/p99).
- **Forecast chart** — cumulative all-API vs. hybrid spend with the payback point marked.
- **Cost by model** — sortable table across 9 models; click a row to select it.
- **Hardware & capacity** — nodes required, blended $/1M tokens, Dell/ESG efficiency band,
  and per-developer cost tiers.
- **Light / dark theme** toggle (follows system by default).

## Project structure

| File | Purpose |
|------|---------|
| [src/data.js](src/data.js)     | Models, purposes, GPU platforms, benchmarks, defaults |
| [src/calc.js](src/calc.js)     | Pure math (forecast, token/node/cost functions) + formatters |
| [src/charts.js](src/charts.js) | SVG builders for the benchmark bar and forecast chart |
| [src/App.jsx](src/App.jsx)     | UI — controls, KPIs, tables, capacity, benefits |
| [src/index.css](src/index.css) | Full theme + layout (ported from the original) |

## Getting started

```bash
cd llm-cost-calculator
npm install
npm run dev
```

Then open the URL Vite prints (default http://localhost:5173).

## Build for production

```bash
npm run build
npm run preview
```

## Notes on the numbers

All figures are **illustrative planning defaults** — token prices, GPU capex/throughput, opex,
and the 2.9–4.1× on-prem efficiency band. Sources are cited in the app footer (Ramp, Gartner,
Dell/ESG, Spectro Cloud AI-TCO). Replace every field with your own negotiated numbers before
making decisions. Not financial advice.
