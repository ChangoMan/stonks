export type StockRange = '1D' | '5D' | '1M' | '6M' | 'YTD' | '1Y' | '5Y'

export type StockPoint = {
  label: string
  value: number
}

export type StockSnapshot = {
  ticker: string
  name: string
  exchange: string
  price: number
  priceChange: number
  changePercent: number
  previousClose: number
  open: number
  high: number
  low: number
  marketCapLabel: string
  volumeLabel: string
  description: string
  updatedAtLabel: string
  dataSource: string
  history: StockPoint[]
}

type CatalogEntry = {
  name: string
  exchange: string
  marketCap: number
  basePrice: number
  description: string
}

const rangePointCount: Record<StockRange, number> = {
  '1D': 24,
  '5D': 30,
  '1M': 30,
  '6M': 26,
  YTD: 32,
  '1Y': 36,
  '5Y': 42,
}

const tickerCatalog: Record<string, CatalogEntry> = {
  AAPL: {
    name: 'Apple Inc.',
    exchange: 'NASDAQ',
    marketCap: 2.9e12,
    basePrice: 211.42,
    description: 'Consumer electronics and services company with a large installed device base and recurring subscription revenue.',
  },
  AMZN: {
    name: 'Amazon.com, Inc.',
    exchange: 'NASDAQ',
    marketCap: 2.1e12,
    basePrice: 188.74,
    description: 'E-commerce and cloud infrastructure company spanning retail, logistics, advertising, and AWS.',
  },
  GOOGL: {
    name: 'Alphabet Inc.',
    exchange: 'NASDAQ',
    marketCap: 2.2e12,
    basePrice: 173.68,
    description: 'Search, advertising, cloud, and AI platform company operating Google, YouTube, and related bets.',
  },
  META: {
    name: 'Meta Platforms, Inc.',
    exchange: 'NASDAQ',
    marketCap: 1.3e12,
    basePrice: 542.13,
    description: 'Social platforms and digital advertising business investing heavily in AI infrastructure and wearables.',
  },
  MSFT: {
    name: 'Microsoft Corporation',
    exchange: 'NASDAQ',
    marketCap: 3.1e12,
    basePrice: 448.27,
    description: 'Enterprise software, cloud computing, and AI platform company across productivity, Azure, and gaming.',
  },
  NVDA: {
    name: 'NVIDIA Corporation',
    exchange: 'NASDAQ',
    marketCap: 2.5e12,
    basePrice: 117.84,
    description: 'Semiconductor and accelerated computing company supplying GPUs, AI platforms, and data center systems.',
  },
  QQQ: {
    name: 'Invesco QQQ Trust',
    exchange: 'NASDAQ',
    marketCap: 287e9,
    basePrice: 472.36,
    description: 'ETF tracking the Nasdaq-100, providing concentrated exposure to large-cap growth and technology stocks.',
  },
  SHOP: {
    name: 'Shopify Inc.',
    exchange: 'NYSE',
    marketCap: 93e9,
    basePrice: 74.82,
    description: 'Commerce software platform for online stores, point-of-sale systems, and merchant services.',
  },
  SPY: {
    name: 'SPDR S&P 500 ETF Trust',
    exchange: 'NYSE Arca',
    marketCap: 624e9,
    basePrice: 521.16,
    description: 'ETF offering broad exposure to the S&P 500 and commonly used as a benchmark for U.S. large caps.',
  },
  TSLA: {
    name: 'Tesla, Inc.',
    exchange: 'NASDAQ',
    marketCap: 551e9,
    basePrice: 171.06,
    description: 'Electric vehicle and energy company with operations spanning autos, batteries, solar, and software.',
  },
}

export const DEFAULT_WATCHLIST = ['GOOGL', 'AMZN', 'SPY', 'QQQ', 'NVDA', 'AAPL']

export type LiveQuote = {
  price: number
  timestamp: number
}

export function isTickerSymbol(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z.]{1,8}$/.test(value)
}

