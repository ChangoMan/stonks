import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import './App.css'
import {
  DEFAULT_WATCHLIST,
  applyLiveQuote,
  type StockRange,
  getRangeLabel,
  getSidebarSnapshot,
  getStockSnapshot,
  isTickerSymbol,
} from './stocks'
import { LightweightChart } from './LightweightChart'
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

                <LightweightChart
                  data={stock.history}
                  range={activeRange}
                  trend={stock.changePercent >= 0 ? 'up' : 'down'}
                  variant="sparkline"
                />

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

              <LightweightChart
                data={selectedStock.history}
                range={activeRange}
                trend={selectedStock.changePercent >= 0 ? 'up' : 'down'}
                variant="detail"
              />

              <div className="chart-footer">
                <Metric label="Open" value={formatPrice(selectedStock.open)} />
                <Metric label="High" value={formatPrice(selectedStock.high)} />
                <Metric label="Low" value={formatPrice(selectedStock.low)} />
                <Metric label="Volume" value={selectedStock.volumeLabel} />
              </div>
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
