import { useEffect, useMemo, useState } from 'react'
import {
  MODELS, PURPOSES, GPUS, DEV_TIERS, BENEFITS, OPEX_REF, EFF_BAND,
  DEFAULT_STATE, model, gpu,
} from './data.js'
import {
  fmt, fmtFull, pct, num,
  monthlyCalls, tokensPerMonth, apiCost, apiCostSelected, nodeMonthlyRun, nodeCapex, forecast,
  fitScore, valueScore, nodeEffTps, rateStats,
  maxStreamsPerNode, nodesThroughput, nodesConcurrency, peakConcurrentUsers,
} from './calc.js'
import { buildChart, buildBenchmark } from './charts.js'

export default function App() {
  const [S, setS] = useState(DEFAULT_STATE)
  const [theme, setTheme] = useState(null) // null = system

  useEffect(() => {
    if (theme) document.documentElement.setAttribute('data-theme', theme)
    else document.documentElement.removeAttribute('data-theme')
  }, [theme])

  // patch helper
  const set = (patch) => setS((prev) => ({ ...prev, ...patch }))
  const setNum = (key) => (e) => { const v = parseFloat(e.target.value); set({ [key]: isNaN(v) ? 0 : v }) }

  const f = useMemo(() => forecast(S), [S])
  const chart = useMemo(() => buildChart(S, f), [S, f])
  const bench = useMemo(() => buildBenchmark(S, f), [S, f])

  const toggleTheme = () => {
    const cur = theme
    const isDark = cur ? cur === 'dark' : window.matchMedia('(prefers-color-scheme:dark)').matches
    setTheme(isDark ? 'light' : 'dark')
  }

  const applyPurpose = (k) => {
    const p = PURPOSES[k]
    set({ purpose: k, calls: p.calls, seats: p.seats, tasks: p.tasks })
  }
  const selectModelById = (id) => {
    const m = model(id)
    if (!m || m.local) return
    set({ model: m.id, pin: m.in, pout: m.out })
  }

  const p = PURPOSES[S.purpose]
  const t = f.tokens

  return (
    <>
      <header className="top">
        <div className="top-inner">
          <div className="brand">
            <img className="logo" src="/LV_Brand mnemonic.png" alt="LatentView" />
            <div>
              <div className="eyebrow"></div>
              <h1>AI Pulse</h1>
            </div>
          </div>
          <button className="theme-btn" type="button" onClick={toggleTheme}>Theme</button>
        </div>
      </header>

      <div className="wrap">
        {/* ============ CONTROLS ============ */}
        <aside className="panel controls">
          <div className="phead"><h2>Scenario</h2><span className="hint">edits update live</span></div>
          <div className="pbody">

            <div className="field">
              <label className="lab" htmlFor="purpose">Purpose <span className="v">{p.in + ' in / ' + p.out + ' out tok'}</span></label>
              <select id="purpose" value={S.purpose} onChange={(e) => applyPurpose(e.target.value)}>
                {Object.entries(PURPOSES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
              </select>
              <div className="mini">{p.desc}</div>
              {p.best && (
                <div className="callout" style={{ marginTop: 8, alignItems: 'center' }}>
                  <span className="chip a" style={{ flex: 'none' }}>Best</span>
                  <span style={{ flex: 1 }}>
                    <b>{model(p.best).name}</b>{' '}
                    <span className="vend num">{'$' + model(p.best).in + '/$' + model(p.best).out}</span>
                    <div className="mini" style={{ marginTop: 2 }}>{p.bestWhy}</div>
                  </span>
                  {S.model === p.best
                    ? <span className="chip g" style={{ flex: 'none' }}>selected</span>
                    : <button type="button" className="theme-btn" style={{ flex: 'none' }} onClick={() => selectModelById(p.best)}>Use</button>}
                </div>
              )}
              {p.bestOpen && (
                <div className="callout" style={{ marginTop: 8, alignItems: 'center' }}>
                  <span className="chip n" style={{ flex: 'none' }}>Open</span>
                  <span style={{ flex: 1 }}>
                    <b>{model(p.bestOpen).name}</b>{' '}
                    <span className="vend">{model(p.bestOpen).license + ' · free, self-hosted'}</span>
                    <div className="mini" style={{ marginTop: 2 }}>{p.bestOpenWhy}</div>
                  </span>
                  <button type="button" className="theme-btn" style={{ flex: 'none' }}
                    onClick={() => set({ cmpA: p.best, cmpB: p.bestOpen })}>Compare</button>
                </div>
              )}
            </div>

            <div className="field">
              <label className="lab" htmlFor="model">Primary / frontier model</label>
              <select id="model" value={S.model} onChange={(e) => selectModelById(e.target.value)}>
                {MODELS.filter((m) => !m.local).map((m) => (
                  <option key={m.id} value={m.id}>{m.name + ' — $' + m.in + '/$' + m.out}</option>
                ))}
              </select>
              <div className="row2" style={{ marginTop: 8 }}>
                <div>
                  <label className="lab" htmlFor="pin" style={{ fontSize: 11 }}>Input $/1M</label>
                  <input type="number" id="pin" step="0.01" min="0" value={S.pin} onChange={setNum('pin')} />
                </div>
                <div>
                  <label className="lab" htmlFor="pout" style={{ fontSize: 11 }}>Output $/1M</label>
                  <input type="number" id="pout" step="0.01" min="0" value={S.pout} onChange={setNum('pout')} />
                </div>
              </div>
              <div className="mini">Prices are editable illustrative list rates — set your negotiated rates.</div>
            </div>

            <div className="field">
              <label className="lab">Usage</label>
              <div className="row2">
                <div>
                  <label className="lab" htmlFor="seats" style={{ fontSize: 11 }}>Users / seats <span className="v">{num(S.seats)}</span></label>
                  <input type="number" id="seats" min="1" value={S.seats} onChange={setNum('seats')} />
                </div>
                <div>
                  <label className="lab" htmlFor="tasks" style={{ fontSize: 11 }}>Tasks/user/day <span className="v">{num(S.tasks)}</span></label>
                  <input type="number" id="tasks" min="1" value={S.tasks} onChange={setNum('tasks')} />
                </div>
              </div>
              <div className="row2" style={{ marginTop: 8 }}>
                <div>
                  <label className="lab" htmlFor="days" style={{ fontSize: 11 }}>Active days/mo</label>
                  <input type="number" id="days" min="1" max="31" value={S.days} onChange={setNum('days')} />
                </div>
                <div>
                  <label className="lab" htmlFor="calls" style={{ fontSize: 11 }}>LLM calls/task</label>
                  <input type="number" id="calls" min="0.1" step="0.1" value={S.calls} onChange={setNum('calls')} />
                </div>
              </div>
              <div className="mini">{num(monthlyCalls(S)) + ' LLM calls/month · ' + num(t.inTok + t.outTok) + ' tokens/month'}</div>
            </div>

            <div className="field">
              <label className="lab" htmlFor="frontier">Kept on frontier API <span className="v">{S.frontier + '%'}</span></label>
              <input type="range" id="frontier" min="0" max="100" step="5" value={S.frontier} onChange={(e) => set({ frontier: +e.target.value })} />
              <div className="mini">Share of calls too complex for a local model. The rest runs on your own GPU.</div>
            </div>

            <div className="field">
              <label className="lab">Local GPU deployment</label>
              <select value={S.gpu} onChange={(e) => set({ gpu: e.target.value })}>
                {GPUS.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <div className="mini">{gpu(S.gpu).note + ' · ' + fmtFull(gpu(S.gpu).capex) + ' list'}</div>
              <div className="row2" style={{ marginTop: 8 }}>
                <div>
                  <label className="lab" style={{ fontSize: 11 }}>Local model (self-hosted)</label>
                  <select value={S.localModel} onChange={(e) => set({ localModel: e.target.value })}>
                    {MODELS.filter((m) => m.local).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="lab" htmlFor="peak" style={{ fontSize: 11 }}>Peak traffic ×avg <span className="v">{S.peak}×</span></label>
                  <input type="number" id="peak" min="1" step="0.5" value={S.peak} onChange={setNum('peak')} />
                </div>
              </div>
              <div className="row2" style={{ marginTop: 8 }}>
                <div>
                  <label className="lab" htmlFor="sla" style={{ fontSize: 11 }}>SLA tok/s per user</label>
                  <input type="number" id="sla" min="1" step="1" value={S.slaTps} onChange={setNum('slaTps')} />
                </div>
                <div>
                  <label className="lab" htmlFor="concPct" style={{ fontSize: 11 }}>Peak concurrency % <span className="v">{S.concPct}%</span></label>
                  <input type="number" id="concPct" min="0" max="100" step="1" value={S.concPct} onChange={setNum('concPct')} />
                </div>
              </div>
              <div className="mini">{num(peakConcurrentUsers(S)) + ' peak concurrent users (' + S.concPct + '% of ' + num(S.seats) + ' seats) · ' + model(S.localModel).name + ' ≈ ' + num(maxStreamsPerNode(S)) + ' streams/node at ' + S.slaTps + ' tok/s SLA'}</div>
            </div>

            <div className="field">
              <label className="lab" htmlFor="growth">Annual usage growth <span className="v">{pct(S.growth)}</span></label>
              <input type="range" id="growth" min="0" max="100" step="5" value={S.growth} onChange={(e) => set({ growth: +e.target.value })} />
              <div className="row2" style={{ marginTop: 6 }}>
                <div>
                  <label className="lab" htmlFor="horizon" style={{ fontSize: 11 }}>Forecast horizon</label>
                  <select id="horizon" value={S.horizon} onChange={(e) => set({ horizon: +e.target.value })}>
                    <option value="1">1 year</option><option value="2">2 years</option>
                    <option value="3">3 years</option><option value="4">4 years</option><option value="5">5 years</option>
                  </select>
                </div>
                <div>
                  <label className="lab" style={{ fontSize: 11 }}>GPUs already owned?</label>
                  <div className="seg">
                    <button type="button" aria-pressed={S.owns === 'no'} onClick={() => set({ owns: 'no' })}>No</button>
                    <button type="button" aria-pressed={S.owns === 'yes'} onClick={() => set({ owns: 'yes' })}>Yes</button>
                  </div>
                </div>
              </div>
            </div>

            <details className="adv">
              <summary>Advanced assumptions</summary>
              <div style={{ marginTop: 12 }}>
                <div className="row2">
                  <div className="field" style={{ marginBottom: 11 }}>
                    <label className="lab" htmlFor="opex" style={{ fontSize: 11 }}>Opex $/node/yr</label>
                    <input type="number" id="opex" step="1000" value={S.opex} onChange={setNum('opex')} />
                  </div>
                  <div className="field" style={{ marginBottom: 11 }}>
                    <label className="lab" htmlFor="sub" style={{ fontSize: 11 }}>Subscription $/node/yr</label>
                    <input type="number" id="sub" step="1000" value={S.sub} onChange={setNum('sub')} />
                  </div>
                </div>
                <div className="row3">
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label className="lab" htmlFor="disc" style={{ fontSize: 11 }}>HW disc %</label>
                    <input type="number" id="disc" min="0" max="90" value={S.disc} onChange={setNum('disc')} />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label className="lab" htmlFor="dep" style={{ fontSize: 11 }}>Deprec. yrs</label>
                    <input type="number" id="dep" min="1" max="7" value={S.dep} onChange={setNum('dep')} />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label className="lab" htmlFor="util" style={{ fontSize: 11 }}>GPU util %</label>
                    <input type="number" id="util" min="10" max="100" value={S.util} onChange={setNum('util')} />
                  </div>
                </div>
                <div className="mini" style={{ marginTop: 9 }}>Node throughput and capex come from the selected GPU platform and drive how many nodes your workload needs.</div>
              </div>
            </details>

          </div>
        </aside>

        {/* ============ RESULTS ============ */}
        <main className="results">

          <Kpis S={S} f={f} />

          <section className="panel">
            <div className="phead"><h2>What your AI spend looks like today</h2><span className="hint">vs Ramp benchmark</span></div>
            <div className="pbody">
              <div className="twrap">
                <svg viewBox="0 0 720 100" width="100%" role="img" aria-label="Spend benchmark vs Ramp percentiles"
                  dangerouslySetInnerHTML={{ __html: bench.svg }} />
              </div>
              <div className="callout" dangerouslySetInnerHTML={{ __html: bench.note }} />
            </div>
          </section>

          <section className="panel">
            <div className="phead"><h2>Forecast — cumulative spend</h2><span className="hint">{chart.hint}</span></div>
            <div className="pbody">
              <div className="chart-legend">
                <span className="lg"><span className="swatch" style={{ background: 'var(--bad)' }}></span>All-frontier API (baseline)</span>
                <span className="lg"><span className="swatch" style={{ background: 'var(--accent)' }}></span>Hybrid + local GPU</span>
                <span className="lg"><span className="swatch" style={{ background: 'var(--good)', height: 9, width: 9, borderRadius: '50%' }}></span>Payback</span>
              </div>
              <div className="twrap">
                <svg viewBox="0 0 720 260" width="100%" role="img" aria-label="Cumulative cost forecast chart"
                  dangerouslySetInnerHTML={{ __html: chart.svg }} />
              </div>
              <div className="callout" dangerouslySetInnerHTML={{ __html: chart.verdict }} />
            </div>
          </section>

          <section className="panel">
            <div className="phead"><h2>Cost by year</h2><span className="hint">cumulative spend</span></div>
            <div className="pbody" style={{ padding: 0 }}>
              <YearTable S={S} f={f} />
            </div>
          </section>

          <div className="grid-2">
            <section className="panel">
              <div className="phead"><h2>Cost by model</h2><span className="hint">this workload, per month</span></div>
              <div className="pbody" style={{ padding: 0 }}>
                <ModelTable S={S} f={f} onSelect={selectModelById} onSort={(k) => {
                  set(S.sortK === k ? { sortDir: S.sortDir * -1 } : { sortK: k, sortDir: 1 })
                }} />
              </div>
            </section>

            <section className="panel">
              <div className="phead"><h2>Hardware &amp; capacity</h2><span className="hint">local path</span></div>
              <div className="pbody"><Capacity S={S} f={f} /></div>
            </section>
          </div>

          <section className="panel">
            <div className="phead"><h2>Compare two models</h2><span className="hint">intensity · quality · cost for {p.name}</span></div>
            <div className="pbody">
              <Compare S={S} f={f} P={p} onSet={set} />
            </div>
          </section>

          <section className="panel">
            <div className="phead"><h2>Beyond cost — why teams run inference locally</h2><span className="hint">the non-$ case</span></div>
            <div className="pbody">
              <div className="benefits">
                {BENEFITS.map((b, i) => (
                  <div className="bcard" key={i}>
                    <h3>{b.h}</h3>
                    <p>{b.p}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

        </main>
      </div>
    </>
  )
}

/* ---------- KPIs ---------- */
function Kpis({ S, f }) {
  const c = f.cur
  const savePctV = c.apiMonth > 0 ? (c.savingMonth / c.apiMonth) * 100 : 0
  const totalSave = f.cumApi - f.cumHybrid
  const pb = f.payback ? (f.payback < 12 ? f.payback + ' mo' : (f.payback / 12).toFixed(1) + ' yr') : '—'
  const tiles = [
    { cls: 'bad', label: 'All-API monthly', val: fmt(c.apiMonth), sub: model(S.model).name + ' · full volume' },
    { cls: '', label: 'Hybrid monthly', val: fmt(c.hybridMonth), sub: c.nodes + ' node' + (c.nodes > 1 ? 's' : '') + ' + ' + S.frontier + '% frontier' },
    { cls: c.savingMonth >= 0 ? 'good' : 'bad', label: 'Monthly saving', val: fmt(c.savingMonth),
      sub: <span className={'chip ' + (c.savingMonth >= 0 ? 'g' : 'b')}>{pct(savePctV) + ' vs API'}</span> },
    { cls: 'warn', label: 'Payback', val: pb, sub: S.horizon + '-yr saving ' + fmt(totalSave) },
  ]
  return (
    <section className="kpis">
      {tiles.map((tl, i) => (
        <div className={'kpi ' + tl.cls} key={i}>
          <div className="k-label">{tl.label}</div>
          <div className="k-val num">{tl.val}</div>
          <div className="k-sub">{tl.sub}</div>
        </div>
      ))}
    </section>
  )
}

/* ---------- Compare two models ---------- */
function Compare({ S, f, P, onSet }) {
  const t = f.tokens
  const A = model(S.cmpA), B = model(S.cmpB)
  const costA = A.local ? null : apiCost(A, t.inTok, t.outTok)
  const costB = B.local ? null : apiCost(B, t.inTok, t.outTok)

  const fitA = fitScore(A, P), fitB = fitScore(B, P)
  const valA = valueScore(A, P, costA), valB = valueScore(B, P, costB)

  // winner helpers. 'A' | 'B' | 'Tie' | '—' (— when not comparable)
  const winLow = (av, bv) => (av == null || bv == null) ? '—' : (av === bv ? 'Tie' : (av < bv ? 'A' : 'B'))
  const winHigh = (av, bv) => (av == null || bv == null) ? '—' : (av === bv ? 'Tie' : (av > bv ? 'A' : 'B'))

  const wCost = winLow(costA, costB)
  const wIn = winLow(A.local ? null : A.in, B.local ? null : B.in)
  const wOut = winLow(A.local ? null : A.out, B.local ? null : B.out)
  const wQual = winHigh(A.quality, B.quality)
  const wInt = winHigh(A.intensity, B.intensity)
  const wFit = winHigh(fitA, fitB)
  const wVal = winHigh(valA, valB)

  const money = (c) => (c == null ? 'GPU only' : fmtFull(c))
  const stars = (n) => n.toFixed(1) + ' / 5'

  const BestCell = ({ w }) => {
    if (w === 'A') return <span className="chip g">A wins</span>
    if (w === 'B') return <span className="chip g">B wins</span>
    if (w === 'Tie') return <span className="chip n">Tie</span>
    return <span className="chip n">n/a</span>
  }
  const nameFor = (w) => (w === 'A' ? A.name : w === 'B' ? B.name : null)

  const rows = [
    { label: 'Quality', a: stars(A.quality), b: stars(B.quality), w: wQual },
    { label: 'Intensity (complex/long-context)', a: stars(A.intensity), b: stars(B.intensity), w: wInt },
    { label: 'Fit for ' + P.name + ' (0–100)', a: fitA.toFixed(0), b: fitB.toFixed(0), w: wFit },
    { label: '$/month · this workload', a: money(costA), b: money(costB), w: wCost },
    { label: 'Value (fit per $1k/mo)', a: valA == null ? '—' : valA.toFixed(1), b: valB == null ? '—' : valB.toFixed(1), w: wVal },
    { label: 'Input $/1M', a: A.local ? '—' : '$' + A.in, b: B.local ? '—' : '$' + B.in, w: wIn },
    { label: 'Output $/1M', a: A.local ? '—' : '$' + A.out, b: B.local ? '—' : '$' + B.out, w: wOut },
    { label: 'Tier', a: A.tier, b: B.tier, w: '—' },
    { label: 'Vendor', a: A.vendor, b: B.vendor, w: '—' },
  ]

  // headline: lead with fit for the purpose, then the cost trade-off
  const bestFit = fitA >= fitB ? A : B
  let headline
  if (fitA === fitB && costA != null && costB != null) {
    const cheaper = costA <= costB ? A : B
    headline = <span><b>{A.name}</b> and <b>{B.name}</b> score the same fit ({fitA.toFixed(0)}/100) for {P.name} — <b>{cheaper.name}</b> wins on cost.</span>
  } else if (costA != null && costB != null) {
    const cheaper = costA < costB ? A : B
    const sameWinner = bestFit === cheaper
    headline = sameWinner
      ? <span><b>{bestFit.name}</b> wins on both fit ({(bestFit === A ? fitA : fitB).toFixed(0)}/100) and cost for the {P.name} workload — the clear pick.</span>
      : <span><b>{bestFit.name}</b> is the better fit ({(bestFit === A ? fitA : fitB).toFixed(0)}/100 vs {(bestFit === A ? fitB : fitA).toFixed(0)}) for {P.name}, but <b>{cheaper.name}</b> is {fmtFull(Math.abs(costA - costB))}/mo cheaper. Pick fit for hard tasks, cost for volume.</span>
  } else {
    headline = <span>For {P.name}, <b>{bestFit.name}</b> has the higher fit ({(bestFit === A ? fitA : fitB).toFixed(0)}/100) on quality + intensity. One side is GPU-served — weigh it against <b>Hardware &amp; capacity</b> above.</span>
  }

  const verdicts = [
    { k: 'Higher quality', w: wQual },
    { k: 'Higher intensity', w: wInt },
    { k: 'Best fit (' + P.name + ')', w: wFit },
    { k: 'Cheaper', w: wCost },
    { k: 'Best value', w: wVal },
  ]

  return (
    <>
      <div className="row2" style={{ marginBottom: 14 }}>
        <div>
          <label className="lab" style={{ fontSize: 11 }}>Model A</label>
          <select value={S.cmpA} onChange={(e) => onSet({ cmpA: e.target.value })}>
            {MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="lab" style={{ fontSize: 11 }}>Model B</label>
          <select value={S.cmpB} onChange={(e) => onSet({ cmpB: e.target.value })}>
            {MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>

      <div className="twrap">
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th><span className="dot" style={{ background: A.color }}></span>A · {A.name}</th>
              <th><span className="dot" style={{ background: B.color }}></span>B · {B.name}</th>
              <th>Best</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={{ color: 'var(--ink-2)' }}>{r.label}</td>
                <td className="num" style={{ fontWeight: r.w === 'A' ? 700 : 400, color: r.w === 'A' ? 'var(--good)' : 'var(--ink)' }}>{r.a}</td>
                <td className="num" style={{ fontWeight: r.w === 'B' ? 700 : 400, color: r.w === 'B' ? 'var(--good)' : 'var(--ink)' }}>{r.b}</td>
                <td><BestCell w={r.w} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="callout" style={{ marginTop: 12 }}>{headline}</div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        {verdicts.map((v, i) => (
          <span className="chip n" style={{ padding: '6px 10px' }} key={i}>
            {v.k}: <b style={{ color: 'var(--ink)', marginLeft: 4 }}>{nameFor(v.w) || (v.w === 'Tie' ? 'Tie' : 'n/a')}</b>
          </span>
        ))}
      </div>
    </>
  )
}

/* ---------- Cost by year ---------- */
function YearTable({ S, f }) {
  const rows = []
  for (let y = 1; y <= S.horizon; y++) {
    const idx = Math.min(f.apiSeries.length - 1, y * 12 - 1)
    const api = f.apiSeries[idx], hyb = f.hybSeries[idx], save = api - hyb
    rows.push({ y, api, hyb, save, pctv: api > 0 ? (save / api) * 100 : 0 })
  }
  return (
    <div className="twrap">
      <table>
        <thead>
          <tr>
            <th>Horizon</th>
            <th>All-API</th>
            <th>Hybrid</th>
            <th>Saving</th>
            <th>vs API</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.y}>
              <td>{r.y} year{r.y > 1 ? 's' : ''}</td>
              <td className="num">{fmtFull(r.api)}</td>
              <td className="num">{fmtFull(r.hyb)}</td>
              <td className="num" style={{ color: r.save >= 0 ? 'var(--good)' : 'var(--bad)', fontWeight: 600 }}>{fmtFull(r.save)}</td>
              <td><span className={'chip ' + (r.save >= 0 ? 'g' : 'b')}>{pct(r.pctv)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ---------- Model table ---------- */
function ModelTable({ S, f, onSelect, onSort }) {
  const t = f.tokens
  const P = PURPOSES[S.purpose]
  const bestId = P.best
  let rows = MODELS.map((m) => ({ m, cost: m.local ? null : apiCost(m, t.inTok, t.outTok), fit: fitScore(m, P) }))
  const priced = rows.filter((r) => r.cost != null)
  const maxCost = Math.max(...priced.map((r) => r.cost), 1)
  const minCost = Math.min(...priced.map((r) => r.cost))
  rows = [...rows].sort((a, b) => {
    if (S.sortK === 'name') return S.sortDir * a.m.name.localeCompare(b.m.name)
    if (S.sortK === 'tier') return S.sortDir * a.m.tier.localeCompare(b.m.tier)
    if (S.sortK === 'fit') return S.sortDir * (a.fit - b.fit)
    const av = a.cost == null ? Infinity : a.cost, bv = b.cost == null ? Infinity : b.cost
    return S.sortDir * (av - bv)
  })
  const arrow = (k) => (S.sortK === k ? (S.sortDir === 1 ? ' ▾' : ' ▴') : '')

  return (
    <div className="twrap">
      <table>
        <thead>
          <tr>
            <th onClick={() => onSort('name')}>Model{arrow('name')}</th>
            <th onClick={() => onSort('tier')}>Tier{arrow('tier')}</th>
            <th onClick={() => onSort('fit')}>Fit{arrow('fit')}</th>
            <th onClick={() => onSort('cost')}>$/month{arrow('cost')}</th>
            <th onClick={() => onSort('cost')}>Relative</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const m = r.m, isSel = m.id === S.model
            return (
              <tr key={m.id} className={isSel ? 'sel' : ''} onClick={() => onSelect(m.id)}>
                <td>
                  <span className="dot" style={{ background: m.color }}></span>{m.name}
                  {m.id === bestId && <span className="chip a" style={{ marginLeft: 6, padding: '1px 6px' }} title="Recommended for the selected purpose">Best</span>}
                  <div className="vend">{m.vendor} · Q {m.quality.toFixed(1)} · I {m.intensity.toFixed(1)}</div>
                </td>
                <td><span className={'chip ' + (m.tier === 'Frontier' ? 'b' : m.local ? 'a' : 'n')}>{m.tier}</span></td>
                <td style={{ minWidth: 92 }}>
                  <div className="num" style={{ fontWeight: 600 }}>{r.fit.toFixed(0)}</div>
                  <div className="bar"><span style={{ width: r.fit + '%', background: 'var(--good)' }}></span></div>
                </td>
                <td>{r.cost == null ? <span className="chip n">GPU only</span> : <span className="num">{fmtFull(r.cost)}</span>}</td>
                <td style={{ minWidth: 120 }}>
                  {r.cost == null ? (
                    <span className="vend">flat GPU cost →</span>
                  ) : (
                    <>
                      <div className="bar"><span style={{ width: Math.max(3, (r.cost / maxCost) * 100) + '%', background: m.color }}></span></div>
                      <div className="vend num" style={{ marginTop: 2 }}>{(minCost > 0 ? (r.cost / minCost).toFixed(1) + '×' : '') + ' cheapest'}</div>
                    </>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ---------- Hardware & capacity ---------- */
function Capacity({ S, f }) {
  const c = f.cur, g = gpu(S.gpu), t = f.tokens
  const lm = model(S.localModel)
  const capexTotal = S.owns === 'yes' ? 0 : c.nodes * nodeCapex(S)
  const monthlyTok = t.inTok + t.outTok
  const localShare = 1 - S.frontier / 100
  const localTok = monthlyTok * localShare
  const localOutTok = t.outTok * localShare
  const rate = rateStats(S, localOutTok)
  const streamsPerNode = maxStreamsPerNode(S)
  const peakUsersLocal = peakConcurrentUsers(S) * localShare
  const nThru = nodesThroughput(S, localOutTok)
  const nConc = nodesConcurrency(S, peakUsersLocal)
  const bind = nConc > nThru ? 'concurrency / SLA' : nThru > nConc ? 'throughput' : 'both equally'
  const localMonthlyFull = c.nodes * (nodeMonthlyRun(S) + (S.owns === 'yes' ? 0 : nodeCapex(S) / (S.dep * 12)))
  const apiPerM = c.apiMonth / Math.max(1, monthlyTok / 1e6)
  const localPerM = localMonthlyFull / Math.max(1, localTok / 1e6)
  const mult = apiPerM / localPerM
  const power = S.opex * OPEX_REF.powerShare, rack = S.opex * (1 - OPEX_REF.powerShare)
  const perDevApi = apiCostSelected(S, t.inTok / S.seats, t.outTok / S.seats)

  const rows = [
    ['Monthly LLM calls', num(t.calls)],
    ['Monthly tokens (in+out)', num(monthlyTok)],
    ['Local model (self-hosted)', lm.name + ' · ' + lm.params + 'B'],
    ['Node throughput (this model)', num(nodeEffTps(S)) + ' tok/s @ ' + S.util + '% util'],
    ['Avg / peak output rate', num(rate.avgTps) + ' / ' + num(rate.peakTps) + ' tok/s · ' + S.peak + '× burst'],
    ['SLA · tok/s per user', S.slaTps + ' tok/s → ' + num(streamsPerNode) + ' streams/node'],
    ['Peak concurrent users (local)', num(peakUsersLocal) + ' · ' + S.concPct + '% of ' + num(S.seats) + ' seats'],
    ['Nodes — throughput vs concurrency', nThru + ' vs ' + nConc + ' → ' + Math.max(nThru, nConc)],
    ['GPU nodes required', c.nodes + ' × ' + g.name.replace(/^\d+× /, '')],
    ['Upfront hardware', S.owns === 'yes' ? '$0 (owned)' : fmtFull(capexTotal)],
    ['↳ Power & cooling / node·yr', fmtFull(power) + ' · ' + num(OPEX_REF.kwhPerNode) + ' kWh · ' + OPEX_REF.pue + ' PUE'],
    ['↳ Rack, ops & network / node·yr', fmtFull(rack)],
    ['Subscription / node·yr', fmtFull(S.sub)],
    ['API blended $ / 1M tokens', fmtFull(apiPerM)],
    ['Local $ / 1M tokens (served)', fmtFull(localPerM)],
  ]

  let chipCls, chipTxt, band
  if (mult >= EFF_BAND[0] && mult <= EFF_BAND[1]) { chipCls = 'g'; chipTxt = 'in band'; band = 'right inside the cited 2.9–4.1× on-prem efficiency range.' }
  else if (mult > EFF_BAND[1]) { chipCls = 'g'; chipTxt = 'above band'; band = 'beats Dell/ESG’s 2.9–4.1× — the node is heavily utilized.' }
  else { chipCls = 'b'; chipTxt = 'below band'; band = 'under Dell/ESG’s 2.9–4.1× — raise utilization, local share, or use a smaller node to reach it.' }

  return (
    <>
      <table style={{ fontSize: 13 }}>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={{ color: 'var(--ink-2)' }}>{r[0]}</td>
              <td className="num" style={{ fontWeight: 600 }}>{r[1]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="callout" style={{ marginTop: 12 }}>
        <span className={'chip ' + (bind === 'throughput' ? 'a' : bind === 'concurrency / SLA' ? 'b' : 'n')} style={{ flex: 'none' }}>{bind}</span>
        <span>Sizing is bound by <b>{bind}</b> — {c.nodes} node{c.nodes === 1 ? '' : 's'} needed ({nThru} for peak throughput, {nConc} to serve {num(peakUsersLocal)} concurrent users at {S.slaTps} tok/s). {nConc > nThru ? 'Lower the SLA or concurrency, or add nodes, to hold latency.' : 'Throughput drives the count here; SLA is comfortably met.'}</span>
      </div>

      <div className="callout" style={{ marginTop: 12 }}>
        <span className={'chip ' + chipCls}>{chipTxt}</span>
        <span>Local inference is <b className="num">{isFinite(mult) ? mult.toFixed(1) : '—'}×</b> cheaper per token than {model(S.model).name} here — {band}</span>
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="k-label" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--ink-2)', fontWeight: 600, marginBottom: 8 }}>
          Cost per developer / month (this model)
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {DEV_TIERS.map((d, i) => (
            <span className="chip n" style={{ padding: '6px 10px' }} key={i}>
              {d.n} · <span className="num" style={{ color: 'var(--ink)' }}>{fmtFull(perDevApi * (d.v / 550))}</span>
            </span>
          ))}
        </div>
        <div className="mini" style={{ marginTop: 6 }}>Scaled from this scenario’s per-seat API spend against Gartner’s $100–$1,000+ range.</div>
      </div>
    </>
  )
}
