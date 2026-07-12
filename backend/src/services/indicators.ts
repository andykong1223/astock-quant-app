/** Technical indicators: MA, MACD, RSI, BOLL */

export function calcMA(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) => {
    if (i < period - 1) return null
    const slice = closes.slice(i - period + 1, i + 1)
    return +(slice.reduce((a, b) => a + b, 0) / period).toFixed(4)
  })
}

export function calcEMA(closes: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const ema: number[] = []
  closes.forEach((c, i) => {
    if (i === 0) ema.push(c)
    else ema.push(+(c * k + ema[i - 1] * (1 - k)).toFixed(6))
  })
  return ema
}

export function calcMACD(closes: number[], fast = 12, slow = 26, signal = 9) {
  const emaFast = calcEMA(closes, fast)
  const emaSlow = calcEMA(closes, slow)
  const dif = emaFast.map((v, i) => +(v - emaSlow[i]).toFixed(4))
  const dea = calcEMA(dif, signal).map((v) => +v.toFixed(4))
  const macd = dif.map((v, i) => +((v - dea[i]) * 2).toFixed(4))
  return { dif, dea, macd }
}

export function calcRSI(closes: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = [null]
  let avgGain = 0
  let avgLoss = 0

  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? -diff : 0

    if (i < period) {
      avgGain += gain
      avgLoss += loss
      result.push(null)
      continue
    }

    if (i === period) {
      avgGain = (avgGain + gain) / period
      avgLoss = (avgLoss + loss) / period
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period
      avgLoss = (avgLoss * (period - 1) + loss) / period
    }

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    result.push(+(100 - 100 / (1 + rs)).toFixed(4))
  }
  return result
}

export function calcBOLL(closes: number[], period = 20, mult = 2) {
  const mid = calcMA(closes, period)
  const upper: (number | null)[] = []
  const lower: (number | null)[] = []

  closes.forEach((_, i) => {
    if (i < period - 1 || mid[i] == null) {
      upper.push(null)
      lower.push(null)
      return
    }
    const slice = closes.slice(i - period + 1, i + 1)
    const mean = mid[i]!
    const variance = slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period
    const std = Math.sqrt(variance)
    upper.push(+(mean + mult * std).toFixed(4))
    lower.push(+(mean - mult * std).toFixed(4))
  })

  return { mid, upper, lower }
}

export function buildIndicators(dates: string[], closes: number[]) {
  return {
    dates,
    closes,
    ma5: calcMA(closes, 5),
    ma10: calcMA(closes, 10),
    ma20: calcMA(closes, 20),
    ma60: calcMA(closes, 60),
    macd: calcMACD(closes),
    rsi: calcRSI(closes, 14),
    boll: calcBOLL(closes, 20, 2),
  }
}
