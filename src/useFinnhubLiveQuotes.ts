import { useEffect, useMemo, useState } from 'react'
import type { LiveQuote } from './stocks'

type TradeMessage = {
  data?: Array<{
    p?: number
    s?: string
    t?: number
  }>
  type?: string
}

export function useFinnhubLiveQuotes(symbols: string[]) {
  const apiKey = import.meta.env.VITE_FINNHUB_API_KEY
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({})
  const normalizedSymbols = useMemo(
    () => Array.from(new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))),
    [symbols],
  )

  useEffect(() => {
    if (!apiKey || normalizedSymbols.length === 0) {
      return
    }

    let socket: WebSocket | null = null
    let reconnectTimer: number | undefined
    let shouldReconnect = true

    const connect = () => {
      socket = new WebSocket(`wss://ws.finnhub.io?token=${apiKey}`)

      socket.addEventListener('open', () => {
        normalizedSymbols.forEach((symbol) => {
          socket?.send(JSON.stringify({ type: 'subscribe', symbol }))
        })
      })

      socket.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data as string) as TradeMessage

          if (message.type === 'ping') {
            socket?.send(JSON.stringify({ type: 'pong' }))
            return
          }

          if (message.type !== 'trade' || !Array.isArray(message.data)) {
            return
          }

          const trades = message.data

          setQuotes((current) => {
            const next = { ...current }

            for (const trade of trades) {
              if (!trade.s || typeof trade.p !== 'number' || typeof trade.t !== 'number') {
                continue
              }

              const existing = next[trade.s]
              if (!existing || trade.t >= existing.timestamp) {
                next[trade.s] = {
                  price: trade.p,
                  timestamp: trade.t / 1000,
                }
              }
            }

            return next
          })
        } catch {
          return
        }
      })

      socket.addEventListener('close', () => {
        if (!shouldReconnect) {
          return
        }

        reconnectTimer = window.setTimeout(connect, 3_000)
      })
    }

    connect()

    return () => {
      shouldReconnect = false
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer)
      }

      const activeSocket = socket

      if (activeSocket?.readyState === WebSocket.OPEN) {
        normalizedSymbols.forEach((symbol) => {
          activeSocket.send(JSON.stringify({ type: 'unsubscribe', symbol }))
        })
      }

      if (
        activeSocket?.readyState === WebSocket.OPEN ||
        activeSocket?.readyState === WebSocket.CONNECTING
      ) {
        activeSocket.close()
      }
    }
  }, [apiKey, normalizedSymbols])

  return quotes
}
