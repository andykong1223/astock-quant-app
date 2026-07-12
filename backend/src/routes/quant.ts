import { Router } from 'express'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { ok, AppError } from '../middleware/errorHandler.js'
import { requireAuth, optionalAuth } from '../middleware/auth.js'
import {
  dailyQuotesMap,
  stocks,
  getRealtimeQuotes,
  backtestTasks,
} from '../services/demoData.js'
import { buildIndicators, calcRSI, calcMA } from '../services/indicators.js'
import { runDualMABacktest } from '../services/backtest.js'
import { cacheGet, cacheSet } from '../services/cache.js'

export const quantRouter = Router()

function isDemo() {
  return process.env.DEMO_MODE === 'true'
}

quantRouter.get('/indicators/:code', async (req, res, next) => {
  try {
    const { code } = req.params
    const cacheKey = `ind:${code}`
    const cached = await cacheGet(cacheKey)
    if (cached) return ok(res, cached)

    if (isDemo()) {
      const quotes = dailyQuotesMap[code]
      if (!quotes) throw new AppError('股票不存在', 404, 404)
      const dates = quotes.map((q) => q.trade_date)
      const closes = quotes.map((q) => q.close)
      const data = buildIndicators(dates, closes)
      await cacheSet(cacheKey, data, 300)
      return ok(res, data)
    }

    throw new AppError('请启用 DEMO_MODE 或配置数据库', 501)
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

    // Simulate async task
    setTimeout(() => {
      try {
        let quotes = dailyQuotesMap[body.stock_code] || []
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
    }, 800)

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

quantRouter.get('/screener', optionalAuth, async (req, res, next) => {
  try {
    const indicator = String(req.query.indicator || 'rsi')
    const op = String(req.query.op || 'gt')
    const value = Number(req.query.value ?? 70)

    if (!isDemo()) throw new AppError('请启用 DEMO_MODE', 501)

    const results = stocks
      .map((stock) => {
        const quotes = dailyQuotesMap[stock.code]
        if (!quotes?.length) return null
        const closes = quotes.map((q) => q.close)
        let metric: number | null = null

        if (indicator === 'rsi') {
          const rsi = calcRSI(closes, 14)
          metric = rsi[rsi.length - 1]
        } else if (indicator === 'ma_cross') {
          const ma5 = calcMA(closes, 5)
          const ma20 = calcMA(closes, 20)
          const a = ma5[ma5.length - 1]
          const b = ma20[ma20.length - 1]
          metric = a != null && b != null ? a - b : null
        } else if (indicator === 'change_percent') {
          const rt = getRealtimeQuotes().find((q) => q.stock_code === stock.code)
          metric = rt?.change_percent ?? null
        }

        if (metric == null) return null
        const pass =
          op === 'gt' ? metric > value : op === 'lt' ? metric < value : Math.abs(metric - value) < 0.01
        if (!pass) return null

        const quote = getRealtimeQuotes().find((q) => q.stock_code === stock.code)
        return { ...stock, quote, metric: +metric.toFixed(4) }
      })
      .filter(Boolean)

    return ok(res, results)
  } catch (err) {
    next(err)
  }
})

quantRouter.get('/export/:code', async (req, res, next) => {
  try {
    const { code } = req.params
    const quotes = dailyQuotesMap[code]
    if (!quotes) throw new AppError('股票不存在', 404, 404)

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
