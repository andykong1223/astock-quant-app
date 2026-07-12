import type { DailyQuote } from '@/types'
import { buildIndicators } from './indicators'
import { actionFromScore, type ActionAdvice } from './signalAnalysis'

export interface AdviceTrade {
  side: 'buy' | 'sell'
  date: string
  price: number
  /** 卖出时相对买入的收益率 % */
  return_pct?: number
}

export interface AdviceEquityPoint {
  date: string
  strategy: number
  buyhold: number
}

export interface AdviceBacktestResult {
  strategy_return: number
  buyhold_return: number
  excess_return: number
  trade_count: number
  win_rate: number
  max_drawdown: number
  in_position: boolean
  unrealized_return: number | null
  trades: AdviceTrade[]
  equity_curve: AdviceEquityPoint[]
  start_date: string
  end_date: string
}

function crossedUp(prevA: number, prevB: number, a: number, b: number) {
  return prevA <= prevB && a > b
}

function crossedDown(prevA: number, prevB: number, a: number, b: number) {
  return prevA >= prevB && a < b
}

function techScoreAt(
  closes: number[],
  ind: ReturnType<typeof buildIndicators>,
  i: number,
): number | null {
  if (i < 29) return null
  const prev = i - 1
  const price = closes[i]
  let score = 0

  const ma5 = ind.ma5[i]
  const ma20 = ind.ma20[i]
  const ma60 = ind.ma60[i]
  const prevMa5 = ind.ma5[prev]
  const prevMa20 = ind.ma20[prev]

  if (ma5 != null && ma20 != null && prevMa5 != null && prevMa20 != null) {
    if (crossedUp(prevMa5, prevMa20, ma5, ma20)) score += 2
    else if (crossedDown(prevMa5, prevMa20, ma5, ma20)) score -= 2
    else if (ma5 > ma20) score += 1
    else score -= 1
  }

  if (ma20 != null) score += price > ma20 ? 0.5 : -0.5

  if (ma60 != null && ma20 != null) {
    if (price > ma60 && ma20 > ma60) score += 1
    else if (price < ma60 && ma20 < ma60) score -= 1
  }

  const dif = ind.macd.dif[i]
  const dea = ind.macd.dea[i]
  const macd = ind.macd.macd[i]
  const prevDif = ind.macd.dif[prev]
  const prevDea = ind.macd.dea[prev]
  const prevMacd = ind.macd.macd[prev]

  if (crossedUp(prevDif, prevDea, dif, dea)) score += 2
  else if (crossedDown(prevDif, prevDea, dif, dea)) score -= 2
  else if (dif > dea && macd > 0) score += 1
  else if (dif < dea && macd < 0) score -= 1

  if (prevMacd < 0 && macd > 0) score += 1
  else if (prevMacd > 0 && macd < 0) score -= 1

  const rsi = ind.rsi[i]
  if (rsi != null) {
    if (rsi >= 70) score -= 1.5
    else if (rsi <= 30) score += 1.5
    else if (rsi >= 55) score += 0.5
    else if (rsi <= 45) score -= 0.5
  }

  const mid = ind.boll.mid[i]
  const upper = ind.boll.upper[i]
  const lower = ind.boll.lower[i]
  if (mid != null && upper != null && lower != null) {
    if (price >= upper) score -= 1
    else if (price <= lower) score += 1
    else if (price > mid) score += 0.5
    else score -= 0.5
  }

  return +score.toFixed(2)
}

function isBuy(action: ActionAdvice) {
  return action === 'buy' || action === 'strong_buy'
}

function isSell(action: ActionAdvice) {
  return action === 'sell' || action === 'strong_sell'
}

/**
 * 按历史每日技术建议模拟交易：
 * 偏多/建议买入 → 买入；偏空/建议卖出 → 卖出；观望不动。
 */
export function backtestAdviceSignals(quotes: DailyQuote[]): AdviceBacktestResult | null {
  if (quotes.length < 80) return null

  const closes = quotes.map((q) => q.close)
  const dates = quotes.map((q) => q.trade_date)
  const ind = buildIndicators(closes)
  const startIdx = 60
  const startPrice = closes[startIdx]
  const capital0 = 100_000

  let cash = capital0
  let shares = 0
  let entryPrice = 0
  let position: 'flat' | 'long' = 'flat'
  const trades: AdviceTrade[] = []
  const equityCurve: AdviceEquityPoint[] = []
  let wins = 0
  let closed = 0
  let equityPeak = capital0
  let maxDrawdown = 0

  for (let i = startIdx; i < closes.length; i++) {
    const score = techScoreAt(closes, ind, i)
    if (score == null) continue
    const action = actionFromScore(score)
    const price = closes[i]
    const date = dates[i]

    if (position === 'flat' && isBuy(action)) {
      shares = Math.floor(cash / price / 100) * 100
      if (shares > 0) {
        cash -= shares * price
        entryPrice = price
        position = 'long'
        trades.push({ side: 'buy', date, price })
      }
    } else if (position === 'long' && isSell(action)) {
      const ret = (price - entryPrice) / entryPrice
      cash += shares * price
      if (ret > 0) wins++
      closed++
      trades.push({ side: 'sell', date, price, return_pct: +((ret * 100).toFixed(2)) })
      shares = 0
      position = 'flat'
      entryPrice = 0
    }

    const equity = cash + shares * price
    const buyhold = capital0 * (price / startPrice)
    equityCurve.push({
      date,
      strategy: +equity.toFixed(2),
      buyhold: +buyhold.toFixed(2),
    })

    if (equity > equityPeak) equityPeak = equity
    const dd = equityPeak > 0 ? (equityPeak - equity) / equityPeak : 0
    if (dd > maxDrawdown) maxDrawdown = dd
  }

  const lastPrice = closes[closes.length - 1]
  const finalEquity = cash + shares * lastPrice
  const strategyReturn = (finalEquity - capital0) / capital0
  const buyholdReturn = (lastPrice - startPrice) / startPrice
  const unrealized =
    position === 'long' && entryPrice > 0 ? (lastPrice - entryPrice) / entryPrice : null

  return {
    strategy_return: +((strategyReturn * 100).toFixed(2)),
    buyhold_return: +((buyholdReturn * 100).toFixed(2)),
    excess_return: +(((strategyReturn - buyholdReturn) * 100).toFixed(2)),
    trade_count: closed,
    win_rate: closed ? +((wins / closed) * 100).toFixed(1) : 0,
    max_drawdown: +((maxDrawdown * 100).toFixed(2)),
    in_position: position === 'long',
    unrealized_return: unrealized != null ? +((unrealized * 100).toFixed(2)) : null,
    trades,
    equity_curve: equityCurve,
    start_date: dates[startIdx],
    end_date: dates[dates.length - 1],
  }
}
