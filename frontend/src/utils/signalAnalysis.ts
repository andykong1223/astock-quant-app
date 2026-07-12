import { buildIndicators } from './indicators'

export type SignalBias = 'bullish' | 'bearish' | 'neutral'
export type ActionAdvice = 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'

export interface TechSignal {
  id: string
  name: string
  bias: SignalBias
  /** 对综合评分的贡献，正看多为买入倾向 */
  weight: number
  detail: string
}

export interface SignalAnalysis {
  action: ActionAdvice
  actionLabel: string
  score: number
  summary: string
  signals: TechSignal[]
  snapshot: {
    price: number
    ma5: number | null
    ma20: number | null
    ma60: number | null
    rsi: number | null
    dif: number | null
    dea: number | null
    macd: number | null
  }
}

const ACTION_META: Record<ActionAdvice, { label: string; min: number; max: number }> = {
  strong_buy: { label: '建议买入', min: 4, max: Infinity },
  buy: { label: '偏多关注', min: 2, max: 3.999 },
  hold: { label: '观望等待', min: -1.999, max: 1.999 },
  sell: { label: '偏空谨慎', min: -3.999, max: -2 },
  strong_sell: { label: '建议卖出', min: -Infinity, max: -4 },
}

function lastValid<T>(arr: (T | null | undefined)[]): T | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    const v = arr[i]
    if (v != null && Number.isFinite(v as number)) return v as T
  }
  return null
}

function crossedUp(prevA: number, prevB: number, a: number, b: number) {
  return prevA <= prevB && a > b
}

function crossedDown(prevA: number, prevB: number, a: number, b: number) {
  return prevA >= prevB && a < b
}

function actionFromScore(score: number): ActionAdvice {
  if (score >= 4) return 'strong_buy'
  if (score >= 2) return 'buy'
  if (score <= -4) return 'strong_sell'
  if (score <= -2) return 'sell'
  return 'hold'
}

/**
 * 基于收盘价序列做常用技术信号分析（均线金叉/死叉、MACD、RSI、布林带）
 */
