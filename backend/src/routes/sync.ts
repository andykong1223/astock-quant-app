import { Router } from 'express'
import { ok, AppError } from '../middleware/errorHandler.js'
import { syncStockUniverse, syncRealtimeForCodes, syncDailyForCode } from '../services/syncMarket.js'
import { isDemo } from '../services/quotes.js'

export const syncRouter = Router()

let syncing = false
let lastSync: { at: string; stockCount?: number; quoteCount?: number; error?: string } | null = null

syncRouter.get('/status', (_req, res) => {
  ok(res, { syncing, lastSync, demo: isDemo(), provider: 'eastmoney' })
})

/** 全量同步 A 股列表 + 实时行情（耗时约 1–3 分钟） */
syncRouter.post('/universe', async (_req, res, next) => {
  try {
    if (isDemo()) throw new AppError('Demo 模式请关闭 DEMO_MODE 后再同步')
    if (syncing) throw new AppError('同步进行中，请稍候', 409, 409)

    syncing = true
    // 异步执行，先返回
    res.json({ code: 0, message: '已开始全量同步', data: { started: true } })

    try {
      const result = await syncStockUniverse((msg) => console.log('[Sync]', msg))
      lastSync = { at: new Date().toISOString(), ...result }
      console.log('[Sync] universe done', result)
    } catch (e) {
      lastSync = { at: new Date().toISOString(), error: String(e) }
      console.error('[Sync] universe failed', e)
    } finally {
      syncing = false
    }
  } catch (err) {
    syncing = false
    next(err)
  }
})

/** 刷新指定股票实时行情 codes=600519,000001 */
syncRouter.post('/realtime', async (req, res, next) => {
  try {
    if (isDemo()) throw new AppError('Demo 模式请关闭 DEMO_MODE')
    const codes = String(req.body?.codes || req.query.codes || '')
      .split(',')
      .map((c: string) => c.trim())
      .filter(Boolean)
    if (!codes.length) throw new AppError('请提供 codes')
    const result = await syncRealtimeForCodes(codes)
    return ok(res, result)
  } catch (err) {
    next(err)
  }
})

/** 同步单只日线 */
syncRouter.post('/daily/:code', async (req, res, next) => {
  try {
    if (isDemo()) throw new AppError('Demo 模式请关闭 DEMO_MODE')
    const limit = Number(req.body?.limit || req.query.limit) || 300
    const result = await syncDailyForCode(req.params.code, limit)
    return ok(res, result)
  } catch (err) {
    next(err)
  }
})