export function getSidebarSnapshot(ticker: string, range: StockRange): StockSnapshot {
  return buildMockSnapshot(ticker, range)
}

export async function getStockSnapshot(
  ticker: string,
  range: StockRange,
): Promise<StockSnapshot> {
  const apiKey = import.meta.env.VITE_FINNHUB_API_KEY
  if (apiKey) {
    try {
      return await fetchFinnhubSnapshot(ticker, range, apiKey)
    } catch {
      return buildMockSnapshot(ticker, range)
    }
  }

  await new Promise((resolve) => window.setTimeout(resolve, 250))
  return buildMockSnapshot(ticker, range)
}

export function getRangeLabel(range: StockRange) {
  switch (range) {
    case '1D':
      return 'Today'
    case '5D':
      return 'Past 5 days'
    case '1M':
      return 'Past month'
    case '6M':
      return 'Past 6 months'
    case 'YTD':
      return 'Year to date'
    case '1Y':
      return 'Past year'
    case '5Y':
      return 'Past 5 years'
  }
}

export function applyLiveQuote(snapshot: StockSnapshot, liveQuote?: LiveQuote) {
  if (!liveQuote) {
    return snapshot
  }

  const priceChange = liveQuote.price - snapshot.previousClose
  const changePercent =
    snapshot.previousClose === 0
      ? 0
      : (priceChange / snapshot.previousClose) * 100
  const history = mergeCurrentPriceIntoHistory(
    snapshot.history.map((point) => point.value),
    liveQuote.price,
  )

  return {
    ...snapshot,
    price: liveQuote.price,
    priceChange,
    changePercent,
    high: Math.max(snapshot.high, liveQuote.price),
    low: Math.min(snapshot.low, liveQuote.price),
    updatedAtLabel: formatUpdatedAt(liveQuote.timestamp),
    dataSource: 'Finnhub websocket',
    history: history.map((value, index) => ({
      label: snapshot.history[index]?.label ?? `${index}`,
      value,
    })),
  }
}

