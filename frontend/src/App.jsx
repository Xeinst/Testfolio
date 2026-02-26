import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './App.css'

// Use same-origin /api on Vercel; use localhost when developing locally
function getApiBase() {
  if (import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== '') return import.meta.env.VITE_API_URL
  if (typeof window !== 'undefined' && window.location?.hostname !== 'localhost' && window.location?.hostname !== '127.0.0.1') return ''
  return 'http://localhost:8000'
}
const API = getApiBase()

const TOOLS = [
  { id: 'backtester', label: 'Portfolio Backtester', icon: '📈' },
  { id: 'analyzer', label: 'Asset Analyzer', icon: '📊' },
  { id: 'optimizer', label: 'Portfolio Optimizer', icon: '⚙️' },
  { id: 'efficient', label: 'Efficient Frontier', icon: '📐' },
  { id: 'tactical', label: 'Tactical Allocation', icon: '🔄' },
  { id: 'calculators', label: 'Calculators', icon: '🧮' },
]

const REBALANCE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
]

const defaultPortfolio = () => ({ name: 'Portfolio 1', tickers: ['VTI', 'BND'], weights: [0.6, 0.4] })

function normalizeWeights(weights, n) {
  if (!n) return []
  let w = (weights || []).slice(0, n).map((x) => Math.max(0, Number(x) || 0))
  while (w.length < n) w.push(0)
  w = w.slice(0, n)
  const sum = w.reduce((a, b) => a + b, 0)
  if (sum <= 0) return Array(n).fill(1 / n)
  return w.map((x) => x / sum)
}

