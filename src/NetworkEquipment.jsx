import { useMemo, useState } from 'react'
import { fmt, fmtFull } from './calc.js'
import { NET_DEVICES, SITES, CONSOLIDATION_UTIL_THRESHOLD_DEFAULT } from './network.data.js'
import { deviceAgeYears, deviceMonthlyTCO, refreshStatus, isConsolidationCandidate, fleetTotals } from './network.calc.js'

const STATUS_CHIP = { overdue: 'b', 'due-soon': 'a', ok: 'g' }

export default function NetworkEquipment() {
  const [site, setSite] = useState('All')
  const [utilThreshold, setUtilThreshold] = useState(CONSOLIDATION_UTIL_THRESHOLD_DEFAULT)

  const devices = useMemo(
    () => (site === 'All' ? NET_DEVICES : NET_DEVICES.filter((d) => d.site === site)),
    [site],
  )

  const totals = useMemo(() => fleetTotals(devices, 0, utilThreshold), [devices, utilThreshold])

  const byUrgency = useMemo(
    () => [...devices].sort((a, b) => (deviceAgeYears(b) / b.refreshCycleYears) - (deviceAgeYears(a) / a.refreshCycleYears)),
    [devices],
  )

  return (
    <div className="wrap">
      {/* ============ CONTROLS ============ */}
      <aside className="panel controls">
        <div className="phead"><h2>Network Equipment</h2><span className="hint">sample inventory</span></div>
        <div className="pbody">

          <div className="callout" style={{ alignItems: 'center' }}>
            <span className="chip n" style={{ flex: 'none' }}>Sample data</span>
            <span>10 illustrative switches/routers — not a real asset register. Real integration would pull utilization from SNMP/NetFlow and inventory from a CMDB.</span>
          </div>

          <div className="field" style={{ marginTop: 14 }}>
            <label className="lab" htmlFor="site">Site</label>
            <select id="site" value={site} onChange={(e) => setSite(e.target.value)}>
              {SITES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="field">
            <label className="lab" htmlFor="util-threshold">Consolidation utilization threshold <span className="v">{utilThreshold}%</span></label>
            <input type="range" id="util-threshold" min="10" max="60" step="5" value={utilThreshold}
              onChange={(e) => setUtilThreshold(+e.target.value)} />
            <div className="mini">Devices averaging below this (with peak also well under capacity) are flagged as consolidation candidates.</div>
          </div>

        </div>
      </aside>

      {/* ============ RESULTS ============ */}
      <main className="results">

        <section className="kpis">
          <div className="kpi">
            <div className="k-label">Total device TCO</div>
            <div className="k-val num">{fmt(totals.totalMonthlyTCO)}/mo</div>
            <div className="k-sub">{devices.length} devices{site !== 'All' ? ' · ' + site : ''}</div>
          </div>
          <div className="kpi bad">
            <div className="k-label">Overdue for refresh</div>
            <div className="k-val num">{totals.overdueCount}</div>
            <div className="k-sub">past their refresh cycle</div>
          </div>
          <div className="kpi warn">
            <div className="k-label">Consolidation candidates</div>
            <div className="k-val num">{totals.consolidationCount}</div>
            <div className="k-sub">below {utilThreshold}% avg utilization</div>
          </div>
          <div className="kpi good">
            <div className="k-label">Consolidation saving</div>
            <div className="k-val num">{fmt(totals.consolidationSavingMonthly)}/mo</div>
            <div className="k-sub">if flagged devices are retired</div>
          </div>
        </section>

        <section className="panel">
          <div className="phead"><h2>Device inventory</h2><span className="hint">sample</span></div>
          <div className="pbody" style={{ padding: 0 }}>
            <div className="twrap">
              <table>
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Type</th>
                    <th>Site</th>
                    <th>Age</th>
                    <th>Avg / Peak util</th>
                    <th>Monthly TCO</th>
                    <th>Refresh</th>
                    <th>Consolidation</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((d) => (
                    <tr key={d.id}>
                      <td>{d.name}<div className="vend">{d.capacityGbps} Gbps</div></td>
                      <td><span className="vend">{d.type}</span></td>
                      <td><span className="vend">{d.site}</span></td>
                      <td className="num">{deviceAgeYears(d)} yr</td>
                      <td style={{ minWidth: 110 }}>
                        <div className="num" style={{ fontWeight: 600 }}>{d.avgUtilPct}% / {d.peakUtilPct}%</div>
                        <div className="bar"><span style={{ width: d.avgUtilPct + '%', background: d.avgUtilPct < utilThreshold ? 'var(--bad)' : 'var(--good)' }}></span></div>
                      </td>
                      <td className="num">{fmt(deviceMonthlyTCO(d))}</td>
                      <td><span className={'chip ' + STATUS_CHIP[refreshStatus(d)]}>{refreshStatus(d)}</span></td>
                      <td>{isConsolidationCandidate(d, utilThreshold) ? <span className="chip a">candidate</span> : <span className="chip n">keep</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="phead"><h2>Refresh timeline</h2><span className="hint">most urgent first</span></div>
          <div className="pbody" style={{ padding: 0 }}>
            <div className="twrap">
              <table>
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Purchased</th>
                    <th>Refresh cycle</th>
                    <th>Age / cycle</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {byUrgency.map((d) => {
                    const ratio = deviceAgeYears(d) / d.refreshCycleYears
                    return (
                      <tr key={d.id}>
                        <td>{d.name}</td>
                        <td className="num">{d.purchaseYear}</td>
                        <td className="num">{d.refreshCycleYears} yr</td>
                        <td style={{ minWidth: 110 }}>
                          <div className="bar"><span style={{ width: Math.min(100, ratio * 100) + '%', background: ratio > 1 ? 'var(--bad)' : ratio >= 0.8 ? 'var(--warn)' : 'var(--good)' }}></span></div>
                        </td>
                        <td><span className={'chip ' + STATUS_CHIP[refreshStatus(d)]}>{refreshStatus(d)}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="callout" style={{ margin: 12 }}>
              <span className="chip g" style={{ flex: 'none' }}>opportunity</span>
              <span>Consolidating the {totals.consolidationCount} flagged device{totals.consolidationCount === 1 ? '' : 's'} recovers roughly <b className="num">{fmt(totals.consolidationSavingMonthly)}/mo</b> ({fmtFull(totals.consolidationSavingMonthly * 12)}/yr) in avoidable TCO.</span>
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}
