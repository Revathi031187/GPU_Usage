import { useMemo, useState } from 'react'
import { fmt, fmtFull, num } from './calc.js'
import { UTIL_NODES } from './utilization.data.js'
import { nodeMonthlyTCO } from './utilization.calc.js'
import { TENANTS, GAAS_RATE_PRESETS, RESERVE_HEADROOM_PCT_DEFAULT } from './gaas.data.js'
import { tenantBill, tenantGpuHoursEquivalent, freedCapacityGpuHoursMonth, monetizationSummary } from './gaas.calc.js'

const AVG_GPUHR_RATE = GAAS_RATE_PRESETS.gpuhr.reduce((a, b) => a + b, 0) / GAAS_RATE_PRESETS.gpuhr.length

export default function GaasBilling() {
  const [reservePct, setReservePct] = useState(RESERVE_HEADROOM_PCT_DEFAULT)

  const freedHours = useMemo(() => freedCapacityGpuHoursMonth(UTIL_NODES, reservePct), [reservePct])
  const summary = useMemo(() => monetizationSummary(TENANTS, freedHours), [freedHours])
  const totalFleetTCO = useMemo(() => UTIL_NODES.reduce((a, n) => a + nodeMonthlyTCO(n), 0), [])
  const unsoldOpportunity = summary.unmonetizedHours * AVG_GPUHR_RATE

  return (
    <div className="wrap">
      {/* ============ CONTROLS ============ */}
      <aside className="panel controls">
        <div className="phead"><h2>GPU-as-a-Service</h2><span className="hint">sample billing</span></div>
        <div className="pbody">

          <div className="callout" style={{ alignItems: 'center' }}>
            <span className="chip n" style={{ flex: 'none' }}>Sample data</span>
            <span>5 illustrative tenants with sample usage and pricing — not real client accounts or a live billing system. Freed capacity is read from the GPU Utilization tab's sample fleet.</span>
          </div>

          <div className="field" style={{ marginTop: 14 }}>
            <label className="lab" htmlFor="reserve">Reserved headroom <span className="v">{reservePct}%</span></label>
            <input type="range" id="reserve" min="0" max="50" step="5" value={reservePct}
              onChange={(e) => setReservePct(+e.target.value)} />
            <div className="mini">Share of idle capacity always held back for the owner's own workloads, before the rest is offered for sale.</div>
          </div>

          <div className="field">
            <label className="lab">Rate presets</label>
            <div className="mini">$/GPU-hr: {GAAS_RATE_PRESETS.gpuhr.map((r) => '$' + r.toFixed(2)).join(' · ')}</div>
            <div className="mini">$/1M tokens: {GAAS_RATE_PRESETS.tokens.map((r) => '$' + r.toFixed(2)).join(' · ')}</div>
          </div>

        </div>
      </aside>

      {/* ============ RESULTS ============ */}
      <main className="results">

        <section className="kpis">
          <div className="kpi">
            <div className="k-label">Freed capacity pool</div>
            <div className="k-val num">{num(freedHours)} hrs/mo</div>
            <div className="k-sub">after {reservePct}% reserved headroom</div>
          </div>
          <div className="kpi good">
            <div className="k-label">Monetized revenue</div>
            <div className="k-val num">{fmt(summary.monetizedRevenue)}/mo</div>
            <div className="k-sub">{TENANTS.length} sample tenants</div>
          </div>
          <div className="kpi">
            <div className="k-label">% of freed pool sold</div>
            <div className="k-val num">{summary.pctMonetized.toFixed(0)}%</div>
            <div className="k-sub">{num(summary.monetizedHours)} of {num(freedHours)} hrs/mo</div>
          </div>
          <div className="kpi warn">
            <div className="k-label">Unsold opportunity</div>
            <div className="k-val num">{fmt(unsoldOpportunity)}/mo</div>
            <div className="k-sub">{num(summary.unmonetizedHours)} hrs/mo at blended rate</div>
          </div>
        </section>

        <section className="panel">
          <div className="phead"><h2>Sample tenant billing</h2><span className="hint">this month</span></div>
          <div className="pbody" style={{ padding: 0 }}>
            <div className="twrap">
              <table>
                <thead>
                  <tr>
                    <th>Tenant</th>
                    <th>Plan</th>
                    <th>Usage</th>
                    <th>Rate</th>
                    <th>GPU-hr equiv.</th>
                    <th>Bill</th>
                  </tr>
                </thead>
                <tbody>
                  {TENANTS.map((t) => (
                    <tr key={t.id}>
                      <td>{t.name}</td>
                      <td><span className={'chip ' + (t.pricing === 'gpuhr' ? 'a' : 'n')}>{t.pricing === 'gpuhr' ? '$/GPU-hr' : '$/1M tok'}</span></td>
                      <td className="num">{t.pricing === 'gpuhr' ? num(t.gpuHoursMonth) + ' hrs' : num(t.tokensMonthM) + 'M tok'}</td>
                      <td className="num">${t.rate.toFixed(2)}</td>
                      <td className="num">{num(tenantGpuHoursEquivalent(t))} hrs</td>
                      <td className="num" style={{ fontWeight: 600 }}>{fmtFull(tenantBill(t))}/mo</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="phead"><h2>Freed capacity utilization</h2><span className="hint">monetized vs. total freed</span></div>
          <div className="pbody">
            <div className="bar" style={{ height: 10 }}>
              <span style={{ width: summary.pctMonetized + '%', background: 'var(--good)' }}></span>
            </div>
            <div className="callout" style={{ marginTop: 12 }}>
              <span>These are the same freed hours identified in the <b>GPU Utilization</b> tab's right-sizing analysis — monetizing
                <b> {fmt(summary.monetizedRevenue)}/mo</b> of it offsets roughly <b className="num">{(totalFleetTCO > 0 ? (summary.monetizedRevenue / totalFleetTCO) * 100 : 0).toFixed(0)}%</b> of
                the sample fleet's total monthly TCO ({fmt(totalFleetTCO)}/mo).</span>
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}
