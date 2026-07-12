/**
 * 与前端 signalAnalysis 对齐的简易技术面建议（用于自选列表批量计算）
 */
import { calcMA, calcMACD, calcRSI, calcBOLL } from './indicators.js'

export type ActionAdvice = 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'

export interface StockAdvice {
  code: string
  action: ActionAdvice
  action_label: string
  score: number
}

const ACTION_LABEL: Record<ActionAdvice, string> = {
  strong_buy: '建议买入',
  buy: '偏多关注',
  hold: '观望等待',
  sell: '偏空谨慎',
  strong_sell: '建议卖出',
}

function actionFromScore(score: number): ActionAdvice {
  if (score >= 4) return 'strong_buy'
  if (score >= 2) return 'buy'
  if (score <= -4) return 'strong_sell'
  if (score <= -2) return 'sell'
  return 'hold'
}

function crossedUp(prevA: number, prevB: number, a: number, b: number) {
  return prevA <= prevB && a > b
}

function crossedDown(prevA: number, prevB: number, a: number, b: number) {
  return prevA >= prevB && a < b
}

/** 基于收盘价计算综合建议（与详情页技术面规则一致） */
export function computeAdvice(code: string, closes: number[]): StockAdvice | null {
  if (closes.length < 30) return null

  const ma5 = calcMA(closes, 5)
  const ma20 = calcMA(closes, 20)
  const ma60 = calcMA(closes, 60)
  const macd = calcMACD(closes)
  const rsiArr = calcRSI(closes, 14)
  const boll = calcBOLL(closes, 20, 2)

  const i = closes.length - 1
  const prev = i - 1
  const price = closes[i]
  let score = 0

  const a5 = ma5[i]
  const a20 = ma20[i]
  const a60 = ma60[i]
  const p5 = ma5[prev]
  const p20 = ma20[prev]

  if (a5 != null && a20 != null && p5 != null && p20 != null) {
    if (crossedUp(p5, p20, a5, a20)) score += 2
    else if (crossedDown(p5, p20, a5, a20)) score -= 2
    else if (a5 > a20) score += 1
    else score -= 1
  }

  if (a20 != null) {
    score += price > a20 ? 0.5 : -0.5
  }

  if (a60 != null && a20 != null) {
    if (price > a60 && a20 > a60) score += 1
    else if (price < a60 && a20 < a60) score -= 1
  }

  const dif = macd.dif[i]
  const dea = macd.dea[i]
  const hist = macd.macd[i]
  const prevDif = macd.dif[prev]
  const prevDea = macd.dea[prev]
  const prevHist = macd.macd[prev]

  if (crossedUp(prevDif, prevDea, dif, dea)) score += 2
  else if (crossedDown(prevDif, prevDea, dif, dea)) score -= 2
  else if (dif > dea && hist > 0) score += 1
  else if (dif < dea && hist < 0) score -= 1

  if (prevHist < 0 && hist > 0) score += 1
  else if (prevHist > 0 && hist < 0) score -= 1

  const rsi = rsiArr[i]
  if (rsi != null) {
    if (rsi >= 70) score -= 1.5
    else if (rsi <= 30) score += 1.5
    else if (rsi >= 55) score += 0.5
    else if (rsi <= 45) score -= 0.5
  }

  const mid = boll.mid[i]
  const upper = boll.upper[i]
  const lower = boll.lower[i]
  if (mid != null && upper != null && lower != null) {
    if (price >= upper) score -= 1
    else if (price <= lower) score += 1
    else if (price > mid) score += 0.5
    else score -= 0.5
  }

  score = +score.toFixed(2)
  const action = actionFromScore(score)
  return {
    code,
    action,
    action_label: ACTION_LABEL[action],
    score,
  }
}
