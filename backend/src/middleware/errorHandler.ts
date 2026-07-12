import type { Request, Response, NextFunction } from 'express'

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

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ code: err.code, message: err.message, data: null })
  }
  console.error('[Error]', err)
  return res.status(500).json({ code: 500, message: '服务器内部错误', data: null })
}