function App() {
  const [tool, setTool] = useState('backtester')
  const [startDate, setStartDate] = useState('2015-01-01')
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [startingValue, setStartingValue] = useState(100000)
  const [rebalanceFreq, setRebalanceFreq] = useState('yearly')
  const [adjustInflation, setAdjustInflation] = useState(false)
  const [portfolios, setPortfolios] = useState([defaultPortfolio()])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [apiOk, setApiOk] = useState(null)

  useEffect(() => {
    fetch(`${API}/`)
      .then((r) => setApiOk(r.ok))
      .catch(() => setApiOk(false))
  }, [])

  const addPortfolio = () => {
    setPortfolios((p) => [...p, { name: `Portfolio ${p.length + 1}`, tickers: ['VTI'], weights: [1] }])
  }

  const removePortfolio = (i) => {
    if (portfolios.length <= 1) return
    setPortfolios((p) => p.filter((_, j) => j !== i))
  }

  const addTicker = (portIndex) => {
    setPortfolios((p) => {
      const next = [...p]
      const port = next[portIndex]
      const tickers = [...(port.tickers || []), '']
      const n = tickers.length
      const weights = Array(n).fill(1 / n)
      next[portIndex] = { ...port, tickers, weights }
      return next
    })
  }

  const removeTicker = (portIndex, tickIndex) => {
    setPortfolios((p) => {
      const next = [...p]
      const port = next[portIndex]
      if (port.tickers.length <= 1) return p
      const tickers = port.tickers.filter((_, j) => j !== tickIndex)
      const weights = (port.weights || []).filter((_, j) => j !== tickIndex)
      const n = tickers.length
      next[portIndex] = { ...port, tickers, weights: normalizeWeights(weights, n) }
      return next
    })
  }

  const setTicker = (portIndex, tickIndex, value) => {
    const sym = (value || '').trim().toUpperCase()
    setPortfolios((p) => {
      const next = [...p]
      const tickers = [...next[portIndex].tickers]
      tickers[tickIndex] = sym
      next[portIndex] = { ...next[portIndex], tickers }
      return next
    })
  }

  const setWeight = (portIndex, tickIndex, value) => {
    const w = Number(value)
    setPortfolios((p) => {
      const next = [...p]
      const weights = [...(next[portIndex].weights || [])]
      while (weights.length <= tickIndex) weights.push(0)
      weights[tickIndex] = isNaN(w) ? 0 : w
      next[portIndex] = { ...next[portIndex], weights }
      return next
    })
  }

  const updatePortfolio = (i, field, value) => {
    setPortfolios((p) => {
      const next = [...p]
      next[i] = { ...next[i], [field]: value }
      return next
    })
  }

  const runBacktest = async () => {
    setError(null)
    setResult(null)
    setLoading(true)
    const payload = {
      portfolios: portfolios.map((p) => {
        const tickers = (p.tickers || []).filter(Boolean).map((t) => String(t).trim().toUpperCase())
        const rawWeights = p.weights || []
        const weights = tickers.length ? normalizeWeights(rawWeights, tickers.length) : []
        return { name: p.name || 'Portfolio', tickers, weights }
      }).filter((p) => p.tickers.length > 0),
      start_date: startDate,
      end_date: endDate,
      starting_value: startingValue,
      rebalance_freq: rebalanceFreq,
      adjust_inflation: adjustInflation,
    }
    if (payload.portfolios.length === 0) {
      setError('Add at least one portfolio with at least one ticker.')
      setLoading(false)
      return
    }
    try {
      const res = await fetch(`${API}/api/backtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        return
      }
      setResult(data)
    } catch (e) {
      setError(e.message || 'Request failed. Is the backend running on ' + API + '?')
    } finally {
      setLoading(false)
    }
  }

  const chartData = result?.equity_curves
    ? (() => {
        const names = Object.keys(result.equity_curves)
        const byDate = {}
        names.forEach((name) => {
          result.equity_curves[name].forEach(({ date, value }) => {
            if (!byDate[date]) byDate[date] = { date }
            byDate[date][name] = value
          })
        })
        return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
      })()
    : []

  const colors = ['#f59e0b', '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea']
  const isBenchmark = (name) => name === 'S&P 500'

  return (
    <div className="app">
      <header className="header">
        <div className="logo">testfolio</div>
        <span className="tagline">No paywall · No sign-in · No limits</span>
        {apiOk === false && (
          <span className="api-warn" title={`Backend not reachable at ${API}`}>Backend offline</span>
        )}
      </header>

      <div className="layout">
        <aside className="sidebar">
          <nav className="nav">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                className={`nav-item ${tool === t.id ? 'active' : ''}`}
                onClick={() => setTool(t.id)}
              >
                <span className="nav-icon">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>
          <div className="sidebar-footer">
            <a href="https://testfol.io/help" target="_blank" rel="noopener noreferrer">Help</a>
          </div>
        </aside>

        <main className="main">
          {tool === 'backtester' && (
            <>
              <section className="panel about-panel">
                <h2>Portfolio Backtester</h2>
                <p>
                  Add individual stocks or ETFs — unlimited tickers per portfolio. S&P 500 (SPY) is always included as a benchmark for comparison.
                </p>
              </section>

              <section className="panel params-panel">
                <h3>Parameters</h3>
                <div className="params-grid">
                  <label>
                    <span>Start date</span>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </label>
                  <label>
                    <span>End date</span>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </label>
                  <label>
                    <span>Starting value ($)</span>
                    <input
                      type="number"
                      min={1}
                      value={startingValue}
                      onChange={(e) => setStartingValue(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    <span>Rebalance</span>
                    <select value={rebalanceFreq} onChange={(e) => setRebalanceFreq(e.target.value)}>
                      {REBALANCE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={adjustInflation}
                      onChange={(e) => setAdjustInflation(e.target.checked)}
                    />
                    <span>Adjust for inflation</span>
                  </label>
                </div>
              </section>

              <section className="panel portfolios-panel">
                <div className="panel-head">
                  <h3>Portfolios</h3>
                  <button type="button" className="btn-add" onClick={addPortfolio}>Add portfolio</button>
                </div>
                <p className="benchmark-note">S&P 500 (SPY) is automatically included as a benchmark in every backtest.</p>
                {portfolios.map((p, i) => (
                  <div key={i} className="portfolio-block">
                    <div className="portfolio-row portfolio-name-row">
                      <input
                        type="text"
                        className="portfolio-name"
                        value={p.name}
                        onChange={(e) => updatePortfolio(i, 'name', e.target.value)}
                        placeholder="Portfolio name"
                      />
                      {portfolios.length > 1 && (
                        <button type="button" className="btn-remove" onClick={() => removePortfolio(i)} aria-label="Remove portfolio">×</button>
                      )}
                    </div>
                    <div className="tickers-list">
                      {(p.tickers || []).map((ticker, j) => (
                        <div key={j} className="ticker-row">
                          <input
                            type="text"
                            className="ticker-symbol"
                            value={ticker}
                            onChange={(e) => setTicker(i, j, e.target.value)}
                            placeholder="Symbol (e.g. AAPL, VTI)"
                          />
                          {(p.tickers?.length || 0) > 1 && (
                            <label className="weight-inline">
                              <span>%</span>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.5}
                                value={((p.weights?.[j] ?? 1 / (p.tickers?.length || 1)) * 100).toFixed(1)}
                                onChange={(e) => setWeight(i, j, (Number(e.target.value) || 0) / 100)}
                              />
                            </label>
                          )}
                          {p.tickers?.length > 1 && (
                            <button type="button" className="btn-remove-ticker" onClick={() => removeTicker(i, j)} aria-label="Remove ticker">×</button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button type="button" className="btn-add-ticker" onClick={() => addTicker(i)}>+ Add ticker</button>
                  </div>
                ))}
                <button type="button" className="btn-backtest" onClick={runBacktest} disabled={loading}>
                  {loading ? 'Running…' : 'Backtest'}
                </button>
              </section>

              {error && (
                <section className="panel error-panel">
                  <p>{error}</p>
                </section>
              )}

              {result && result.metrics?.length > 0 && (
                <>
                  <section className="panel results-panel">
                    <h3>Results</h3>
                    <div className="metrics-table-wrap">
                      <table className="metrics-table">
                        <thead>
                          <tr>
                            <th>Portfolio</th>
                            <th>CAGR %</th>
                            <th>Volatility %</th>
                            <th>Sharpe</th>
                            <th>Max DD %</th>
                            <th>Total return %</th>
                            <th>Final value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.metrics.map((m, i) => (
                            <tr key={i} className={isBenchmark(m.name) ? 'benchmark-row' : ''}>
                              <td>{m.name}{isBenchmark(m.name) && <span className="benchmark-badge">Benchmark</span>}</td>
                              <td>{m.cagr}</td>
                              <td>{m.volatility}</td>
                              <td>{m.sharpe}</td>
                              <td>{m.max_drawdown}</td>
                              <td>{m.total_return}</td>
                              <td>${m.final_value?.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                  {chartData.length > 0 && (
                    <section className="panel chart-panel">
                      <h3>Equity curve</h3>
                      <ResponsiveContainer width="100%" height={360}>
                        <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                          <XAxis dataKey="date" stroke="#888" fontSize={11} />
                          <YAxis stroke="#888" fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                          <Tooltip formatter={(v) => [`$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, '']} labelFormatter={(l) => l} />
                          <Legend />
                          {Object.keys(result.equity_curves).map((name, i) => (
                            <Line
                              key={name}
                              type="monotone"
                              dataKey={name}
                              stroke={colors[i % colors.length]}
                              strokeWidth={2}
                              dot={false}
                              name={name}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </section>
                  )}
                </>
              )}

            </>
          )}

          {tool !== 'backtester' && (
            <section className="panel">
              <h2>{TOOLS.find((t) => t.id === tool)?.label || tool}</h2>
              <p>Use the Portfolio Backtester for full backtesting. More tools (Asset Analyzer, Optimizer, etc.) can be added — no paywall, no sign-in.</p>
            </section>
          )}
        </main>
      </div>

      <footer className="footer">
        <p>Past performance does not indicate future results. For educational use only. Not financial advice.</p>
        <p>© Testfolio (local copy — no paywall)</p>
      </footer>
    </div>
  )
}

export default App
