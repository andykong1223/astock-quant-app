import { Router } from 'express'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { ok, AppError } from '../middleware/errorHandler.js'
import { requireAuth } from '../middleware/auth.js'
import {
  demoWatchlist,
  demoGroups,
  stocks,
  getRealtimeQuotes,
} from '../services/demoData.js'
import { getSupabaseAdmin } from '../services/supabase.js'

export const watchlistRouter = Router()
watchlistRouter.use(requireAuth)

function isDemo() {
  return process.env.DEMO_MODE === 'true'
}

watchlistRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.id

    if (isDemo()) {
      const groups = demoGroups.filter((g) => g.user_id === userId)
      const items = demoWatchlist.filter((i) => i.user_id === userId)
      const realtime = getRealtimeQuotes()
      const enriched = items.map((item) => {
        const stock = stocks.find((s) => s.code === item.stock_code)
        const quote = realtime.find((q) => q.stock_code === item.stock_code)
        return { ...item, stock, quote }
      })
      return ok(res, { groups, items: enriched })
    }

    const supabase = getSupabaseAdmin()
    const { data: groups } = await supabase
      .from('watchlist_groups')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order')
    const { data: items } = await supabase
      .from('watchlist_items')
      .select('*, stock:stocks(*), quote:realtime_quotes(*)')
      .eq('user_id', userId)
      .order('sort_order')
    return ok(res, { groups: groups || [], items: items || [] })
  } catch (err) {
    next(err)
  }
})

watchlistRouter.post('/', async (req, res, next) => {
  try {
    const body = z
      .object({
        stock_code: z.string().min(6).max(10),
        group_id: z.string().nullable().optional(),
      })
      .parse(req.body)
    const userId = req.user!.id

    if (isDemo()) {
      if (!stocks.find((s) => s.code === body.stock_code)) {
        throw new AppError('股票不存在', 404, 404)
      }
      if (demoWatchlist.some((i) => i.user_id === userId && i.stock_code === body.stock_code)) {
        throw new AppError('已在自选股中', 400)
      }
      const item = {
        id: randomUUID(),
        user_id: userId,
        stock_code: body.stock_code,
        group_id: body.group_id || 'group-default',
        sort_order: demoWatchlist.filter((i) => i.user_id === userId).length,
        added_at: new Date().toISOString(),
      }
      demoWatchlist.push(item)
      return ok(res, item)
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('watchlist_items')
      .insert({ user_id: userId, stock_code: body.stock_code, group_id: body.group_id })
      .select()
      .single()
    if (error) throw new AppError(error.message)
    return ok(res, data)
  } catch (err) {
    next(err)
  }
})

watchlistRouter.delete('/:itemId', async (req, res, next) => {
  try {
    const { itemId } = req.params
    const userId = req.user!.id

    if (isDemo()) {
      const idx = demoWatchlist.findIndex((i) => i.id === itemId && i.user_id === userId)
      if (idx < 0) throw new AppError('自选股不存在', 404, 404)
      demoWatchlist.splice(idx, 1)
      return ok(res, null, '已删除')
    }

    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('watchlist_items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', userId)
    if (error) throw new AppError(error.message)
    return ok(res, null, '已删除')
  } catch (err) {
    next(err)
  }
})

watchlistRouter.put('/:itemId/move', async (req, res, next) => {
  try {
    const { itemId } = req.params
    const body = z
      .object({
        group_id: z.string().nullable().optional(),
        sort_order: z.number().int().optional(),
      })
      .parse(req.body)
    const userId = req.user!.id

    if (isDemo()) {
      const item = demoWatchlist.find((i) => i.id === itemId && i.user_id === userId)
      if (!item) throw new AppError('自选股不存在', 404, 404)
      if (body.group_id !== undefined) item.group_id = body.group_id
      if (body.sort_order !== undefined) item.sort_order = body.sort_order
      return ok(res, item)
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('watchlist_items')
      .update(body)
      .eq('id', itemId)
      .eq('user_id', userId)
      .select()
      .single()
    if (error) throw new AppError(error.message)
    return ok(res, data)
  } catch (err) {
    next(err)
  }
})

watchlistRouter.get('/groups', async (req, res, next) => {
  try {
    const userId = req.user!.id
    if (isDemo()) {
      return ok(res, demoGroups.filter((g) => g.user_id === userId))
    }
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('watchlist_groups')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order')
    if (error) throw new AppError(error.message)
    return ok(res, data)
  } catch (err) {
    next(err)
  }
})

watchlistRouter.post('/groups', async (req, res, next) => {
  try {
    const { name } = z.object({ name: z.string().min(1).max(50) }).parse(req.body)
    const userId = req.user!.id

    if (isDemo()) {
      if (demoGroups.some((g) => g.user_id === userId && g.name === name)) {
        throw new AppError('分组名称已存在', 400)
      }
      const group = {
        id: randomUUID(),
        user_id: userId,
        name,
        sort_order: demoGroups.filter((g) => g.user_id === userId).length,
      }
      demoGroups.push(group)
      return ok(res, group)
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('watchlist_groups')
      .insert({ user_id: userId, name })
      .select()
      .single()
    if (error) throw new AppError(error.message)
    return ok(res, data)
  } catch (err) {
    next(err)
  }
})

watchlistRouter.put('/groups/:groupId', async (req, res, next) => {
  try {
    const { groupId } = req.params
    const { name } = z.object({ name: z.string().min(1).max(50) }).parse(req.body)
    const userId = req.user!.id

    if (isDemo()) {
      const group = demoGroups.find((g) => g.id === groupId && g.user_id === userId)
      if (!group) throw new AppError('分组不存在', 404, 404)
      group.name = name
      return ok(res, group)
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('watchlist_groups')
      .update({ name })
      .eq('id', groupId)
      .eq('user_id', userId)
      .select()
      .single()
    if (error) throw new AppError(error.message)
    return ok(res, data)
  } catch (err) {
    next(err)
  }
})

watchlistRouter.delete('/groups/:groupId', async (req, res, next) => {
  try {
    const { groupId } = req.params
    const userId = req.user!.id

    if (isDemo()) {
      const idx = demoGroups.findIndex((g) => g.id === groupId && g.user_id === userId)
      if (idx < 0) throw new AppError('分组不存在', 404, 404)
      demoGroups.splice(idx, 1)
      demoWatchlist.forEach((i) => {
        if (i.group_id === groupId) i.group_id = null
      })
      return ok(res, null, '已删除')
    }

    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('watchlist_groups')
      .delete()
      .eq('id', groupId)
      .eq('user_id', userId)
    if (error) throw new AppError(error.message)
    return ok(res, null, '已删除')
  } catch (err) {
    next(err)
  }
})