export function analyzeSignals(closes: number[]): SignalAnalysis | null {
  if (closes.length < 30) return null

  const ind = buildIndicators(closes)
  const i = closes.length - 1
  const prev = i - 1
  const price = closes[i]
  const signals: TechSignal[] = []

  const ma5 = ind.ma5[i]
  const ma20 = ind.ma20[i]
  const ma60 = ind.ma60[i]
  const prevMa5 = ind.ma5[prev]
  const prevMa20 = ind.ma20[prev]

  // MA5 / MA20 金叉死叉
  if (ma5 != null && ma20 != null && prevMa5 != null && prevMa20 != null) {
    if (crossedUp(prevMa5, prevMa20, ma5, ma20)) {
      signals.push({
        id: 'ma_golden',
        name: '均线金叉',
        bias: 'bullish',
        weight: 2,
        detail: `MA5（${ma5.toFixed(2)}）上穿 MA20（${ma20.toFixed(2)}）`,
      })
    } else if (crossedDown(prevMa5, prevMa20, ma5, ma20)) {
      signals.push({
        id: 'ma_death',
        name: '均线死叉',
        bias: 'bearish',
        weight: -2,
        detail: `MA5（${ma5.toFixed(2)}）下穿 MA20（${ma20.toFixed(2)}）`,
      })
    } else if (ma5 > ma20) {
      signals.push({
        id: 'ma_bull_align',
        name: '短均线多头',
        bias: 'bullish',
        weight: 1,
        detail: `MA5 位于 MA20 上方，短期偏多`,
      })
    } else {
      signals.push({
        id: 'ma_bear_align',
        name: '短均线空头',
        bias: 'bearish',
        weight: -1,
        detail: `MA5 位于 MA20 下方，短期偏空`,
      })
    }
  }

  // 价格相对 MA20 / MA60
  if (ma20 != null) {
    const dist = ((price - ma20) / ma20) * 100
    if (price > ma20) {
      signals.push({
        id: 'price_above_ma20',
        name: '站上中期均线',
        bias: 'bullish',
        weight: 0.5,
        detail: `收盘价高于 MA20 约 ${dist.toFixed(1)}%`,
      })
    } else {
      signals.push({
        id: 'price_below_ma20',
        name: '跌破中期均线',
        bias: 'bearish',
        weight: -0.5,
        detail: `收盘价低于 MA20 约 ${Math.abs(dist).toFixed(1)}%`,
      })
    }
  }

  if (ma60 != null) {
    if (price > ma60 && ma20 != null && ma20 > ma60) {
      signals.push({
        id: 'ma_trend_up',
        name: '中长期多头排列',
        bias: 'bullish',
        weight: 1,
        detail: '价格 > MA20 > MA60，趋势偏强',
      })
    } else if (price < ma60 && ma20 != null && ma20 < ma60) {
      signals.push({
        id: 'ma_trend_down',
        name: '中长期空头排列',
        bias: 'bearish',
        weight: -1,
        detail: '价格 < MA20 < MA60，趋势偏弱',
      })
    }
  }

  // MACD
  const dif = ind.macd.dif[i]
  const dea = ind.macd.dea[i]
  const macd = ind.macd.macd[i]
  const prevDif = ind.macd.dif[prev]
  const prevDea = ind.macd.dea[prev]
  const prevMacd = ind.macd.macd[prev]

  if (crossedUp(prevDif, prevDea, dif, dea)) {
    signals.push({
      id: 'macd_golden',
      name: 'MACD 金叉',
      bias: 'bullish',
      weight: 2,
      detail: `DIF（${dif.toFixed(3)}）上穿 DEA（${dea.toFixed(3)}）`,
    })
  } else if (crossedDown(prevDif, prevDea, dif, dea)) {
    signals.push({
      id: 'macd_death',
      name: 'MACD 死叉',
      bias: 'bearish',
      weight: -2,
      detail: `DIF（${dif.toFixed(3)}）下穿 DEA（${dea.toFixed(3)}）`,
    })
  } else if (dif > dea && macd > 0) {
    signals.push({
      id: 'macd_bull',
      name: 'MACD 多头',
      bias: 'bullish',
      weight: 1,
      detail: 'DIF 在 DEA 上方且柱线为正',
    })
  } else if (dif < dea && macd < 0) {
    signals.push({
      id: 'macd_bear',
      name: 'MACD 空头',
      bias: 'bearish',
      weight: -1,
      detail: 'DIF 在 DEA 下方且柱线为负',
    })
  }

  if (prevMacd < 0 && macd > 0) {
    signals.push({
      id: 'macd_hist_turn_up',
      name: 'MACD 柱翻红',
      bias: 'bullish',
      weight: 1,
      detail: '动能由负转正，短线动量回升',
    })
  } else if (prevMacd > 0 && macd < 0) {
    signals.push({
      id: 'macd_hist_turn_down',
      name: 'MACD 柱翻绿',
      bias: 'bearish',
      weight: -1,
      detail: '动能由正转负，短线动量转弱',
    })
  }

  // RSI
  const rsi = ind.rsi[i]
  if (rsi != null) {
    if (rsi >= 70) {
      signals.push({
        id: 'rsi_overbought',
        name: 'RSI 超买',
        bias: 'bearish',
        weight: -1.5,
        detail: `RSI(14)=${rsi.toFixed(1)}，短线过热，注意回调`,
      })
    } else if (rsi <= 30) {
      signals.push({
        id: 'rsi_oversold',
        name: 'RSI 超卖',
        bias: 'bullish',
        weight: 1.5,
        detail: `RSI(14)=${rsi.toFixed(1)}，短线超跌，关注反弹`,
      })
    } else if (rsi >= 55) {
      signals.push({
        id: 'rsi_strong',
        name: 'RSI 偏强',
        bias: 'bullish',
        weight: 0.5,
        detail: `RSI(14)=${rsi.toFixed(1)}，动能偏多`,
      })
    } else if (rsi <= 45) {
      signals.push({
        id: 'rsi_weak',
        name: 'RSI 偏弱',
        bias: 'bearish',
        weight: -0.5,
        detail: `RSI(14)=${rsi.toFixed(1)}，动能偏空`,
      })
    } else {
      signals.push({
        id: 'rsi_mid',
        name: 'RSI 中性',
        bias: 'neutral',
        weight: 0,
        detail: `RSI(14)=${rsi.toFixed(1)}，处于中性区间`,
      })
    }
  }

  // BOLL
  const mid = ind.boll.mid[i]
  const upper = ind.boll.upper[i]
  const lower = ind.boll.lower[i]
  if (mid != null && upper != null && lower != null) {
    if (price >= upper) {
      signals.push({
        id: 'boll_upper',
        name: '触及布林上轨',
        bias: 'bearish',
        weight: -1,
        detail: '价格靠近/突破上轨，短线或有压力',
      })
    } else if (price <= lower) {
      signals.push({
        id: 'boll_lower',
        name: '触及布林下轨',
        bias: 'bullish',
        weight: 1,
        detail: '价格靠近/跌破下轨，短线或有支撑',
      })
    } else if (price > mid) {
      signals.push({
        id: 'boll_upper_half',
        name: '布林带上半区',
        bias: 'bullish',
        weight: 0.5,
        detail: '收盘价在中轨上方运行',
      })
    } else {
      signals.push({
        id: 'boll_lower_half',
        name: '布林带下半区',
        bias: 'bearish',
        weight: -0.5,
        detail: '收盘价在中轨下方运行',
      })
    }
  }

  const score = +signals.reduce((s, x) => s + x.weight, 0).toFixed(2)
  const action = actionFromScore(score)
  const bull = signals.filter((s) => s.bias === 'bullish').length
  const bear = signals.filter((s) => s.bias === 'bearish').length

  let summary: string
  if (action === 'strong_buy' || action === 'buy') {
    summary = `多头信号 ${bull} 个、空头 ${bear} 个，技术面偏多，可结合仓位与风险偏好考虑买入或加仓。`
  } else if (action === 'strong_sell' || action === 'sell') {
    summary = `空头信号 ${bear} 个、多头 ${bull} 个，技术面偏空，宜谨慎，可考虑减仓或观望。`
  } else {
    summary = `多空信号接近（多 ${bull} / 空 ${bear}），方向不明朗，建议观望等待更明确信号。`
  }

  return {
    action,
    actionLabel: ACTION_META[action].label,
    score,
    summary,
    signals,
    snapshot: {
      price,
      ma5: lastValid(ind.ma5),
      ma20: lastValid(ind.ma20),
      ma60: lastValid(ind.ma60),
      rsi: lastValid(ind.rsi),
      dif,
      dea,
      macd,
    },
  }
}

export { actionFromScore, ACTION_META }
