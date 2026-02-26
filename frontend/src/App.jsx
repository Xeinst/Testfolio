import { useState, useEffect, useRef } from 'react'
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
  { id: 'rebalancing', label: 'Rebalancing Sensitivity', icon: '🔄' },
  { id: 'calculators', label: 'Calculators (TVM)', icon: '🧮' },
]

const REBALANCE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
]

const defaultPortfolio = () => ({ name: 'Portfolio 1', tickers: ['VTI', 'BND'], weights: [0.6, 0.4] })

const STORAGE_KEY = 'testfolio_saved'

function loadFromStorage() {
  try {
    const raw = typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return null
    return data
  } catch {
    return null
  }
}

function saveToStorage(data) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    }
  } catch (_) {}
}

function downloadAsFile(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

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
  const hasLoadedFromStorage = useRef(false)

  const [analyzerTicker, setAnalyzerTicker] = useState('SPY')
  const [analyzerResult, setAnalyzerResult] = useState(null)
  const [analyzerLoading, setAnalyzerLoading] = useState(false)
  const [optimizerTickers, setOptimizerTickers] = useState('VTI, BND, VXUS')
  const [optimizerResult, setOptimizerResult] = useState(null)
  const [optimizerLoading, setOptimizerLoading] = useState(false)
  const [frontierTickers, setFrontierTickers] = useState('VTI, BND, VXUS')
  const [frontierResult, setFrontierResult] = useState(null)
  const [frontierLoading, setFrontierLoading] = useState(false)
  const [rebalTickers, setRebalTickers] = useState('VTI, BND')
  const [rebalWeights, setRebalWeights] = useState('60, 40')
  const [rebalResult, setRebalResult] = useState(null)
  const [rebalLoading, setRebalLoading] = useState(false)
  const [tvmPv, setTvmPv] = useState('')
  const [tvmFv, setTvmFv] = useState('')
  const [tvmRate, setTvmRate] = useState('')
  const [tvmNper, setTvmNper] = useState('')
  const [tvmPmt, setTvmPmt] = useState('0')
  const [tvmResult, setTvmResult] = useState(null)

  // Load saved data from localStorage on mount
  useEffect(() => {
    const saved = loadFromStorage()
    if (saved) {
      if (saved.portfolios && Array.isArray(saved.portfolios) && saved.portfolios.length > 0) setPortfolios(saved.portfolios)
      if (saved.startDate) setStartDate(saved.startDate)
      if (saved.endDate) setEndDate(saved.endDate)
      if (saved.startingValue != null) setStartingValue(Number(saved.startingValue) || 100000)
      if (saved.rebalanceFreq) setRebalanceFreq(saved.rebalanceFreq)
      if (saved.adjustInflation != null) setAdjustInflation(!!saved.adjustInflation)
      if (saved.result && saved.result.metrics) setResult(saved.result)
    }
    hasLoadedFromStorage.current = true
  }, [])

  // Persist to localStorage whenever state changes (after initial load)
  useEffect(() => {
    if (!hasLoadedFromStorage.current) return
    saveToStorage({
      portfolios,
      startDate,
      endDate,
      startingValue,
      rebalanceFreq,
      adjustInflation,
      result: result?.metrics ? result : null,
      savedAt: new Date().toISOString(),
    })
  }, [portfolios, startDate, endDate, startingValue, rebalanceFreq, adjustInflation, result])

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

  const runAssetAnalyzer = async () => {
    setAnalyzerResult(null)
    setAnalyzerLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/asset_analyzer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: analyzerTicker.trim(), start_date: startDate, end_date: endDate }),
      })
      const data = await res.json()
      if (data.error) setError(data.error)
      else setAnalyzerResult(data)
    } catch (e) {
      setError(e.message || 'Request failed')
    } finally {
      setAnalyzerLoading(false)
    }
  }

  const runOptimizer = async () => {
    setOptimizerResult(null)
    setOptimizerLoading(true)
    setError(null)
    const tickers = optimizerTickers.split(/[\s,]+/).filter(Boolean).map((t) => t.trim().toUpperCase())
    if (tickers.length < 2) {
      setError('Enter at least 2 tickers')
      setOptimizerLoading(false)
      return
    }
    try {
      const res = await fetch(`${API}/api/optimizer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers, start_date: startDate, end_date: endDate }),
      })
      const data = await res.json()
      if (data.error) setError(data.error)
      else setOptimizerResult(data)
    } catch (e) {
      setError(e.message || 'Request failed')
    } finally {
      setOptimizerLoading(false)
    }
  }

  const runEfficientFrontier = async () => {
    setFrontierResult(null)
    setFrontierLoading(true)
    setError(null)
    const tickers = frontierTickers.split(/[\s,]+/).filter(Boolean).map((t) => t.trim().toUpperCase())
    if (tickers.length < 2) {
      setError('Enter at least 2 tickers')
      setFrontierLoading(false)
      return
    }
    try {
      const res = await fetch(`${API}/api/efficient_frontier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers, start_date: startDate, end_date: endDate }),
      })
      const data = await res.json()
      if (data.error) setError(data.error)
      else setFrontierResult(data)
    } catch (e) {
      setError(e.message || 'Request failed')
    } finally {
      setFrontierLoading(false)
    }
  }

  const runRebalancingSensitivity = async () => {
    setRebalResult(null)
    setRebalLoading(true)
    setError(null)
    const tickers = rebalTickers.split(/[\s,]+/).filter(Boolean).map((t) => t.trim().toUpperCase())
    const weights = rebalWeights.split(/[\s,]+/).map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n))
    if (!tickers.length) {
      setError('Enter at least one ticker')
      setRebalLoading(false)
      return
    }
    try {
      const res = await fetch(`${API}/api/rebalancing_sensitivity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tickers,
          weights: weights.length === tickers.length ? weights : undefined,
          start_date: startDate,
          end_date: endDate,
          starting_value: startingValue,
        }),
      })
      const data = await res.json()
      if (data.error) setError(data.error)
      else setRebalResult(data)
    } catch (e) {
      setError(e.message || 'Request failed')
    } finally {
      setRebalLoading(false)
    }
  }

  const runTvm = () => {
    setTvmResult(null)
    setError(null)
    const pv = tvmPv === '' ? null : parseFloat(tvmPv)
    const fv = tvmFv === '' ? null : parseFloat(tvmFv)
    const rate = tvmRate === '' ? null : parseFloat(tvmRate)
    const nper = tvmNper === '' ? null : parseFloat(tvmNper)
    const pmt = parseFloat(tvmPmt) || 0
    const payload = { pv, fv, rate, nper, pmt, rate_decimal: true }
    fetch(`${API}/api/tvm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setTvmResult(data)
      })
      .catch((e) => setError(e.message || 'Request failed'))
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

  const handleSaveToFile = () => {
    const data = {
      portfolios,
      startDate,
      endDate,
      startingValue,
      rebalanceFreq,
      adjustInflation,
      result: result?.metrics ? result : null,
      savedAt: new Date().toISOString(),
    }
    downloadAsFile(data, `testfolio-${new Date().toISOString().slice(0, 10)}.json`)
  }

  const handleLoadFromFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        setError(null)
        if (data.portfolios && Array.isArray(data.portfolios) && data.portfolios.length > 0) setPortfolios(data.portfolios)
        if (data.startDate) setStartDate(data.startDate)
        if (data.endDate) setEndDate(data.endDate)
        if (data.startingValue != null) setStartingValue(Number(data.startingValue) || 100000)
        if (data.rebalanceFreq) setRebalanceFreq(data.rebalanceFreq)
        if (data.adjustInflation != null) setAdjustInflation(!!data.adjustInflation)
        if (data.result && data.result.metrics) setResult(data.result)
        else setResult(null)
      } catch (_) {
        setError('Invalid file. Use a previously saved Testfolio JSON.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

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
          {error && (
            <section className="panel error-panel">
              <p>{error}</p>
            </section>
          )}
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
                  <div className="panel-actions">
                    <button type="button" className="btn-add" onClick={addPortfolio}>Add portfolio</button>
                    <button type="button" className="btn-secondary" onClick={handleSaveToFile}>Save to file</button>
                    <label className="btn-secondary btn-load">
                      Load from file
                      <input type="file" accept=".json,application/json" onChange={handleLoadFromFile} className="file-input" />
                    </label>
                  </div>
                </div>
                <p className="benchmark-note">S&P 500 (SPY) is automatically included as a benchmark in every backtest. Data is saved locally in this browser and can be exported to your computer.</p>
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

          {tool === 'analyzer' && (
            <>
              <section className="panel about-panel">
                <h2>Asset Analyzer</h2>
                <p>Single-asset stats: CAGR, volatility, Sharpe ratio, max drawdown, and rolling 1-year returns.</p>
              </section>
              <section className="panel params-panel">
                <h3>Parameters</h3>
                <div className="params-grid">
                  <label><span>Ticker</span><input type="text" value={analyzerTicker} onChange={(e) => setAnalyzerTicker(e.target.value)} placeholder="e.g. SPY, AAPL" /></label>
                  <label><span>Start date</span><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
                  <label><span>End date</span><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
                </div>
                <button type="button" className="btn-backtest" onClick={runAssetAnalyzer} disabled={analyzerLoading}>{analyzerLoading ? 'Running…' : 'Analyze'}</button>
              </section>
              {analyzerResult && !analyzerResult.error && (
                <section className="panel results-panel">
                  <h3>Results — {analyzerResult.ticker}</h3>
                  <div className="metrics-table-wrap">
                    <table className="metrics-table">
                      <tbody>
                        <tr><td>CAGR %</td><td>{analyzerResult.cagr}</td></tr>
                        <tr><td>Volatility %</td><td>{analyzerResult.volatility}</td></tr>
                        <tr><td>Sharpe</td><td>{analyzerResult.sharpe}</td></tr>
                        <tr><td>Max drawdown %</td><td>{analyzerResult.max_drawdown}</td></tr>
                        <tr><td>Total return %</td><td>{analyzerResult.total_return}</td></tr>
                        <tr><td>Years</td><td>{analyzerResult.years}</td></tr>
                        {analyzerResult.rolling_1y_min != null && <tr><td>Rolling 1Y min %</td><td>{analyzerResult.rolling_1y_min}</td></tr>}
                        {analyzerResult.rolling_1y_max != null && <tr><td>Rolling 1Y max %</td><td>{analyzerResult.rolling_1y_max}</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}

          {tool === 'optimizer' && (
            <>
              <section className="panel about-panel">
                <h2>Portfolio Optimizer</h2>
                <p>Mean-variance optimization: min-volatility and max-Sharpe portfolios.</p>
              </section>
              <section className="panel params-panel">
                <h3>Parameters</h3>
                <label><span>Tickers (comma-separated)</span><input type="text" className="tickers-input" value={optimizerTickers} onChange={(e) => setOptimizerTickers(e.target.value)} placeholder="VTI, BND, VXUS" /></label>
                <div className="params-grid"><label><span>Start date</span><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label><label><span>End date</span><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label></div>
                <button type="button" className="btn-backtest" onClick={runOptimizer} disabled={optimizerLoading}>{optimizerLoading ? 'Running…' : 'Optimize'}</button>
              </section>
              {optimizerResult && !optimizerResult.error && (
                <section className="panel results-panel">
                  <h3>Results</h3>
                  <p><strong>Min volatility:</strong> CAGR {optimizerResult.min_volatility?.cagr}% · Vol {optimizerResult.min_volatility?.volatility}% · Sharpe {optimizerResult.min_volatility?.sharpe}</p>
                  <p className="weights-display">Weights: {optimizerResult.min_volatility && Object.entries(optimizerResult.min_volatility.weights || {}).map(([k, v]) => `${k}: ${(v * 100).toFixed(1)}%`).join(', ')}</p>
                  <p><strong>Max Sharpe:</strong> CAGR {optimizerResult.max_sharpe?.cagr}% · Vol {optimizerResult.max_sharpe?.volatility}% · Sharpe {optimizerResult.max_sharpe?.sharpe}</p>
                  <p className="weights-display">Weights: {optimizerResult.max_sharpe && Object.entries(optimizerResult.max_sharpe.weights || {}).map(([k, v]) => `${k}: ${(v * 100).toFixed(1)}%`).join(', ')}</p>
                </section>
              )}
            </>
          )}

          {tool === 'efficient' && (
            <>
              <section className="panel about-panel">
                <h2>Efficient Frontier</h2>
                <p>Return vs volatility for a range of portfolios between min-vol and max-Sharpe.</p>
              </section>
              <section className="panel params-panel">
                <h3>Parameters</h3>
                <label><span>Tickers (comma-separated)</span><input type="text" className="tickers-input" value={frontierTickers} onChange={(e) => setFrontierTickers(e.target.value)} placeholder="VTI, BND, VXUS" /></label>
                <div className="params-grid"><label><span>Start date</span><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label><label><span>End date</span><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label></div>
                <button type="button" className="btn-backtest" onClick={runEfficientFrontier} disabled={frontierLoading}>{frontierLoading ? 'Running…' : 'Compute frontier'}</button>
              </section>
              {frontierResult && !frontierResult.error && frontierResult.frontier?.length > 0 && (
                <section className="panel chart-panel">
                  <h3>Efficient frontier</h3>
                  <ResponsiveContainer width="100%" height={360}>
                    <LineChart data={frontierResult.frontier} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="volatility" name="Volatility %" stroke="#888" fontSize={11} />
                      <YAxis stroke="#888" fontSize={11} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="return" stroke="#2563eb" strokeWidth={2} dot={false} name="Return %" />
                    </LineChart>
                  </ResponsiveContainer>
                </section>
              )}
            </>
          )}

          {tool === 'rebalancing' && (
            <>
              <section className="panel about-panel">
                <h2>Rebalancing Sensitivity</h2>
                <p>Compare backtest results across rebalance frequencies: daily, weekly, monthly, quarterly, yearly.</p>
              </section>
              <section className="panel params-panel">
                <h3>Parameters</h3>
                <label><span>Tickers (comma-separated)</span><input type="text" className="tickers-input" value={rebalTickers} onChange={(e) => setRebalTickers(e.target.value)} placeholder="VTI, BND" /></label>
                <label><span>Weights % (optional, comma-separated)</span><input type="text" value={rebalWeights} onChange={(e) => setRebalWeights(e.target.value)} placeholder="60, 40" /></label>
                <div className="params-grid"><label><span>Start date</span><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label><label><span>End date</span><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label><label><span>Starting value $</span><input type="number" value={startingValue} onChange={(e) => setStartingValue(Number(e.target.value))} /></label></div>
                <button type="button" className="btn-backtest" onClick={runRebalancingSensitivity} disabled={rebalLoading}>{rebalLoading ? 'Running…' : 'Run sensitivity'}</button>
              </section>
              {rebalResult && !rebalResult.error && rebalResult.results?.length > 0 && (
                <section className="panel results-panel">
                  <h3>Results by rebalance frequency</h3>
                  <div className="metrics-table-wrap">
                    <table className="metrics-table">
                      <thead><tr><th>Frequency</th><th>CAGR %</th><th>Vol %</th><th>Sharpe</th><th>Max DD %</th><th>Final value</th></tr></thead>
                      <tbody>
                        {rebalResult.results.map((r, i) => (
                          <tr key={i}><td>{r.rebalance_freq}</td><td>{r.cagr}</td><td>{r.volatility}</td><td>{r.sharpe}</td><td>{r.max_drawdown}</td><td>${r.final_value?.toLocaleString()}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rebalResult.equity_curves && Object.keys(rebalResult.equity_curves).length > 0 && (
                    <div className="chart-panel">
                      <h3>Equity curves by frequency</h3>
                      <ResponsiveContainer width="100%" height={320}>
                        <LineChart data={(() => { const byDate = {}; Object.entries(rebalResult.equity_curves).forEach(([freq, points]) => { points.forEach(({ date, value }) => { if (!byDate[date]) byDate[date] = { date }; byDate[date][freq] = value }); }); return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)) })()} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" /><XAxis dataKey="date" stroke="#888" fontSize={11} /><YAxis stroke="#888" fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} /><Tooltip /><Legend />
                          {Object.keys(rebalResult.equity_curves).map((freq, i) => <Line key={freq} type="monotone" dataKey={freq} stroke={colors[i % colors.length]} strokeWidth={2} dot={false} />)}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </section>
              )}
            </>
          )}

          {tool === 'calculators' && (
            <>
              <section className="panel about-panel">
                <h2>Time Value of Money</h2>
                <p>Solve for PV, FV, rate, or number of periods. Leave one field blank to solve for it. Rate as decimal (e.g. 0.05 = 5%).</p>
              </section>
              <section className="panel params-panel">
                <h3>Inputs</h3>
                <div className="params-grid">
                  <label><span>PV (present value)</span><input type="number" placeholder="Leave blank to solve" value={tvmPv} onChange={(e) => setTvmPv(e.target.value)} /></label>
                  <label><span>FV (future value)</span><input type="number" placeholder="Leave blank to solve" value={tvmFv} onChange={(e) => setTvmFv(e.target.value)} /></label>
                  <label><span>Rate (decimal, e.g. 0.05)</span><input type="number" step="0.01" placeholder="Leave blank to solve" value={tvmRate} onChange={(e) => setTvmRate(e.target.value)} /></label>
                  <label><span>N (periods)</span><input type="number" placeholder="Leave blank to solve" value={tvmNper} onChange={(e) => setTvmNper(e.target.value)} /></label>
                  <label><span>PMT (payment per period)</span><input type="number" value={tvmPmt} onChange={(e) => setTvmPmt(e.target.value)} /></label>
                </div>
                <button type="button" className="btn-backtest" onClick={runTvm}>Solve</button>
              </section>
              {tvmResult && !tvmResult.error && (
                <section className="panel results-panel">
                  <h3>Result</h3>
                  <p>PV: {tvmResult.pv != null ? tvmResult.pv.toLocaleString() : '—'} · FV: {tvmResult.fv != null ? tvmResult.fv.toLocaleString() : '—'} · Rate: {tvmResult.rate != null ? tvmResult.rate : '—'} · N: {tvmResult.nper != null ? tvmResult.nper : '—'} · PMT: {tvmResult.pmt}</p>
                </section>
              )}
            </>
          )}

          {!['backtester', 'analyzer', 'optimizer', 'efficient', 'rebalancing', 'calculators'].includes(tool) && (
            <section className="panel">
              <h2>{TOOLS.find((t) => t.id === tool)?.label || tool}</h2>
              <p>Select a tool from the sidebar.</p>
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
