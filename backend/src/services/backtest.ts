import type { DailyQuote } from './demoData.js'

export interface BacktestConfig {
  type: 'dual_ma'
  shortPeriod: number
  longPeriod: number
  initialCapital?: number
}

export interface Trade {
  date: string
  side: 'buy' | 'sell'
  price: number
  shares: number
  equity: number
}

export interface BacktestResult {
  total_return: number
  annual_return: number
  sharpe_ratio: number
  max_drawdown: number
  win_rate: number
  trade_count: number
  equity_curve: { date: string; equity: number; benchmark: number }[]
  trades: Trade[]
}

function sma(values: number[], period: number, index: number): number | null {
  if (index < period - 1) return null
  const slice = values.slice(index - period + 1, index + 1)
  return slice.reduce((a, b) => a + b, 0) / period
}

/** Simple dual moving-average crossover backtest */
export function runDualMABacktest(quotes: DailyQuote[], config: BacktestConfig): BacktestResult {
  const shortP = config.shortPeriod || 5
  const longP = config.longPeriod || 20
  const capital0 = config.initialCapital || 100000
  const closes = quotes.map((q) => q.close)

  let cash = capital0
  let shares = 0
  let position: 'flat' | 'long' = 'flat'
  const trades: Trade[] = []
  const equityCurve: { date: string; equity: number; benchmark: number }[] = []
  const returns: number[] = []
  let prevEquity = capital0
  let wins = 0
  let closedTrades = 0
  let entryPrice = 0

  const startClose = closes[0] || 1

  for (let i = 0; i < quotes.length; i++) {
    const shortMA = sma(closes, shortP, i)
    const longMA = sma(closes, longP, i)
    const price = closes[i]
    const date = quotes[i].trade_date

    if (shortMA != null && longMA != null) {
      if (position === 'flat' && shortMA > longMA) {
        shares = Math.floor(cash / price / 100) * 100
        if (shares > 0) {
          cash -= shares * price
          position = 'long'
          entryPrice = price
          trades.push({ date, side: 'buy', price, shares, equity: cash + shares * price })
        }
      } else if (position === 'long' && shortMA < longMA) {
        cash += shares * price
        const pnl = price - entryPrice
        if (pnl > 0) wins++
        closedTrades++
        trades.push({ date, side: 'sell', price, shares, equity: cash })
        shares = 0
        position = 'flat'
      }
    }

    const equity = cash + shares * price
    const benchmark = capital0 * (price / startClose)
    equityCurve.push({ date, equity: +equity.toFixed(2), benchmark: +benchmark.toFixed(2) })
    returns.push((equity - prevEquity) / prevEquity)
    prevEquity = equity
  }

  // Force close
  if (shares > 0) {
    const last = quotes[quotes.length - 1]
    cash += shares * last.close
    closedTrades++
    if (last.close > entryPrice) wins++
    trades.push({
      date: last.trade_date,
      side: 'sell',
      price: last.close,
      shares,
      equity: cash,
    })
    shares = 0
  }

  const finalEquity = cash
  const totalReturn = (finalEquity - capital0) / capital0
  const days = quotes.length || 1
  const annualReturn = (1 + totalReturn) ** (252 / days) - 1

  const avgRet = returns.reduce((a, b) => a + b, 0) / (returns.length || 1)
  const stdRet = Math.sqrt(
    returns.reduce((a, b) => a + (b - avgRet) ** 2, 0) / (returns.length || 1),
  )
  const sharpe = stdRet === 0 ? 0 : (avgRet / stdRet) * Math.sqrt(252)

  let peak = capital0
  let maxDd = 0
  for (const p of equityCurve) {
    if (p.equity > peak) peak = p.equity
    const dd = (peak - p.equity) / peak
    if (dd > maxDd) maxDd = dd
  }

  return {
    total_return: +totalReturn.toFixed(4),
    annual_return: +annualReturn.toFixed(4),
    sharpe_ratio: +sharpe.toFixed(4),
    max_drawdown: +maxDd.toFixed(4),
    win_rate: closedTrades ? +(wins / closedTrades).toFixed(4) : 0,
    trade_count: trades.length,
    equity_curve: equityCurve,
    trades,
  }
}
