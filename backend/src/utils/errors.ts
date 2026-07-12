import { AppError } from '../middleware/errorHandler.js'

type ErrLike = {
  message?: string
  code?: string | number
  details?: string
  hint?: string
  status?: number
}

function pickRaw(err: unknown): { message: string; code: string; details: string } {
  if (!err) return { message: '', code: '', details: '' }
  if (typeof err === 'string') return { message: err, code: '', details: '' }

  const e = err as ErrLike
  return {
    message: String(e.message || ''),
    code: String(e.code || ''),
    details: String(e.details || e.hint || ''),
  }
}

function looksLikeDbDump(text: string): boolean {
  return /violates|duplicate key|foreign key|relation |column |permission denied|PGRST|SQLSTATE|postgres|supabase|null value|check constraint|syntax error|JWT|stack/i.test(
    text,
  )
}

function isChineseFriendly(text: string): boolean {
  return /^[\u4e00-\u9fff]/.test(text) && text.length <= 60 && !looksLikeDbDump(text)
}

/**
 * 将数据库 / Auth / 网络等原始错误转成用户可读中文
 */
export function friendlyMessage(err: unknown, fallback = '操作失败，请稍后重试'): string {
  const { message, code, details } = pickRaw(err)
  const text = `${message} ${details}`.trim()

  // Postgres / PostgREST 常见码
  if (code === '23505' || /duplicate key|unique constraint/i.test(text)) {
    if (/watchlist_items|user_id.*stock_code|stock_code/i.test(text)) return '该股票已在自选中'
    if (/watchlist_groups|groups_user_id_name/i.test(text)) return '分组名称已存在'
    if (/user_strategies|strategies/i.test(text)) return '同名策略已存在'
    if (/email|users_email/i.test(text)) return '该邮箱已被注册'
    return '数据已存在，请勿重复操作'
  }

  if (code === '23503' || /foreign key constraint/i.test(text)) {
    if (/stock/i.test(text)) return '股票不存在或尚未收录到系统'
    if (/group/i.test(text)) return '分组不存在'
    return '关联数据不存在，无法完成操作'
  }

  if (code === '23502' || /null value .* violates not-null/i.test(text)) {
    return '提交信息不完整，请检查后重试'
  }

  if (code === '22P02' || /invalid input syntax/i.test(text)) {
    return '参数格式不正确'
  }

  if (code === '42501' || /permission denied|rls/i.test(text)) {
    return '没有权限执行此操作'
  }

  if (code === 'PGRST116' || /JSON object requested, multiple \(or no\) rows/i.test(text) || /0 rows/i.test(text)) {
    return '未找到相关数据'
  }

  if (code === 'PGRST301' || /JWT expired|token is expired/i.test(text)) {
    return '登录已过期，请重新登录'
  }

  // Supabase Auth
  if (/user already registered|email address has already been registered/i.test(text)) {
    return '该邮箱已注册，请直接登录'
  }
  if (/invalid login credentials|invalid.*credentials/i.test(text)) return '邮箱或密码错误'
  if (/email not confirmed/i.test(text)) return '请先完成邮箱验证后再登录'
  if (/password should be at least/i.test(text)) return '密码长度至少 6 位'
  if (/unable to validate email|invalid.*email/i.test(text)) return '邮箱格式不正确'
  if (/rate limit|too many requests/i.test(text)) return '操作过于频繁，请稍后再试'
  if (/signup is disabled/i.test(text)) return '当前暂未开放注册'

  // 网络 / 上游
  if (/fetch failed|econnrefused|enotfound|etimedout|socket|network/i.test(text)) {
    return '网络异常，请稍后重试'
  }
  if (/timeout|timed out/i.test(text)) return '请求超时，请稍后重试'
  if (/行情接口 HTTP/i.test(text)) return '行情服务暂时不可用，请稍后重试'

  // 已是友好中文
  if (isChineseFriendly(message)) return message

  // 明显是底层报错
  if (looksLikeDbDump(text)) return fallback

  if (!message) return fallback
  return message.length > 80 ? fallback : message
}

/** 把任意错误包装为 AppError（对外友好文案） */
export function dbFail(err: unknown, fallback = '操作失败，请稍后重试', status = 400): AppError {
  return new AppError(friendlyMessage(err, fallback), status, status)
}
