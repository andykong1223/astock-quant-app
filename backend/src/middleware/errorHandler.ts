import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { friendlyMessage } from '../utils/errors.js'

export class AppError extends Error {
  code: number
  status: number

  constructor(message: string, code = 400, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

export function ok<T>(res: Response, data: T, message = 'success') {
  return res.json({ code: 0, message, data })
}

function zodMessage(err: ZodError): string {
  const issues = err.issues || []
  const first = issues[0]
  if (!first) return '请检查输入信息'

  const field = String(first.path?.[0] || '')
  const fieldLabel: Record<string, string> = {
    email: '邮箱',
    password: '密码',
    username: '昵称',
    name: '名称',
    stock_code: '股票代码',
  }
  const label = fieldLabel[field] || field
  const code = first.code

  if (field === 'email' && (code === 'invalid_string' || String(code) === 'invalid_format')) {
    return '请输入正确的邮箱地址'
  }
  if (field === 'password' && code === 'too_small') return '密码长度至少 6 位'
  if (field === 'username' && code === 'too_small') return '昵称至少 2 个字符'
  if (field === 'name' && code === 'too_small') return '名称不能为空'
  if (code === 'too_small') return `${label || '内容'}过短`
  if (code === 'too_big') return `${label || '内容'}过长`
  if (code === 'invalid_type') return `请填写${label || '必要信息'}`
  return label ? `${label}不正确` : '请检查输入信息'
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ code: 400, message: zodMessage(err), data: null })
  }

  if (err instanceof AppError) {
    const message = friendlyMessage(err, err.message)
    return res.status(err.status).json({ code: err.code, message, data: null })
  }

  console.error('[Error]', err)
  return res.status(500).json({
    code: 500,
    message: friendlyMessage(err, '服务器繁忙，请稍后重试'),
    data: null,
  })
}
