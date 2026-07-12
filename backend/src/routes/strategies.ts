import { Router } from 'express'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { ok, AppError } from '../middleware/errorHandler.js'
import { requireAuth } from '../middleware/auth.js'
import { demoStrategies } from '../services/demoData.js'
import { getSupabaseAdmin } from '../services/supabase.js'

export const strategiesRouter = Router()
strategiesRouter.use(requireAuth)

function isDemo() {
  return process.env.DEMO_MODE === 'true'
}

strategiesRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.id
    if (isDemo()) {
      return ok(res, demoStrategies.filter((s) => s.user_id === userId))
    }
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('user_strategies')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
    if (error) throw new AppError(error.message)
    return ok(res, data)
  } catch (err) {
    next(err)
  }
})

strategiesRouter.post('/', async (req, res, next) => {
  try {
    const body = z
      .object({
        name: z.string().min(1).max(100),
        config: z.record(z.unknown()),
      })
      .parse(req.body)
    const userId = req.user!.id

    if (isDemo()) {
      const now = new Date().toISOString()
      const strategy = {
        id: randomUUID(),
        user_id: userId,
        name: body.name,
        config: body.config,
        created_at: now,
        updated_at: now,
      }
      demoStrategies.push(strategy)
      return ok(res, strategy)
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('user_strategies')
      .insert({ user_id: userId, name: body.name, config: body.config })
      .select()
      .single()
    if (error) throw new AppError(error.message)
    return ok(res, data)
  } catch (err) {
    next(err)
  }
})

strategiesRouter.get('/:id', async (req, res, next) => {
  try {
    const userId = req.user!.id
    if (isDemo()) {
      const s = demoStrategies.find((x) => x.id === req.params.id && x.user_id === userId)
      if (!s) throw new AppError('策略不存在', 404, 404)
      return ok(res, s)
    }
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('user_strategies')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .single()
    if (error || !data) throw new AppError('策略不存在', 404, 404)
    return ok(res, data)
  } catch (err) {
    next(err)
  }
})

strategiesRouter.put('/:id', async (req, res, next) => {
  try {
    const body = z
      .object({
        name: z.string().min(1).max(100).optional(),
        config: z.record(z.unknown()).optional(),
      })
      .parse(req.body)
    const userId = req.user!.id

    if (isDemo()) {
      const s = demoStrategies.find((x) => x.id === req.params.id && x.user_id === userId)
      if (!s) throw new AppError('策略不存在', 404, 404)
      if (body.name) s.name = body.name
      if (body.config) s.config = body.config
      s.updated_at = new Date().toISOString()
      return ok(res, s)
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('user_strategies')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .select()
      .single()
    if (error) throw new AppError(error.message)
    return ok(res, data)
  } catch (err) {
    next(err)
  }
})

strategiesRouter.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.user!.id
    if (isDemo()) {
      const idx = demoStrategies.findIndex((x) => x.id === req.params.id && x.user_id === userId)
      if (idx < 0) throw new AppError('策略不存在', 404, 404)
      demoStrategies.splice(idx, 1)
      return ok(res, null, '已删除')
    }
    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('user_strategies')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', userId)
    if (error) throw new AppError(error.message)
    return ok(res, null, '已删除')
  } catch (err) {
    next(err)
  }
})