async function fetchFinnhubSnapshot(
  ticker: string,
  range: StockRange,
  apiKey: string,
): Promise<StockSnapshot> {
  const quoteUrl = new URL('https://finnhub.io/api/v1/quote')
  quoteUrl.searchParams.set('symbol', ticker)
  quoteUrl.searchParams.set('token', apiKey)

  const profileUrl = new URL('https://finnhub.io/api/v1/stock/profile2')
  profileUrl.searchParams.set('symbol', ticker)
  profileUrl.searchParams.set('token', apiKey)

  const fallback = buildMockSnapshot(ticker, range)
  const [quote, profile] = await Promise.allSettled([
    fetchJson<FinnhubQuote>(quoteUrl.toString()),
    fetchJson<FinnhubProfile>(profileUrl.toString()),
  ])

  const quoteData =
    quote.status === 'fulfilled' && typeof quote.value.c === 'number'
      ? quote.value
      : null

  if (!quoteData) {
    throw new Error('Quote request failed')
  }

  const profileData = profile.status === 'fulfilled' ? profile.value : null
  const history = mergeCurrentPriceIntoHistory(
    fallback.history.map((point) => point.value),
    quoteData.c,
  )

  const resolvedName = profileData?.name || fallback.name
  const resolvedExchange = profileData?.exchange || fallback.exchange
  const resolvedDescription =
    profileData?.finnhubIndustry && profileData.country
      ? `${profileData.finnhubIndustry} company based in ${profileData.country}.`
      : fallback.description
  const resolvedMarketCap =
    typeof profileData?.marketCapitalization === 'number' && profileData.marketCapitalization > 0
      ? formatCompactNumber(profileData.marketCapitalization * 1_000_000)
      : fallback.marketCapLabel

  return {
    ticker,
    name: resolvedName,
    exchange: resolvedExchange,
    price: quoteData.c,
    priceChange: quoteData.d,
    changePercent: quoteData.dp,
    previousClose: quoteData.pc || fallback.previousClose,
    open: quoteData.o || fallback.open,
    high: quoteData.h || Math.max(...history),
    low: quoteData.l || Math.min(...history),
    marketCapLabel: resolvedMarketCap,
    volumeLabel: formatCompactNumber(quoteData.t ? Math.round(Math.abs(quoteData.t / 1000)) * 250 : 0),
    description: resolvedDescription,
    updatedAtLabel: formatUpdatedAt(quoteData.t),
    dataSource: 'Finnhub quote',
    history: history.map((value, index) => ({
      label: fallback.history[index]?.label ?? `${index}`,
      value,
    })),
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`)
  }
  return (await response.json()) as T
}

function buildMockSnapshot(ticker: string, range: StockRange): StockSnapshot {
  const catalog = tickerCatalog[ticker] ?? makeCatalogEntry(ticker)
  const seed = seededNumber(ticker)
  const history = makeHistory(catalog.basePrice, seed, rangePointCount[range], range)
  const price = history.at(-1)?.value ?? catalog.basePrice
  const previous = history.at(-2)?.value ?? price
  const priceChange = price - previous
  const changePercent = previous === 0 ? 0 : (priceChange / previous) * 100
  const high = Math.max(...history.map((point) => point.value))
  const low = Math.min(...history.map((point) => point.value))
  const open = history[0]?.value ?? price
  const volumeBase = Math.round((seed * 8_000_000) + 1_250_000)

  return {
    ticker,
    name: catalog.name,
    exchange: catalog.exchange,
    price,
    priceChange,
    changePercent,
    previousClose: previous,
    open,
    high,
    low,
    marketCapLabel: formatCompactNumber(catalog.marketCap),
    volumeLabel: formatCompactNumber(volumeBase),
    description: catalog.description,
    updatedAtLabel: 'Demo mode',
    dataSource: 'Local simulator',
    history,
  }
}

function makeHistory(basePrice: number, seed: number, points: number, range: StockRange) {
  const labels = makeLabels(points, range)
  let current = basePrice * (0.92 + seed * 0.14)

  return labels.map((label, index) => {
    const seasonal = Math.sin((index + seed * 13) / 4.2) * basePrice * 0.01
    const drift = (index / points - 0.5) * basePrice * (seed - 0.48) * 0.09
    const shock = Math.cos((index + seed * 3) / 2.7) * basePrice * 0.004
    current = Math.max(6, current + seasonal * 0.18 + drift * 0.04 + shock)

    return {
      label,
      value: Number(current.toFixed(2)),
    }
  })
}

function makeLabels(points: number, range: StockRange) {
  return Array.from({ length: points }, (_, index) => {
    if (range === '1D') {
      return `${9 + Math.floor(index / 2)}:${index % 2 === 0 ? '00' : '30'}`
    }

    return `${index + 1}`
  })
}

function makeCatalogEntry(ticker: string): CatalogEntry {
  const seed = seededNumber(ticker)
  return {
    name: `${ticker} Holdings`,
    exchange: 'NASDAQ',
    marketCap: (8e9 + seed * 240e9),
    basePrice: 24 + seed * 320,
    description: `${ticker} is using generated placeholder company data until you connect a live market API key.`,
  }
}

function seededNumber(input: string) {
  let hash = 0
  for (const character of input) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }

  return (hash % 10_000) / 10_000
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function mergeCurrentPriceIntoHistory(history: number[], currentPrice: number) {
  if (!history.length) {
    return [currentPrice]
  }

  const nextHistory = [...history]
  nextHistory[nextHistory.length - 1] = currentPrice
  return nextHistory
}

function formatUpdatedAt(unixSeconds: number) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(unixSeconds * 1000))
}

type FinnhubQuote = {
  c: number
  d: number
  dp: number
  h: number
  l: number
  o: number
  pc: number
  t: number
}

type FinnhubProfile = {
  country?: string
  exchange?: string
  finnhubIndustry?: string
  marketCapitalization?: number
  name?: string
}
