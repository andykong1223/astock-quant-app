/**
 * Shared quote loader: Demo memory or Supabase daily_quotes
 * 无数据或过期时自动从东方财富补齐
 */
import { dailyQuotesMap, type DailyQuote } from './demoData.js'
import { getSupabaseAdmin } from './supabase.js'
import { syncDailyForCode } from './syncMarket.js'

export function isDemo() {
  return process.env.DEMO_MODE === 'true'
}

function mapRows(data: Record<string, unknown>[]): DailyQuote[] {
  return data.map((q) => ({
    stock_code: String(q.stock_code),
    trade_date: String(q.trade_date).slice(0, 10),
    open: Number(q.open),
    high: Number(q.high),
    low: Number(q.low),
    close: Number(q.close),
    volume: Number(q.volume),
    amount: Number(q.amount),
    turnover: Number(q.turnover),
  }))
}

async function readDailyFromDb(
  code: string,
  opts?: { from?: string; to?: string; limit?: number },
): Promise<DailyQuote[]> {
  const limit = opts?.limit ?? 300
  const supabase = getSupabaseAdmin()

  // 先取最近 limit 条（降序），再正序返回，避免历史很多时拿到最旧一段
  let query = supabase
    .from('daily_quotes')
    .select('stock_code,trade_date,open,high,low,close,volume,amount,turnover')
    .eq('stock_code', code)
    .order('trade_date', { ascending: false })
    .limit(limit)
  if (opts?.from) query = query.gte('trade_date', opts.from)
  if (opts?.to) query = query.lte('trade_date', opts.to)

  const { data, error } = await query
  if (error) throw error
  return mapRows(data || []).reverse()
}

function isStale(quotes: DailyQuote[]): boolean {
  if (!quotes.length) return true
  const last = quotes[quotes.length - 1].trade_date
  const lastDate = new Date(last)
  const now = new Date()
  // 超过 4 个自然日未更新则视为过期（覆盖周末）
  const diffDays = (now.getTime() - lastDate.getTime()) / (24 * 3600 * 1000)
  return diffDays > 4
}

export async function loadDailyQuotes(
  code: string,
  opts?: { from?: string; to?: string; limit?: number },
): Promise<DailyQuote[]> {
  const limit = opts?.limit ?? 300

  if (isDemo()) {
    let list = dailyQuotesMap[code] || []
    if (opts?.from) list = list.filter((q) => q.trade_date >= opts.from!)
    if (opts?.to) list = list.filter((q) => q.trade_date <= opts.to!)
    return list.slice(-limit)
  }

  let list = await readDailyFromDb(code, opts)

  if (isStale(list) && process.env.DATA_PROVIDER !== 'off') {
    try {
      await syncDailyForCode(code, Math.max(limit, 250))
      list = await readDailyFromDb(code, opts)
    } catch (e) {
      console.warn(`[quotes] sync daily ${code} failed:`, (e as Error).message)
      if (!list.length) throw e
    }
  }

  return list
}
