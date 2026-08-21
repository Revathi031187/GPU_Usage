import { useMemo, useState } from 'react'
import { gpu } from './data.js'
import { fmt, fmtFull, num } from './calc.js'
import { UTIL_NODES, ASSUMED_FLAT_UTIL } from './utilization.data.js'
import {
  avgUtil, peakUtil, minUtil, idleWasteMonthly, provisioningGapMonthly,
  suggestRightSize, fleetSummary,
} from './utilization.calc.js'

export default function GpuUtilization() {
  const [selectedId, setSelectedId] = useState(UTIL_NODES[0].id)
  const [targetUtilPct, setTargetUtilPct] = useState(70)

  const rows = useMemo(() => UTIL_NODES.map((n) => ({
    node: n,
    avg: avgUtil(n),
    peak: peakUtil(n),
    min: minUtil(n),
    waste: idleWasteMonthly(n),
    gap: provisioningGapMonthly(n, ASSUMED_FLAT_UTIL),
    suggestion: suggestRightSize(n, targetUtilPct),
  })), [targetUtilPct])

  const summary = useMemo(
    () => fleetSummary(UTIL_NODES, ASSUMED_FLAT_UTIL, targetUtilPct),
    [targetUtilPct],
  )

  const selected = UTIL_NODES.find((n) => n.id === selectedId)

  const totalSuggestedSaving = rows.reduce((a, r) => a + (r.suggestion ? Math.max(0, r.suggestion.monthlySaving) : 0), 0)

  return (
    <div className="wrap">
      {/* ============ CONTROLS ============ */}
      <aside className="panel controls">
        <div className="phead"><h2>GPU Utilization</h2><span className="hint">sample fleet</span></div>
        <div className="pbody">

          <div className="callout" style={{ alignItems: 'center' }}>
            <span className="chip n" style={{ flex: 'none' }}>Sample data</span>
            <span>Simulated hourly utilization for 8 illustrative GPU nodes — not live telemetry. Real integration would pull this from DCGM/<code>nvidia-smi</code> exporters or cloud GPU metrics.</span>
          </div>

          <div className="field" style={{ marginTop: 14 }}>
            <label className="lab" htmlFor="util-node">Node detail chart</label>
            <select id="util-node" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {UTIL_NODES.map((n) => <option key={n.id} value={n.id}>{n.name + ' — ' + n.pool}</option>)}
            </select>
            <div className="mini">{gpu(selected.gpuId).note}</div>
          </div>

          <div className="field">
            <label className="lab" htmlFor="target-util">Right-size target utilization <span className="v">{targetUtilPct}%</span></label>
            <input type="range" id="target-util" min="30" max="95" step="5" value={targetUtilPct}
              onChange={(e) => setTargetUtilPct(+e.target.value)} />
            <div className="mini">The utilization ceiling a right-sizing suggestion should still comfortably cover.</div>
          </div>

        </div>
      </aside>

      {/* ============ RESULTS ============ */}
      <main className="results">

        <section className="kpis">
          <div className="kpi warn">
            <div className="k-label">Fleet avg utilization</div>
            <div className="k-val num">{summary.avgFleetUtil.toFixed(0)}%</div>
            <div className="k-sub">vs {ASSUMED_FLAT_UTIL}% flat assumption</div>
          </div>
          <div className="kpi bad">
            <div className="k-label">Idle-time waste</div>
            <div className="k-val num">{fmt(summary.totalIdleWaste)}/mo</div>
            <div className="k-sub">paid for genuinely unused capacity</div>
          </div>
          <div className="kpi bad">
            <div className="k-label">Provisioning gap</div>
            <div className="k-val num">{fmt(summary.totalProvisioningGap)}/mo</div>
            <div className="k-sub">vs the flat {ASSUMED_FLAT_UTIL}% assumption specifically</div>
          </div>
          <div className="kpi warn">
            <div className="k-label">Nodes flagged</div>
            <div className="k-val num">{summary.rightSizeCount} / {UTIL_NODES.length}</div>
            <div className="k-sub">candidates for right-sizing</div>
          </div>
        </section>

        <section className="panel">
          <div className="phead"><h2>Per-node utilization</h2><span className="hint">sample telemetry</span></div>
          <div className="pbody" style={{ padding: 0 }}>
            <div className="twrap">
              <table>
                <thead>
                  <tr>
                    <th>Node</th>
                    <th>GPU</th>
                    <th>Avg / Peak / Min</th>
                    <th>Idle waste</th>
                    <th>Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.node.id} className={r.node.id === selectedId ? 'sel' : ''} onClick={() => setSelectedId(r.node.id)}>
                      <td>
                        {r.node.name}
                        <div className="vend">{r.node.pool}</div>
                      </td>
                      <td><span className="vend">{gpu(r.node.gpuId).name.replace(/^\d+× /, '')}</span></td>
                      <td style={{ minWidth: 120 }}>
                        <div className="num" style={{ fontWeight: 600 }}>{r.avg.toFixed(0)}% / {r.peak.toFixed(0)}% / {r.min.toFixed(0)}%</div>
                        <div className="bar"><span style={{ width: r.avg + '%', background: r.avg < ASSUMED_FLAT_UTIL ? 'var(--bad)' : 'var(--good)' }}></span></div>
                      </td>
                      <td className="num">{fmt(r.waste)}/mo</td>
                      <td>
                        {r.suggestion
                          ? <span className="chip a">right-size</span>
                          : <span className="chip g">optimal</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="phead"><h2>Utilization over a sample day</h2><span className="hint">sample 24h utilization vs the flat {ASSUMED_FLAT_UTIL}% assumption</span></div>
          <div className="pbody">
            <div className="twrap">
              <UtilBarChart node={selected} assumedFlatUtil={ASSUMED_FLAT_UTIL} />
            </div>
            <div className="callout">
              <span>
                <b>{selected.name}</b> ({selected.pool}) averages <b className="num">{avgUtil(selected).toFixed(0)}%</b> utilization
                against the flat <b className="num">{ASSUMED_FLAT_UTIL}%</b> planning assumption — red bars mark hours where
                real (sample) usage fell short of what was provisioned for. Hover a bar for the exact hour and value.
              </span>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="phead"><h2>Right-sizing suggestions</h2><span className="hint">at {targetUtilPct}% target utilization</span></div>
          <div className="pbody" style={{ padding: 0 }}>
            <div className="twrap">
              <table>
                <thead>
                  <tr>
                    <th>Node</th>
                    <th>Current GPU</th>
                    <th>Suggested GPU</th>
                    <th>Capex delta</th>
                    <th>Monthly saving</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.filter((r) => r.suggestion).map((r) => (
                    <tr key={r.node.id}>
                      <td>{r.node.name}</td>
                      <td><span className="vend">{gpu(r.node.gpuId).name.replace(/^\d+× /, '')}</span></td>
                      <td><span className="chip a">{gpu(r.suggestion.suggestedGpuId).name.replace(/^\d+× /, '')}</span></td>
                      <td className="num" style={{ color: r.suggestion.capexDelta < 0 ? 'var(--good)' : 'var(--ink)' }}>{fmtFull(r.suggestion.capexDelta)}</td>
                      <td className="num" style={{ color: 'var(--good)', fontWeight: 600 }}>{fmt(r.suggestion.monthlySaving)}/mo</td>
                    </tr>
                  ))}
                  {rows.every((r) => !r.suggestion) && (
                    <tr><td colSpan={5} className="vend">No right-sizing candidates at this target utilization — every node is already on its cheapest fitting platform.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="callout" style={{ margin: 12 }}>
              <span className="chip g" style={{ flex: 'none' }}>opportunity</span>
              <span>Right-sizing the flagged nodes recovers roughly <b className="num">{fmt(totalSuggestedSaving)}/mo</b> — this is the pool of freed capacity the GPU-as-a-Service tab meters against.</span>
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}

/* ---------- interactive 24h utilization bar chart ---------- */
function UtilBarChart({ node, assumedFlatUtil }) {
  const [hover, setHover] = useState(null) // { i, cx, top }

  const W = 720, H = 180, pad = { l: 40, r: 16, t: 14, b: 22 }
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b
  const n = node.hourly.length
  const slot = iw / n
  const barW = slot * 0.7
  const y = (v) => pad.t + ih - (v / 100) * ih
  const x = (i) => pad.l + i * slot + (slot - barW) / 2

  const gridLines = [0, 25, 50, 75, 100]
  const refY = y(assumedFlatUtil)

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={'0 0 ' + W + ' ' + H} width="100%" role="img" aria-label={'Sample 24h utilization for ' + node.name}
        onMouseLeave={() => setHover(null)}>
        {gridLines.map((gv) => (
          <g key={gv}>
            <line className="grid" x1={pad.l} y1={y(gv)} x2={W - pad.r} y2={y(gv)} />
            <text className="axtxt" x={pad.l - 8} y={y(gv) + 3} textAnchor="end">{gv}%</text>
          </g>
        ))}

        {node.hourly.map((v, i) => {
          const bx = x(i), by = y(v), bh = pad.t + ih - by
          const isHover = hover?.i === i
          return (
            <rect key={i} x={bx} y={by} width={barW} height={bh}
              fill={v < assumedFlatUtil ? 'var(--bad)' : 'var(--accent)'}
              opacity={isHover ? 1 : 0.85}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHover({ i, cx: bx + barW / 2, top: by })}
              onMouseMove={() => setHover({ i, cx: bx + barW / 2, top: by })}
            />
          )
        })}

        {hover && (
          <line x1={hover.cx} y1={pad.t} x2={hover.cx} y2={pad.t + ih} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
        )}

        <line x1={pad.l} y1={refY} x2={W - pad.r} y2={refY} stroke="var(--ink-3)" strokeWidth="1.2" strokeDasharray="4 3" />
        <text className="axtxt" x={W - pad.r} y={refY - 5} textAnchor="end">{assumedFlatUtil}% assumed</text>
        <text className="axtxt" x={pad.l} y={H - 6} textAnchor="start">00:00</text>
        <text className="axtxt" x={W - pad.r} y={H - 6} textAnchor="end">23:00</text>
      </svg>

      {hover && (
        <div style={{
          position: 'absolute', left: (hover.cx / W) * 100 + '%', top: Math.max(0, (hover.top / H) * 100) + '%',
          transform: 'translate(-50%, -100%) translateY(-6px)', background: 'var(--ink)', color: 'var(--surface)',
          padding: '5px 9px', borderRadius: 6, fontSize: 12.5, fontFamily: 'var(--mono)', fontWeight: 600,
          whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: 'var(--shadow)',
        }}>
          {String(hover.i).padStart(2, '0')}:00 — {node.hourly[hover.i]}%
        </div>
      )}
    </div>
  )
}
