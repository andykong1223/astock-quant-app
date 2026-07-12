import { getSupabaseAdmin } from './supabase.js'
import {
  fetchAllAShares,
  fetchDailyKlines,
  fetchRealtimeBatch,
  type MarketStock,
  type MarketRealtime,
  type MarketDaily,
} from './marketData.js'

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export async function syncStockUniverse(onProgress?: (msg: string) => void) {
  onProgress?.('开始从东方财富拉取 A 股列表…')
  const { stocks, quotes } = await fetchAllAShares((done, total) => {
    onProgress?.(`拉取进度 ${done}/${total}`)
  })

  const supabase = getSupabaseAdmin()
  onProgress?.(`写入 stocks ${stocks.length} 条…`)

  for (const part of chunk(stocks, 500)) {
    const rows = part.map((s: MarketStock) => ({
      code: s.code,
      name: s.name,
      market: s.market,
      sector: s.sector || null,
      is_active: true,
    }))
    const { error } = await supabase.from('stocks').upsert(rows, { onConflict: 'code' })
    if (error) throw new Error(`写入 stocks 失败: ${error.message}`)
  }

  onProgress?.(`写入 realtime_quotes ${quotes.length} 条…`)
  for (const part of chunk(quotes, 500)) {
    const rows = part.map((q: MarketRealtime) => ({ ...q }))
    const { error } = await supabase.from('realtime_quotes').upsert(rows, { onConflict: 'stock_code' })
    if (error) throw new Error(`写入 realtime_quotes 失败: ${error.message}`)
  }

  onProgress?.(`同步完成：股票 ${stocks.length}，行情 ${quotes.length}`)
  return { stockCount: stocks.length, quoteCount: quotes.length }
}

/** 刷新指定股票实时行情（新浪批量，适合自选股） */
export async function syncRealtimeForCodes(codes: string[]) {
  const unique = [...new Set(codes.filter(Boolean))]
  if (!unique.length) return { quoteCount: 0 }
  const quotes = await fetchRealtimeBatch(unique)
  if (!quotes.length) return { quoteCount: 0 }

  const supabase = getSupabaseAdmin()
  for (const part of chunk(quotes, 200)) {
    const { error } = await supabase.from('realtime_quotes').upsert(part, { onConflict: 'stock_code' })
    if (error) throw new Error(error.message)
  }
  return { quoteCount: quotes.length }
}

/** 同步单只股票日线到 daily_quotes */
export async function syncDailyForCode(code: string, limit = 300) {
  const supabase = getSupabaseAdmin()
  const { data: stock } = await supabase.from('stocks').select('code,market').eq('code', code).maybeSingle()
  const market = (stock?.market as 'SH' | 'SZ' | 'BJ' | undefined) || undefined
  const dailies = await fetchDailyKlines(code, market, limit)
  if (!dailies.length) return { count: 0 }

  for (const part of chunk(dailies, 200)) {
    const rows = part.map((d: MarketDaily) => ({
      stock_code: d.stock_code,
      trade_date: d.trade_date,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume,
      amount: d.amount,
      turnover: d.turnover,
    }))
    const { error } = await supabase.from('daily_quotes').upsert(rows, {
      onConflict: 'stock_code,trade_date',
    })
    if (error) throw new Error(error.message)
  }

  // 用最新日线刷新 realtime（若有）
  const last = dailies[dailies.length - 1]
  const prev = dailies[dailies.length - 2] || last
  const change = +(last.close - prev.close).toFixed(3)
  await supabase.from('realtime_quotes').upsert({
    stock_code: code,
    price: last.close,
    change,
    change_percent: +((change / (prev.close || 1)) * 100).toFixed(4),
    volume: last.volume,
    amount: last.amount,
    high: last.high,
    low: last.low,
    open: last.open,
    pre_close: prev.close,
    updated_at: new Date().toISOString(),
  })

  return { count: dailies.length }
}

/** 交易时段刷新：有实时行情的全部股票（来自 DB）分批用新浪更新热门/已有记录 */
export async function syncAllRealtimeFromDb(limit = 800) {
  const supabase = getSupabaseAdmin()
  // 优先更新近期有报价记录的股票；不够则补股票表
  const { data: existing } = await supabase
    .from('realtime_quotes')
    .select('stock_code')
    .order('updated_at', { ascending: false })
    .limit(limit)

  let codes = (existing || []).map((r) => r.stock_code)
  if (codes.length < 100) {
    const { data: stocks } = await supabase.from('stocks').select('code').eq('is_active', true).limit(limit)
    codes = (stocks || []).map((s) => s.code)
  }

  return syncRealtimeForCodes(codes)
}
