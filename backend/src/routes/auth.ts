import { Router } from 'express'
import { z } from 'zod'
import { ok, AppError } from '../middleware/errorHandler.js'
import { dbFail } from '../utils/errors.js'
import { requireAuth } from '../middleware/auth.js'
import { demoUsers } from '../services/demoData.js'
import { getSupabaseAdmin, getSupabaseAnon } from '../services/supabase.js'
import { randomUUID } from 'crypto'

export const authRouter = Router()

const credSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  username: z.string().min(2).max(50).optional(),
})

authRouter.post('/register', async (req, res, next) => {
  try {
    const body = credSchema.parse(req.body)

    if (process.env.DEMO_MODE === 'true') {
      if (demoUsers.some((u) => u.email === body.email)) {
        throw new AppError('邮箱已注册', 400)
      }
      const user = {
        id: randomUUID(),
        email: body.email,
        password: body.password,
        username: body.username || body.email.split('@')[0],
        token: `demo-token-${randomUUID()}`,
      }
      demoUsers.push(user)
      return ok(res, {
        user: { id: user.id, email: user.email, username: user.username },
        token: user.token,
      })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { username: body.username },
    })
    if (error) throw dbFail(error, '操作失败', 400)

    // 登录会话必须用 publishable/anon client，避免 secret key 干扰 JWT
    const supabase = getSupabaseAnon()
    const { data: session, error: loginErr } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    })
    if (loginErr || !session.session?.access_token) {
      throw dbFail(loginErr, '注册成功但自动登录失败，请手动登录', 400)
    }

    return ok(res, {
      user: { id: data.user.id, email: data.user.email, username: body.username },
      token: session.session.access_token,
    })
  } catch (err) {
    next(err)
  }
})

authRouter.post('/login', async (req, res, next) => {
  try {
    const body = credSchema.pick({ email: true, password: true }).parse(req.body)

    if (process.env.DEMO_MODE === 'true') {
      const user = demoUsers.find((u) => u.email === body.email && u.password === body.password)
      if (!user) throw new AppError('邮箱或密码错误', 401, 401)
      return ok(res, {
        user: { id: user.id, email: user.email, username: user.username, avatar_url: user.avatar_url },
        token: user.token,
      })
    }

    const supabase = getSupabaseAnon()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    })
    if (error || !data.session?.access_token) {
      throw new AppError('邮箱或密码错误', 401, 401)
    }

    return ok(res, {
      user: {
        id: data.user.id,
        email: data.user.email,
        username: data.user.user_metadata?.username,
      },
      token: data.session.access_token,
    })
  } catch (err) {
    next(err)
  }
})

authRouter.post('/logout', requireAuth, async (_req, res, next) => {
  try {
    return ok(res, null, '已登出')
  } catch (err) {
    next(err)
  }
})

authRouter.post('/reset-password', async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body)

    if (process.env.DEMO_MODE === 'true') {
      return ok(res, null, '演示模式：重置邮件已模拟发送')
    }

    const supabase = getSupabaseAnon()
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) throw dbFail(error, '操作失败', 400)
    return ok(res, null, '重置邮件已发送')
  } catch (err) {
    next(err)
  }
})

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    if (process.env.DEMO_MODE === 'true') {
      const user = demoUsers.find((u) => u.id === req.user!.id)
      return ok(res, {
        id: user?.id,
        email: user?.email,
        username: user?.username,
        avatar_url: user?.avatar_url,
      })
    }
    return ok(res, req.user)
  } catch (err) {
    next(err)
  }
})

authRouter.put('/profile', requireAuth, async (req, res, next) => {
  try {
    const body = z
      .object({
        username: z.string().min(2).max(50).optional(),
        avatar_url: z.string().url().optional(),
      })
      .parse(req.body)

    if (process.env.DEMO_MODE === 'true') {
      const user = demoUsers.find((u) => u.id === req.user!.id)
      if (!user) throw new AppError('用户不存在', 404, 404)
      if (body.username) user.username = body.username
      if (body.avatar_url) user.avatar_url = body.avatar_url
      return ok(res, { id: user.id, email: user.email, username: user.username, avatar_url: user.avatar_url })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', req.user!.id)
      .select()
      .single()
    if (error) throw dbFail(error, '操作失败', 400)
    return ok(res, data)
  } catch (err) {
    next(err)
  }
})
