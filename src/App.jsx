import { useEffect, useState } from 'react'
import CostCalculator from './CostCalculator.jsx'
import GpuUtilization from './GpuUtilization.jsx'
import GaasBilling from './GaasBilling.jsx'
import NetworkEquipment from './NetworkEquipment.jsx'

const TABS = [
  { id: 'calc', label: 'Cost Calculator' },
  { id: 'util', label: 'GPU Utilization' },
  { id: 'gaas', label: 'GPU-as-a-Service' },
  { id: 'net', label: 'Network Equipment' },
]

export default function App() {
  const [tab, setTab] = useState('calc')
  const [theme, setTheme] = useState(null) // null = system

  useEffect(() => {
    if (theme) document.documentElement.setAttribute('data-theme', theme)
    else document.documentElement.removeAttribute('data-theme')
  }, [theme])

  const toggleTheme = () => {
    const cur = theme
    const isDark = cur ? cur === 'dark' : window.matchMedia('(prefers-color-scheme:dark)').matches
    setTheme(isDark ? 'light' : 'dark')
  }

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
        <div className="top-inner" style={{ paddingTop: 0 }}>
          <div className="seg" role="tablist" style={{ width: '100%' }}>
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {tab === 'calc' && <CostCalculator />}
      {tab === 'util' && <GpuUtilization />}
      {tab === 'gaas' && <GaasBilling />}
      {tab === 'net' && <NetworkEquipment />}
    </>
  )
}
