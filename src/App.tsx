import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import './App.css'
import {
  DEFAULT_WATCHLIST,
  applyLiveQuote,
  type StockPoint,
  type StockRange,
  getRangeLabel,
  getSidebarSnapshot,
  getStockSnapshot,
  isTickerSymbol,
} from './stocks'
import { useFinnhubLiveQuotes } from './useFinnhubLiveQuotes'

const RANGE_OPTIONS: StockRange[] = ['1D', '5D', '1M', '6M', 'YTD', '1Y', '5Y']
const WATCHLIST_STORAGE_KEY = 'vite-stonks.watchlist'

function App() {
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    const saved = window.localStorage.getItem(WATCHLIST_STORAGE_KEY)
    if (!saved) {
      return DEFAULT_WATCHLIST
    }

    try {
      const parsed = JSON.parse(saved)
      return Array.isArray(parsed) && parsed.every(isTickerSymbol)
        ? parsed
        : DEFAULT_WATCHLIST
    } catch {
      return DEFAULT_WATCHLIST
    }
  })
  const [draftTicker, setDraftTicker] = useState('')
  const [selectedTicker, setSelectedTicker] = useState(watchlist[0] ?? DEFAULT_WATCHLIST[0])
  const [activeRange, setActiveRange] = useState<StockRange>('1D')

  useEffect(() => {
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist))
  }, [watchlist])

  const liveQuotes = useFinnhubLiveQuotes(watchlist)

  const sidebarQueries = useQueries({
    queries: watchlist.map((ticker) => ({
      queryKey: ['sidebar-stock', ticker, activeRange],
      queryFn: () => getStockSnapshot(ticker, activeRange),
      staleTime: 30_000,
      refetchInterval: 60_000,
    })),
  })

  const sidebarRows = useMemo(
    () =>
      watchlist.map(
        (ticker, index) =>
          applyLiveQuote(
            sidebarQueries[index]?.data ?? getSidebarSnapshot(ticker, activeRange),
            liveQuotes[ticker],
          ),
      ),
    [activeRange, liveQuotes, sidebarQueries, watchlist],
  )

  const activeTicker = watchlist.includes(selectedTicker)
    ? selectedTicker
    : (watchlist[0] ?? DEFAULT_WATCHLIST[0])

  const stockQuery = useQuery({
    queryKey: ['stock', activeTicker, activeRange],
    queryFn: () => getStockSnapshot(activeTicker, activeRange),
    staleTime: 15_000,
    refetchInterval: 30_000,
  })

  const selectedStockBase = stockQuery.data ?? sidebarRows.find((row) => row.ticker === activeTicker)
  const selectedStock = selectedStockBase
    ? applyLiveQuote(selectedStockBase, liveQuotes[activeTicker])
    : undefined

  const handleAddTicker = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedTicker = draftTicker.trim().toUpperCase()
    if (!isTickerSymbol(normalizedTicker) || watchlist.includes(normalizedTicker)) {
      return
    }

    setWatchlist((current) => [normalizedTicker, ...current])
    setSelectedTicker(normalizedTicker)
    setDraftTicker('')
  }

  const handleRemoveTicker = (ticker: string) => {
    setWatchlist((current) => current.filter((item) => item !== ticker))
  }

  return (
    <main className="app-shell">
      <aside className="watchlist-panel">
        <div className="panel-top">
          <div className="watchlist-heading">
            <p className="eyebrow">My board</p>
            <div className="watchlist-title-row">
              <h1>Watchlist</h1>
              <span className="watchlist-count">{watchlist.length}</span>
            </div>
          </div>

          <form className="ticker-form" onSubmit={handleAddTicker}>
            <label className="ticker-label" htmlFor="ticker-input">
              Add ticker
            </label>
            <div className="ticker-input-row">
              <input
                id="ticker-input"
                name="ticker"
                value={draftTicker}
                onChange={(event) => setDraftTicker(event.target.value.toUpperCase())}
                placeholder="AAPL"
                maxLength={8}
                autoComplete="off"
              />
              <button type="submit">+</button>
            </div>
          </form>
        </div>

        <div className="range-tabs" aria-label="Chart range">
          {RANGE_OPTIONS.map((range) => (
            <button
              key={range}
              className={range === activeRange ? 'active' : undefined}
              onClick={() => setActiveRange(range)}
              type="button"
            >
              {range}
            </button>
          ))}
        </div>

        <div className="watchlist-scroll">
          {sidebarRows.map((stock) => (
            <article
              key={stock.ticker}
              className={`watchlist-row ${activeTicker === stock.ticker ? 'selected' : ''}`}
            >
              <button
                type="button"
                className="row-primary"
                onClick={() => setSelectedTicker(stock.ticker)}
              >
                <div className="ticker-copy">
                  <div className="ticker-line">
                    <span className="ticker">{stock.ticker}</span>
                    <span className="market-cap">{stock.marketCapLabel}</span>
                  </div>
                  <p>{stock.name}</p>
                </div>

                <Sparkline data={stock.history} trend={stock.changePercent >= 0 ? 'up' : 'down'} />

                <div className="price-copy">
                  <strong>{formatPrice(stock.price)}</strong>
                  <span className={stock.changePercent >= 0 ? 'positive' : 'negative'}>
                    {formatPercent(stock.changePercent)}
                  </span>
                </div>
              </button>

              <button
                type="button"
                className="remove-ticker"
                onClick={() => handleRemoveTicker(stock.ticker)}
                aria-label={`Remove ${stock.ticker} from watchlist`}
              >
                ×
              </button>
            </article>
          ))}
        </div>
      </aside>

      <section className="detail-panel">
        {selectedStock ? (
          <>
            <div className="detail-header">
              <div>
                <p className="eyebrow">Selected ticker</p>
                <div className="detail-heading-row">
                  <h2>{selectedStock.ticker}</h2>
                  <span className="exchange-pill">{selectedStock.exchange}</span>
                </div>
                <p className="company-name">{selectedStock.name}</p>
              </div>

              <div className="headline-price">
                <strong>{formatPrice(selectedStock.price)}</strong>
                <span className={selectedStock.changePercent >= 0 ? 'positive' : 'negative'}>
                  {formatPercent(selectedStock.changePercent)} today
                </span>
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-card-header">
                <div>
                  <p className="eyebrow">Performance</p>
                  <h3>{getRangeLabel(activeRange)}</h3>
                </div>
                <div className={`delta-chip ${selectedStock.changePercent >= 0 ? 'up' : 'down'}`}>
                  {formatSignedCurrency(selectedStock.priceChange)}
                </div>
              </div>

              <LineChart
                data={selectedStock.history}
                trend={selectedStock.changePercent >= 0 ? 'up' : 'down'}
              />

              <div className="chart-footer">
                <Metric label="Open" value={formatPrice(selectedStock.open)} />
                <Metric label="High" value={formatPrice(selectedStock.high)} />
                <Metric label="Low" value={formatPrice(selectedStock.low)} />
                <Metric label="Volume" value={selectedStock.volumeLabel} />
              </div>
            </div>

            <div className="info-grid">
              <article className="info-card">
                <p className="eyebrow">Company</p>
                <h3>Snapshot</h3>
                <p className="info-copy">
                  {selectedStock.description}
                </p>
              </article>

              <article className="info-card">
                <p className="eyebrow">Quick stats</p>
                <h3>At a glance</h3>
                <dl className="stats-list">
                  <div>
                    <dt>Market cap</dt>
                    <dd>{selectedStock.marketCapLabel}</dd>
                  </div>
                  <div>
                    <dt>Range</dt>
                    <dd>{getRangeLabel(activeRange)}</dd>
                  </div>
                  <div>
                    <dt>Source</dt>
                    <dd>{selectedStock.dataSource}</dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>{selectedStock.updatedAtLabel}</dd>
                  </div>
                </dl>
              </article>
            </div>

            {stockQuery.isFetching ? (
              <p className="status-note">Refreshing {activeTicker} data…</p>
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Sparkline({
  data,
  trend,
}: {
  data: StockPoint[]
  trend: 'up' | 'down'
}) {
  if (data.length < 2) {
    return <div className="sparkline" />
  }

  return (
    <svg className="sparkline" viewBox="0 0 120 44" preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" x2="120" y1="22" y2="22" className="sparkline-guide" />
      <polyline points={getChartPoints(data, 120, 44)} className={`sparkline-line ${trend}`} />
    </svg>
  )
}

function LineChart({
  data,
  trend,
}: {
  data: StockPoint[]
  trend: 'up' | 'down'
}) {
  if (data.length < 2) {
    return <div className="line-chart" />
  }

  const areaPoints = `${getChartPoints(data, 640, 280)} 640,280 0,280`

  return (
    <svg className="line-chart" viewBox="0 0 640 280" preserveAspectRatio="none" role="img">
      <defs>
        <linearGradient id="chart-fill-up" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(31, 175, 120, 0.32)" />
          <stop offset="100%" stopColor="rgba(31, 175, 120, 0)" />
        </linearGradient>
        <linearGradient id="chart-fill-down" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(227, 78, 86, 0.26)" />
          <stop offset="100%" stopColor="rgba(227, 78, 86, 0)" />
        </linearGradient>
      </defs>
      {Array.from({ length: 5 }).map((_, index) => {
        const y = 32 + index * 52
        return <line key={y} x1="0" x2="640" y1={y} y2={y} className="chart-grid" />
      })}
      <polygon points={areaPoints} className={`chart-area ${trend}`} />
      <polyline points={getChartPoints(data, 640, 280)} className={`chart-line ${trend}`} />
    </svg>
  )
}

function getChartPoints(data: StockPoint[], width: number, height: number) {
  const values = data.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1

  return data
    .map((point, index) => {
      const x = (index / (data.length - 1)) * width
      const y = height - ((point.value - min) / span) * (height - 24) - 12
      return `${x},${y}`
    })
    .join(' ')
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatPercent(value: number) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function formatSignedCurrency(value: number) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatPrice(value)}`
}

export default App
