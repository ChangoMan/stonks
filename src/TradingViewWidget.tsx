import { useEffect, useRef } from 'react'
import type { StockRange } from './stocks'

type TradingViewWidgetProps = {
  ticker: string
  exchange: string
  range: StockRange
}

const INTERVAL_BY_RANGE: Record<StockRange, string> = {
  '1D': '5',
  '5D': '30',
  '1M': 'D',
  '6M': 'D',
  YTD: 'W',
  '1Y': 'W',
  '5Y': 'M',
}

const SYMBOL_OVERRIDES: Record<string, string> = {
  QQQ: 'NASDAQ:QQQ',
  SPY: 'AMEX:SPY',
}

export function TradingViewWidget({
  ticker,
  exchange,
  range,
}: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    container.innerHTML = ''

    const widgetRoot = document.createElement('div')
    widgetRoot.className = 'tradingview-widget__body'

    const copyright = document.createElement('div')
    copyright.className = 'tradingview-widget-copyright'
    copyright.innerHTML = `<a href="https://www.tradingview.com/symbols/${getTradingViewPath(
      ticker,
      exchange,
    )}/?utm_source=vite-stonks&utm_medium=widget&utm_campaign=advanced-chart" rel="noopener nofollow" target="_blank"><span class="blue-text">${ticker} chart</span></a> by TradingView`

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: getTradingViewSymbol(ticker, exchange),
      interval: INTERVAL_BY_RANGE[range],
      timezone: 'exchange',
      theme: 'light',
      style: '1',
      locale: 'en',
      allow_symbol_change: false,
      calendar: false,
      hide_top_toolbar: true,
      hide_side_toolbar: false,
      save_image: false,
      backgroundColor: 'rgba(255, 255, 255, 0)',
      withdateranges: false,
      support_host: 'https://www.tradingview.com',
    })

    container.append(widgetRoot, script, copyright)

    return () => {
      container.innerHTML = ''
    }
  }, [exchange, range, ticker])

  return <div ref={containerRef} className="tradingview-widget-container" />
}

function getTradingViewSymbol(ticker: string, exchange: string) {
  return SYMBOL_OVERRIDES[ticker] ?? `${normalizeExchange(exchange)}:${ticker}`
}

function getTradingViewPath(ticker: string, exchange: string) {
  return getTradingViewSymbol(ticker, exchange).replace(':', '-')
}

function normalizeExchange(exchange: string) {
  if (exchange === 'NYSE Arca') {
    return 'AMEX'
  }

  return exchange
}
