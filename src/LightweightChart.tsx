import { useEffect, useRef } from 'react'
import { AreaSeries, ColorType, LineSeries, createChart, type UTCTimestamp } from 'lightweight-charts'
import type { StockPoint, StockRange } from './stocks'

type LightweightChartProps = {
  data: StockPoint[]
  range: StockRange
  trend: 'up' | 'down'
  variant: 'detail' | 'sparkline'
}

export function LightweightChart({
  data,
  range,
  trend,
  variant,
}: LightweightChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || data.length === 0) {
      return
    }

    const positive = readCssVar('--positive', '#1faa78')
    const negative = readCssVar('--negative', '#dd4b57')
    const textSoft = readCssVar('--text-soft', '#6d7786')
    const lineGuide = readCssVar('--line-guide', 'rgba(124, 140, 161, 0.45)')
    const border = readCssVar('--border', 'rgba(15, 23, 42, 0.09)')
    const seriesColor = trend === 'up' ? positive : negative

    const chart = createChart(container, {
      autoSize: true,
      height: variant === 'detail' ? 280 : 44,
      layout: {
        background: {
          type: ColorType.Solid,
          color: 'rgba(0, 0, 0, 0)',
        },
        textColor: textSoft,
        attributionLogo: false,
      },
      grid: {
        vertLines: {
          visible: variant === 'detail',
          color: lineGuide,
        },
        horzLines: {
          visible: variant === 'detail',
          color: lineGuide,
        },
      },
      crosshair: {
        vertLine: {
          visible: variant === 'detail',
          labelVisible: false,
        },
        horzLine: {
          visible: variant === 'detail',
          labelVisible: variant === 'detail',
        },
      },
      handleScroll: variant === 'detail',
      handleScale: variant === 'detail',
      rightPriceScale: {
        visible: variant === 'detail',
        borderVisible: false,
      },
      leftPriceScale: {
        visible: false,
      },
      timeScale: {
        visible: variant === 'detail',
        borderVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        timeVisible: range === '1D' || range === '5D',
        secondsVisible: false,
        minBarSpacing: variant === 'detail' ? 8 : 3,
      },
      localization: {
        priceFormatter: formatPrice,
      },
    })

    const seriesData = makeSeriesData(data, range)

    if (variant === 'detail') {
      const areaSeries = chart.addSeries(AreaSeries, {
        lineColor: seriesColor,
        lineWidth: 3,
        topColor: withOpacity(seriesColor, 0.24),
        bottomColor: withOpacity(seriesColor, 0.03),
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerRadius: 4,
        priceFormat: {
          type: 'price',
          precision: 2,
          minMove: 0.01,
        },
      })

      areaSeries.setData(seriesData)
    } else {
      const lineSeries = chart.addSeries(LineSeries, {
        color: seriesColor,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      })

      lineSeries.setData(seriesData)
    }

    chart.timeScale().fitContent()

    if (variant === 'sparkline') {
      chart.priceScale('right').applyOptions({
        scaleMargins: {
          top: 0.18,
          bottom: 0.18,
        },
      })
    } else {
      chart.priceScale('right').applyOptions({
        borderVisible: false,
        scaleMargins: {
          top: 0.16,
          bottom: 0.08,
        },
      })
      chart.timeScale().applyOptions({
        borderColor: border,
      })
    }

    return () => {
      chart.remove()
    }
  }, [data, range, trend, variant])

  return <div ref={containerRef} className={variant === 'detail' ? 'line-chart' : 'sparkline'} />
}

function makeSeriesData(data: StockPoint[], range: StockRange) {
  const now = Date.now()
  const stepMs = getRangeStepMs(range)
  const start = now - stepMs * Math.max(data.length - 1, 0)

  return data.map((point, index) => ({
    time: Math.floor((start + stepMs * index) / 1000) as UTCTimestamp,
    value: point.value,
  }))
}

function getRangeStepMs(range: StockRange) {
  switch (range) {
    case '1D':
      return 30 * 60 * 1000
    case '5D':
      return 4 * 60 * 60 * 1000
    case '1M':
      return 24 * 60 * 60 * 1000
    case '6M':
      return 7 * 24 * 60 * 60 * 1000
    case 'YTD':
      return 7 * 24 * 60 * 60 * 1000
    case '1Y':
      return 14 * 24 * 60 * 60 * 1000
    case '5Y':
      return 30 * 24 * 60 * 60 * 1000
  }
}

function readCssVar(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function withOpacity(hex: string, opacity: number) {
  if (!hex.startsWith('#')) {
    return hex
  }

  const normalized = hex.length === 4
    ? hex
        .slice(1)
        .split('')
        .map((part) => part + part)
        .join('')
    : hex.slice(1)

  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}
