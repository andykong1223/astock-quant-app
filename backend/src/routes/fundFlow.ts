import { Router } from 'express'
import { z } from 'zod'
import { ok, AppError } from '../middleware/errorHandler.js'
import { cacheGet, cacheSet } from '../services/cache.js'
import { fetchSectorFundFlow, type SectorBoardType } from '../services/marketData.js'

export const fundFlowRouter = Router()

fundFlowRouter.get('/sectors', async (req, res, next) => {
  try {
    const query = z
      .object({
        type: z.enum(['industry', 'concept']).default('industry'),
        limit: z.coerce.number().int().min(5).max(50).default(20),
      })
      .parse(req.query)

    const boardType = query.type as SectorBoardType
    const cacheKey = `fundflow:sectors:${boardType}:${query.limit}`
    const cached = await cacheGet(cacheKey)
    if (cached) return ok(res, cached)

    const data = await fetchSectorFundFlow(boardType, query.limit)
    if (!data.inflow.length && !data.outflow.length) {
      throw new AppError('暂无板块资金流向数据，请稍后重试', 503, 503)
    }

    await cacheSet(cacheKey, data, 60)
    return ok(res, data)
  } catch (err) {
    next(err)
  }
})
