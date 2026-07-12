import type { Request, Response, NextFunction } from 'express'
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { AppError } from './errorHandler.js'
import { getSupabaseAnon } from '../services/supabase.js'
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

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

function getJwks() {
  const jwksUrl = process.env.SUPABASE_JWKS_URL
  if (!jwksUrl) return null
  if (!jwks) jwks = createRemoteJWKSet(new URL(jwksUrl))
  return jwks
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req)
  if (!token) return next()
  try {
    req.user = await resolveUser(token)
  } catch {
    // ignore
  }
  next()
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req)
    if (!token) throw new AppError('未登录，请先登录', 401, 401)
    req.user = await resolveUser(token)
    next()
  } catch (err) {
    next(err)
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) return header.slice(7).trim() || null
  return null
}

function userFromPayload(payload: JWTPayload): AuthUser {
  const meta = (payload.user_metadata || payload.app_metadata || {}) as Record<string, unknown>
  return {
    id: String(payload.sub || ''),
    email: String(payload.email || ''),
    username: typeof meta.username === 'string' ? meta.username : undefined,
  }
}

async function resolveUser(token: string): Promise<AuthUser> {
  if (process.env.DEMO_MODE === 'true') {
    const user = demoUsers.find((u) => u.token === token)
    if (!user) throw new AppError('登录已失效，请重新登录', 401, 401)
    return { id: user.id, email: user.email, username: user.username }
  }

  // 1) 优先用 JWKS 本地验签（兼容新版 sb_secret / sb_publishable）
  const keys = getJwks()
  if (keys) {
    try {
      const issuer = `${process.env.SUPABASE_URL?.replace(/\/$/, '')}/auth/v1`
      const { payload } = await jwtVerify(token, keys, {
        issuer,
        audience: 'authenticated',
      })
      if (!payload.sub) throw new Error('missing sub')
      return userFromPayload(payload)
    } catch {
      // 宽松再试一次（部分项目 audience 配置不同）
      try {
        const { payload } = await jwtVerify(token, keys)
        if (!payload.sub) throw new Error('missing sub')
        return userFromPayload(payload)
      } catch {
        // fall through
      }
    }
  }

  // 2) 回退：用 publishable key 调 Auth getUser（不要用 secret key，易触发 Invalid JWT）
  const supabase = getSupabaseAnon()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) {
    throw new AppError('登录已失效，请重新登录', 401, 401)
  }
  return {
    id: data.user.id,
    email: data.user.email || '',
    username: data.user.user_metadata?.username,
  }
}
