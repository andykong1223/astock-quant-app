import { Router } from 'express'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { ok, AppError } from '../middleware/errorHandler.js'
import { dbFail } from '../utils/errors.js'
import { requireAuth, optionalAuth } from '../middleware/auth.js'
import {
  stocks,
  getRealtimeQuotes,
  backtestTasks,
  dailyQuotesMap,
} from '../services/demoData.js'
import { buildIndicators, calcRSI, calcMA } from '../services/indicators.js'
import { runDualMABacktest } from '../services/backtest.js'
import { cacheGet, cacheSet } from '../services/cache.js'
import { isDemo, loadDailyQuotes } from '../services/quotes.js'
import { getSupabaseAdmin } from '../services/supabase.js'

export const quantRouter = Router()

quantRouter.get('/indicators/:code', async (req, res, next) => {
  try {
    const { code } = req.params
    const cacheKey = `ind:${code}`
    const cached = await cacheGet(cacheKey)
    if (cached) return ok(res, cached)

    const quotes = await loadDailyQuotes(code, { limit: 300 })
    if (!quotes.length) throw new AppError('股票不存在或暂无行情', 404, 404)
    const dates = quotes.map((q) => q.trade_date)
    const closes = quotes.map((q) => q.close)
    const data = buildIndicators(dates, closes)
    await cacheSet(cacheKey, data, 300)
    return ok(res, data)
  } catch (err) {
    next(err)
  }
})

quantRouter.post('/backtest', requireAuth, async (req, res, next) => {
  try {
    const body = z
      .object({
        stock_code: z.string(),
        start_date: z.string().optional(),
        end_date: z.string().optional(),
        config: z.object({
          type: z.literal('dual_ma'),
          shortPeriod: z.number().int().min(2).max(60).default(5),
          longPeriod: z.number().int().min(5).max(250).default(20),
          initialCapital: z.number().positive().optional(),
        }),
      })
      .parse(req.body)

    if (body.config.shortPeriod >= body.config.longPeriod) {
      throw new AppError('短期均线周期须小于长期均线')
    }

    const taskId = randomUUID()
    backtestTasks.set(taskId, { status: 'running', progress: 0 })

    setTimeout(async () => {
      try {
        let quotes = await loadDailyQuotes(body.stock_code, {
          from: body.start_date,
          to: body.end_date,
          limit: 500,
        })
        if (body.start_date) quotes = quotes.filter((q) => q.trade_date >= body.start_date!)
        if (body.end_date) quotes = quotes.filter((q) => q.trade_date <= body.end_date!)
        if (quotes.length < body.config.longPeriod + 5) {
          backtestTasks.set(taskId, { status: 'failed', error: '历史数据不足' })
          return
        }
        const result = runDualMABacktest(quotes, body.config)
        backtestTasks.set(taskId, {
          status: 'completed',
          stock_code: body.stock_code,
          start_date: quotes[0].trade_date,
          end_date: quotes[quotes.length - 1].trade_date,
          ...result,
        })
      } catch (e) {
        backtestTasks.set(taskId, { status: 'failed', error: String(e) })
      }
    }, 400)

    return ok(res, { taskId })
  } catch (err) {
    next(err)
  }
})

quantRouter.get('/backtest/:taskId', requireAuth, async (req, res, next) => {
  try {
    const task = backtestTasks.get(req.params.taskId)
    if (!task) throw new AppError('任务不存在', 404, 404)
    return ok(res, task)
  } catch (err) {
    next(err)
  }
})

/** 仅用库内已有日线计算，避免全市场逐只外呼 */
async function loadClosesFromDb(codes: string[], minBars = 30) {
  const supabase = getSupabaseAdmin()
  const since = new Date()
  since.setDate(since.getDate() - 220)
  const sinceStr = since.toISOString().slice(0, 10)

  const closesMap = new Map<string, number[]>()
  // 分批 in 查询，避免 URL/请求过大
  for (let i = 0; i < codes.length; i += 200) {
    const batch = codes.slice(i, i + 200)
    const { data, error } = await supabase
      .from('daily_quotes')
      .select('stock_code,trade_date,close')
      .in('stock_code', batch)
      .gte('trade_date', sinceStr)
      .order('trade_date', { ascending: true })
    if (error) throw dbFail(error, '查询失败')
    for (const row of data || []) {
      const arr = closesMap.get(row.stock_code) || []
      arr.push(Number(row.close))
      closesMap.set(row.stock_code, arr)
    }
  }

  // 过滤长度不足的
  for (const [code, arr] of closesMap) {
    if (arr.length < minBars) closesMap.delete(code)
  }
  return closesMap
}

