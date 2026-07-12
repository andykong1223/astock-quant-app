import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { Market } from './marketData.js'
import { getSupabaseAdmin } from './supabase.js'
import { isDemo } from './quotes.js'
import { financialMetrics } from './demoData.js'

const execFileAsync = promisify(execFile)

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

export interface FinancialMetricRow {
  stock_code: string
  report_date: string
  report_type: string
  revenue: number
  net_profit: number
  eps: number
  roe: number
  pe_ttm: number
  pb: number
  gross_margin: number
  net_margin: number
}

function marketPrefix(code: string, market?: Market): string {
  const m =
    market ||
    (code.startsWith('6') ? 'SH' : code.startsWith('8') || code.startsWith('4') ? 'BJ' : 'SZ')
  return `${m}${code}`
}

function toSecId(code: string, market?: Market): string {
  const m =
    market ||
    (code.startsWith('6') ? 'SH' : code.startsWith('8') || code.startsWith('4') ? 'BJ' : 'SZ')
  return m === 'SH' ? `1.${code}` : `0.${code}`
}

function num(v: unknown, fallback = 0): number {
  if (v == null || v === '-') return fallback
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

function mapReportType(raw: string): string {
  if (raw.includes('一季')) return 'Q1'
  if (raw.includes('三季')) return 'Q3'
  if (raw.includes('中') || raw.includes('半年')) return 'HY'
  if (raw.includes('年')) return 'YEAR'
  return raw || 'YEAR'
}

async function curlJson(url: string, referer: string): Promise<unknown> {
  const { stdout } = await execFileAsync(
    'curl',
    [
      '-sS',
      '--max-time',
      '20',
      '-L',
      '-H',
      `User-Agent: ${UA}`,
      '-H',
      `Referer: ${referer}`,
      '-H',
      'Accept: application/json, text/plain, */*',
      url,
    ],
    { maxBuffer: 8 * 1024 * 1024 },
  )
  if (!stdout?.trim()) throw new Error('empty response')
  return JSON.parse(stdout)
}

async function fetchPePb(code: string, market?: Market): Promise<{ pe: number; pb: number }> {
  const url =
    `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&secids=${toSecId(code, market)}` +
    `&fields=f12,f9,f23`
  try {
    const json = (await curlJson(url, 'https://quote.eastmoney.com/')) as {
      data?: { diff?: Array<{ f9?: number; f23?: number }> }
    }
    const row = json.data?.diff?.[0]
    return { pe: num(row?.f9), pb: num(row?.f23) }
  } catch {
    return { pe: 0, pb: 0 }
  }
}

/** 东方财富主要财务指标（按报告期） */
export async function fetchFinancialFromEm(
  code: string,
  market?: Market,
): Promise<FinancialMetricRow[]> {
  const emCode = marketPrefix(code, market)
  const url = `https://emweb.securities.eastmoney.com/PC_HSF10/NewFinanceAnalysis/ZYZBAjaxNew?type=0&code=${emCode}`
  const json = (await curlJson(url, 'https://emweb.securities.eastmoney.com/')) as {
    data?: Array<Record<string, unknown>>
  }
  const rows = json.data || []
  if (!rows.length) return []

  const { pe, pb } = await fetchPePb(code, market)

  return rows.slice(0, 12).map((row) => {
    const reportDate = String(row.REPORT_DATE || '').slice(0, 10)
    return {
      stock_code: code,
      report_date: reportDate,
      report_type: mapReportType(String(row.REPORT_TYPE || '')),
      revenue: num(row.TOTALOPERATEREVE),
      net_profit: num(row.PARENTNETPROFIT),
      eps: num(row.EPSJB),
      roe: num(row.ROEJQ),
      pe_ttm: pe,
      pb,
      gross_margin: num(row.XSMLL),
      net_margin: num(row.XSJLL),
    }
  }).filter((r) => r.report_date && /^\d{4}-\d{2}-\d{2}$/.test(r.report_date))
}

async function readFromDb(code: string): Promise<FinancialMetricRow[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('financial_metrics')
    .select(
      'stock_code,report_date,report_type,revenue,net_profit,eps,roe,pe_ttm,pb,gross_margin,net_margin',
    )
    .eq('stock_code', code)
    .order('report_date', { ascending: false })
    .limit(12)
  if (error) throw error
  return (data || []).map((r) => ({
    stock_code: String(r.stock_code),
    report_date: String(r.report_date).slice(0, 10),
    report_type: String(r.report_type || ''),
    revenue: Number(r.revenue) || 0,
    net_profit: Number(r.net_profit) || 0,
    eps: Number(r.eps) || 0,
    roe: Number(r.roe) || 0,
    pe_ttm: Number(r.pe_ttm) || 0,
    pb: Number(r.pb) || 0,
    gross_margin: Number(r.gross_margin) || 0,
    net_margin: Number(r.net_margin) || 0,
  }))
}

function isStale(list: FinancialMetricRow[]): boolean {
  if (!list.length) return true
  const latest = list[0].report_date
  const days = (Date.now() - new Date(latest).getTime()) / (24 * 3600 * 1000)
  // 最新报告期超过约 5 个月则尝试刷新（覆盖季报节奏）
  return days > 160
}

async function upsertFinancials(rows: FinancialMetricRow[]) {
  if (!rows.length) return
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('financial_metrics').upsert(rows, {
    onConflict: 'stock_code,report_date',
  })
  if (error) throw error
}

/** 读取财务指标；无数据或过期时从东方财富补齐 */
export async function loadFinancialMetrics(
  code: string,
  market?: Market,
): Promise<FinancialMetricRow[]> {
  if (isDemo()) {
    return financialMetrics.filter((f) => f.stock_code === code)
  }

  let list = await readFromDb(code)

  if ((isStale(list) || !list.length) && process.env.DATA_PROVIDER !== 'off') {
    try {
      const remote = await fetchFinancialFromEm(code, market)
      if (remote.length) {
        await upsertFinancials(remote)
        list = await readFromDb(code)
      }
    } catch (e) {
      console.warn(`[financials] sync ${code} failed:`, (e as Error).message)
      if (!list.length) throw e
    }
  }

  return list
}
