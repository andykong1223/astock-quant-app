import type { Request, Response, NextFunction } from 'express'
import { AppError } from './errorHandler.js'
import { getSupabaseAdmin } from '../services/supabase.js'
import { demoUsers } from '../services/demoData.js'

export interface AuthUser {
  id: string
  email: string
  username?: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req)
  if (!token) return next()
  try {
    req.user = await resolveUser(token)
  } catch {
    // ignore invalid token for optional auth
  }
  next()
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req)
    if (!token) throw new AppError('未登录', 401, 401)
    req.user = await resolveUser(token)
    next()
  } catch (err) {
    next(err)
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) return header.slice(7)
  return null
}

async function resolveUser(token: string): Promise<AuthUser> {
  if (process.env.DEMO_MODE === 'true') {
    const user = demoUsers.find((u) => u.token === token)
    if (!user) throw new AppError('Token 无效', 401, 401)
    return { id: user.id, email: user.email, username: user.username }
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) throw new AppError('Token 无效', 401, 401)
  return {
    id: data.user.id,
    email: data.user.email || '',
    username: data.user.user_metadata?.username,
  }
}