quantRouter.get('/screener', optionalAuth, async (req, res, next) => {
  try {
    const indicator = String(req.query.indicator || 'rsi')
    const op = String(req.query.op || 'gt')
    const value = Number(req.query.value ?? 70)
    const limit = Math.min(Number(req.query.limit) || 50, 200)

    const cacheKey = `screener:${indicator}:${op}:${value}:${limit}`
    const cached = await cacheGet(cacheKey)
    if (cached) return ok(res, cached)

    type StockRow = { code: string; name: string; market: string; sector?: string | null }
    let stockList: StockRow[] = []
    const realtimeMap = new Map<
      string,
      { change_percent: number; price: number; volume: number }
    >()

    if (isDemo()) {
      stockList = stocks
      getRealtimeQuotes().forEach((q) =>
        realtimeMap.set(q.stock_code, {
          change_percent: q.change_percent,
          price: q.price,
          volume: q.volume,
        }),
      )
    } else {
      const supabase = getSupabaseAdmin()
      // 有实时行情的标的作为候选池（比全表 stocks 更可控）
      const { data: quotes, error: qErr } = await supabase
        .from('realtime_quotes')
        .select('stock_code,price,change_percent,volume')
        .order('updated_at', { ascending: false })
        .limit(3000)
      if (qErr) throw dbFail(qErr, '获取行情失败')

      ;(quotes || []).forEach((q) =>
        realtimeMap.set(q.stock_code, {
          change_percent: Number(q.change_percent),
          price: Number(q.price),
          volume: Number(q.volume),
        }),
      )

      const codes = [...realtimeMap.keys()].filter((c) => {
        if (!/^\d{6}$/.test(c)) return false
        if (c.startsWith('60') || c.startsWith('68')) return true
        if (c.startsWith('00') || c.startsWith('30')) return true
        // 北交所常见：43/82/83/87/88，排除 400 老三板
        if (/^(43|82|83|87|88)/.test(c)) return true
        return false
      })
      const { data: s, error: sErr } = await supabase
        .from('stocks')
        .select('code,name,market,sector')
        .in('code', codes.slice(0, 3000))
        .eq('is_active', true)
      if (sErr) throw dbFail(sErr, '获取股票列表失败')
      stockList = (s || []).filter((row) => {
        const name = row.name || ''
        return !name.includes('退市') && !/^R/.test(name.trim())
      })
    }

    const results: Array<
      StockRow & {
        metric: number
        quote?: { stock_code: string; price: number; change_percent: number; volume: number }
      }
    > = []

    if (indicator === 'change_percent') {
      for (const stock of stockList) {
        const metric = realtimeMap.get(stock.code)?.change_percent
        if (metric == null) continue
        const pass =
          op === 'gt' ? metric > value : op === 'lt' ? metric < value : Math.abs(metric - value) < 0.01
        if (!pass) continue
        const quote = realtimeMap.get(stock.code)
        results.push({
          ...stock,
          metric: +metric.toFixed(4),
          quote: quote
            ? {
                stock_code: stock.code,
                price: quote.price,
                change_percent: quote.change_percent,
                volume: quote.volume,
              }
            : undefined,
        })
        if (results.length >= limit) break
      }
    } else {
      // RSI / MA：优先取库内已有日线的股票，避免大量空算
      let closesMap: Map<string, number[]>
      let candidates = stockList

      if (isDemo()) {
        closesMap = new Map(
          stockList
            .map((s) => {
              const closes = (dailyQuotesMap[s.code] || []).map((q) => q.close)
              return [s.code, closes] as const
            })
            .filter(([, c]) => c.length >= 30),
        )
      } else {
        const supabase = getSupabaseAdmin()
        const { data: coded, error: cErr } = await supabase
          .from('daily_quotes')
          .select('stock_code')
          .limit(5000)
        if (cErr) throw dbFail(cErr, '获取日线数据失败')
        const hasDaily = [...new Set((coded || []).map((r) => r.stock_code))]
        candidates = stockList.filter((s) => hasDaily.includes(s.code))
        // 若交集太少，直接用有日线的股票补全基础信息
        if (candidates.length < 20 && hasDaily.length) {
          const { data: extra } = await supabase
            .from('stocks')
            .select('code,name,market,sector')
            .in('code', hasDaily.slice(0, 500))
            .eq('is_active', true)
          candidates = extra || []
        }
        closesMap = await loadClosesFromDb(
          candidates.map((s) => s.code),
          indicator === 'ma_cross' ? 25 : 20,
        )
      }

      for (const stock of candidates) {
        const closes = closesMap.get(stock.code)
        if (!closes?.length) continue

        let metric: number | null = null
        if (indicator === 'rsi') {
          const rsi = calcRSI(closes, 14)
          const last = rsi[rsi.length - 1]
          metric = last == null ? null : last
        } else if (indicator === 'ma_cross') {
          const ma5 = calcMA(closes, 5)
          const ma20 = calcMA(closes, 20)
          const a = ma5[ma5.length - 1]
          const b = ma20[ma20.length - 1]
          metric = a != null && b != null ? a - b : null
        }

        if (metric == null) continue
        const pass =
          op === 'gt' ? metric > value : op === 'lt' ? metric < value : Math.abs(metric - value) < 0.01
        if (!pass) continue

        const quote = realtimeMap.get(stock.code)
        results.push({
          ...stock,
          metric: +metric.toFixed(4),
          quote: quote
            ? {
                stock_code: stock.code,
                price: quote.price,
                change_percent: quote.change_percent,
                volume: quote.volume,
              }
            : undefined,
        })
        if (results.length >= limit) break
      }
    }

    // 按指标值排序，更直观
    results.sort((a, b) => b.metric - a.metric)
    const payload = results.slice(0, limit)
    await cacheSet(cacheKey, payload, 60)
    return ok(res, payload)
  } catch (err) {
    next(err)
  }
})

quantRouter.get('/export/:code', async (req, res, next) => {
  try {
    const { code } = req.params
    const quotes = await loadDailyQuotes(code, { limit: 1000 })
    if (!quotes.length) throw new AppError('股票不存在', 404, 404)

    const header = 'trade_date,open,high,low,close,volume,amount,turnover\n'
    const rows = quotes
      .map(
        (q) =>
          `${q.trade_date},${q.open},${q.high},${q.low},${q.close},${q.volume},${q.amount},${q.turnover}`,
      )
      .join('\n')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${code}_daily.csv"`)
    res.send('\uFEFF' + header + rows)
  } catch (err) {
    next(err)
  }
})
