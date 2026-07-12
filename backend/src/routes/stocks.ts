import { Router } from 'express'
import { ok, AppError } from '../middleware/errorHandler.js'
import { dbFail } from '../utils/errors.js'
import {
  stocks,
  dailyQuotesMap,
  getRealtimeQuotes,
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
    if (error) throw dbFail(error, '获取股票数据失败')
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

    const { loadDailyQuotes } = await import('../services/quotes.js')
    const list = await loadDailyQuotes(code, { from, to, limit })
    if (!list.length) throw new AppError('暂无日线数据', 404, 404)
    await cacheSet(cacheKey, list, 120)
    return ok(res, list)
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
    let { data, error } = await supabase
      .from('realtime_quotes')
      .select('*')
      .eq('stock_code', code)
      .maybeSingle()

    const stale =
      !data ||
      !data.updated_at ||
      Date.now() - new Date(data.updated_at).getTime() > 60_000

    if (stale && process.env.DATA_PROVIDER !== 'off') {
      try {
        const { syncRealtimeForCodes } = await import('../services/syncMarket.js')
        await syncRealtimeForCodes([code])
        const refreshed = await supabase
          .from('realtime_quotes')
          .select('*')
          .eq('stock_code', code)
          .maybeSingle()
        data = refreshed.data
        error = refreshed.error
      } catch (e) {
        console.warn('[realtime] refresh failed', (e as Error).message)
      }
    }

    if (error || !data) throw new AppError('暂无行情数据', 404, 404)
    await cacheSet(cacheKey, data, 5)
    return ok(res, data)
  } catch (err) {
    next(err)
  }
})

stocksRouter.get('/:code/financial', async (req, res, next) => {
  try {
    const { code } = req.params
    const cacheKey = `fin:${code}`
    const cached = await cacheGet(cacheKey)
    if (cached) return ok(res, cached)

    let market: 'SH' | 'SZ' | 'BJ' | undefined
    if (!isDemo()) {
      const supabase = getSupabaseAdmin()
      const { data } = await supabase.from('stocks').select('market').eq('code', code).maybeSingle()
      market = data?.market as 'SH' | 'SZ' | 'BJ' | undefined
    }

    const { loadFinancialMetrics } = await import('../services/financials.js')
    const list = await loadFinancialMetrics(code, market)
    if (!list.length) throw new AppError('暂无财务数据', 404, 404)

    await cacheSet(cacheKey, list, 600)
    return ok(res, list)
  } catch (err) {
    next(err)
  }
})

stocksRouter.get('/:code/news', async (req, res, next) => {
  try {
    const { code } = req.params
    const limit = Math.min(Math.max(Number(req.query.limit) || 15, 5), 30)
    const cacheKey = `news:${code}:${limit}`
    const cached = await cacheGet(cacheKey)
    if (cached) return ok(res, cached)

    let market: 'SH' | 'SZ' | 'BJ' | undefined
    let name: string | undefined

    if (isDemo()) {
      const s = stocks.find((x) => x.code === code)
      name = s?.name
      market = s?.market as 'SH' | 'SZ' | 'BJ' | undefined
    } else {
      const supabase = getSupabaseAdmin()
      const { data } = await supabase.from('stocks').select('name,market').eq('code', code).maybeSingle()
      name = data?.name
      market = data?.market as 'SH' | 'SZ' | 'BJ' | undefined
    }

    const { fetchStockNews } = await import('../services/stockNews.js')
    const list = await fetchStockNews(code, { market, name, limit })
    await cacheSet(cacheKey, list, 180)
    return ok(res, list)
  } catch (err) {
    next(err)
  }
})

stocksRouter.get('/:code/fund-flow', async (req, res, next) => {
  try {
    const { code } = req.params
    const cacheKey = `stock-ff:${code}`
    const cached = await cacheGet(cacheKey)
    if (cached) return ok(res, cached)

    let market: 'SH' | 'SZ' | 'BJ' | undefined
    if (!isDemo()) {
      const supabase = getSupabaseAdmin()
      const { data } = await supabase.from('stocks').select('market').eq('code', code).maybeSingle()
      market = data?.market as 'SH' | 'SZ' | 'BJ' | undefined
    } else {
      market = stocks.find((x) => x.code === code)?.market as 'SH' | 'SZ' | 'BJ' | undefined
    }

    const { fetchStockFundFlow } = await import('../services/stockFundFlow.js')
    const data = await fetchStockFundFlow(code, market)
    if (!data) throw new AppError('暂无资金流向数据', 404, 404)

    await cacheSet(cacheKey, data, 60)
    return ok(res, data)
  } catch (err) {
    next(err)
  }
})

stocksRouter.get('/:code/intraday', async (req, res, next) => {
  try {
    const { code } = req.params
    const { loadDailyQuotes } = await import('../services/quotes.js')
    const series = await loadDailyQuotes(code, { limit: 5 })
    if (!series.length) throw new AppError('股票不存在', 404, 404)
    const last = series[series.length - 1]
    const points = []
    let price = last.open
    const rand = () => Math.random()
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
