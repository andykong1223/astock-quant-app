import { Router } from 'express'
import { ok, AppError } from '../middleware/errorHandler.js'
import {
  stocks,
  dailyQuotesMap,
  getRealtimeQuotes,
  financialMetrics,
} from '../services/demoData.js'
import { cacheGet, cacheSet } from '../services/cache.js'
import { buildIndicators } from '../services/indicators.js'
import { getSupabaseAdmin } from '../services/supabase.js'

export const stocksRouter = Router()

function isDemo() {
  return process.env.DEMO_MODE === 'true'
}

stocksRouter.get('/search', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase()
    if (!q) return ok(res, [])

    if (isDemo()) {
      const list = stocks.filter(
        (s) => s.code.includes(q) || s.name.toLowerCase().includes(q) || s.sector?.includes(q),
      )
      return ok(res, list.slice(0, 20))
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('stocks')
      .select('*')
      .or(`code.ilike.%${q}%,name.ilike.%${q}%`)
      .eq('is_active', true)
      .limit(20)
    if (error) throw new AppError(error.message)
    return ok(res, data)
  } catch (err) {
    next(err)
  }
})

stocksRouter.get('/batch', async (req, res, next) => {
  try {
    const codes = String(req.query.codes || '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, 50)

    if (!codes.length) return ok(res, [])

    if (isDemo()) {
      const realtime = getRealtimeQuotes()
      const list = codes.map((code) => {
        const stock = stocks.find((s) => s.code === code)
        const quote = realtime.find((r) => r.stock_code === code)
        return stock && quote ? { ...stock, ...quote } : null
      }).filter(Boolean)
      return ok(res, list)
    }

    const supabase = getSupabaseAdmin()
    const { data: stockList } = await supabase.from('stocks').select('*').in('code', codes)
    const { data: quotes } = await supabase.from('realtime_quotes').select('*').in('stock_code', codes)
    const merged = (stockList || []).map((s) => ({
      ...s,
      ...(quotes || []).find((q) => q.stock_code === s.code),
    }))
    return ok(res, merged)
  } catch (err) {
    next(err)
  }
})

stocksRouter.get('/:code', async (req, res, next) => {
  try {
    const { code } = req.params
    if (isDemo()) {
      const stock = stocks.find((s) => s.code === code)
      if (!stock) throw new AppError('股票不存在', 404, 404)
      return ok(res, stock)
    }
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.from('stocks').select('*').eq('code', code).single()
    if (error || !data) throw new AppError('股票不存在', 404, 404)
    return ok(res, data)
  } catch (err) {
    next(err)
  }
})

stocksRouter.get('/:code/daily', async (req, res, next) => {
  try {
    const { code } = req.params
    const from = req.query.from as string | undefined
    const to = req.query.to as string | undefined
    const limit = Number(req.query.limit) || 250

    const cacheKey = `daily:${code}:${from || ''}:${to || ''}:${limit}`
    const cached = await cacheGet(cacheKey)
    if (cached) return ok(res, cached)

    if (isDemo()) {
      let list = dailyQuotesMap[code]
      if (!list) throw new AppError('股票不存在', 404, 404)
      if (from) list = list.filter((q) => q.trade_date >= from)
      if (to) list = list.filter((q) => q.trade_date <= to)
      list = list.slice(-limit)
      await cacheSet(cacheKey, list, 300)
      return ok(res, list)
    }

    const supabase = getSupabaseAdmin()
    let query = supabase
      .from('daily_quotes')
      .select('*')
      .eq('stock_code', code)
      .order('trade_date', { ascending: true })
      .limit(limit)
    if (from) query = query.gte('trade_date', from)
    if (to) query = query.lte('trade_date', to)
    const { data, error } = await query
    if (error) throw new AppError(error.message)
    await cacheSet(cacheKey, data, 300)
    return ok(res, data)
  } catch (err) {
    next(err)
  }
})

stocksRouter.get('/:code/realtime', async (req, res, next) => {
  try {
    const { code } = req.params
    const cacheKey = `rt:${code}`
    const cached = await cacheGet(cacheKey)
    if (cached) return ok(res, cached)

    if (isDemo()) {
      const quote = getRealtimeQuotes().find((q) => q.stock_code === code)
      if (!quote) throw new AppError('股票不存在', 404, 404)
      // slight jitter to simulate live
      const jitter = (Math.random() - 0.5) * 0.02 * quote.price
      const price = +(quote.price + jitter).toFixed(3)
      const change = +(price - quote.pre_close).toFixed(3)
      const result = {
        ...quote,
        price,
        change,
        change_percent: +((change / quote.pre_close) * 100).toFixed(4),
        updated_at: new Date().toISOString(),
      }
      await cacheSet(cacheKey, result, 5)
      return ok(res, result)
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('realtime_quotes')
      .select('*')
      .eq('stock_code', code)
      .single()
    if (error || !data) throw new AppError('股票不存在', 404, 404)
    await cacheSet(cacheKey, data, 5)
    return ok(res, data)
  } catch (err) {
    next(err)
  }
})

stocksRouter.get('/:code/financial', async (req, res, next) => {
  try {
    const { code } = req.params
    if (isDemo()) {
      const list = financialMetrics.filter((f) => f.stock_code === code)
      if (!list.length) throw new AppError('暂无财务数据', 404, 404)
      return ok(res, list)
    }
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('financial_metrics')
      .select('*')
      .eq('stock_code', code)
      .order('report_date', { ascending: false })
    if (error) throw new AppError(error.message)
    return ok(res, data)
  } catch (err) {
    next(err)
  }
})

stocksRouter.get('/:code/intraday', async (req, res, next) => {
  try {
    const { code } = req.params
    if (isDemo()) {
      const series = dailyQuotesMap[code]
      if (!series) throw new AppError('股票不存在', 404, 404)
      const last = series[series.length - 1]
      const points = []
      let price = last.open
      const rand = () => Math.random()
      // 9:30 - 15:00 simulated minutes
      for (let m = 0; m < 240; m++) {
        price = +(price * (1 + (rand() - 0.5) * 0.002)).toFixed(3)
        const hour = m < 120 ? 9 + Math.floor((30 + m) / 60) : 13 + Math.floor((m - 120) / 60)
        const minute = m < 120 ? (30 + m) % 60 : (m - 120) % 60
        points.push({
          time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
          price,
          volume: Math.floor(10000 + rand() * 200000),
          avg: +((last.open + price) / 2).toFixed(3),
        })
      }
      return ok(res, { code, pre_close: last.open, points })
    }
    return ok(res, { code, points: [] })
  } catch (err) {
    next(err)
  }
})

// helper used by quant screener
export function getDemoCloses(code: string) {
  return (dailyQuotesMap[code] || []).map((q) => q.close)
}

export function getDemoDates(code: string) {
  return (dailyQuotesMap[code] || []).map((q) => q.trade_date)
}

export { buildIndicators }
