import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { Market } from './marketData.js'

const execFileAsync = promisify(execFile)

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

export interface StockFundFlowToday {
  stock_code: string
  name: string
  trade_date: string
  updated_at: string
  /** 主力净流入（超大单+大单，元） */
  main_net_inflow: number
  main_net_ratio: number
  super_net_inflow: number
  super_net_ratio: number
  large_net_inflow: number
  large_net_ratio: number
  medium_net_inflow: number
  medium_net_ratio: number
  small_net_inflow: number
  small_net_ratio: number
}

export interface StockFundFlowDay {
  trade_date: string
  main_net_inflow: number
  main_net_ratio: number
  super_net_inflow: number
  large_net_inflow: number
  medium_net_inflow: number
  small_net_inflow: number
  close: number
}

export interface StockFundFlowResult {
  today: StockFundFlowToday
  history: StockFundFlowDay[]
}

function toSecId(code: string, market?: Market): string {
  const m =
    market ||
    (code.startsWith('6') ? 'SH' : code.startsWith('8') || code.startsWith('4') ? 'BJ' : 'SZ')
  return m === 'SH' ? `1.${code}` : `0.${code}`
}

function num(v: unknown, fallback = 0): number {
  if (v == null || v === '-' || v === '') return fallback
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

async function curlJson(url: string): Promise<unknown> {
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
      'Referer: https://data.eastmoney.com/',
      '-H',
      'Accept: application/json, text/plain, */*',
      url,
    ],
    { maxBuffer: 4 * 1024 * 1024 },
  )
  if (!stdout?.trim()) throw new Error('empty response')
  return JSON.parse(stdout)
}

async function fetchToday(code: string, market?: Market): Promise<StockFundFlowToday | null> {
  const url =
    `https://push2delay.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&secids=${toSecId(code, market)}` +
    `&fields=f12,f14,f62,f184,f66,f69,f72,f75,f78,f81,f84,f87`

  const json = (await curlJson(url)) as {
    rc?: number
    data?: { diff?: Array<Record<string, string | number | null>> }
  }
  const row = json.data?.diff?.[0]
  if (!row) return null

  const tradeDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })
  return {
    stock_code: String(row.f12 || code),
    name: String(row.f14 || ''),
    trade_date: tradeDate,
    updated_at: new Date().toISOString(),
    main_net_inflow: num(row.f62),
    main_net_ratio: num(row.f184),
    super_net_inflow: num(row.f66),
    super_net_ratio: num(row.f69),
    large_net_inflow: num(row.f72),
    large_net_ratio: num(row.f75),
    medium_net_inflow: num(row.f78),
    medium_net_ratio: num(row.f81),
    small_net_inflow: num(row.f84),
    small_net_ratio: num(row.f87),
  }
}

async function fetchHistory(code: string, market?: Market, limit = 10): Promise<StockFundFlowDay[]> {
  const url =
    `https://push2his.eastmoney.com/api/qt/stock/fflow/daykline/get?lmt=${limit}&klt=101` +
    `&secid=${toSecId(code, market)}&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65`

  try {
    const json = (await curlJson(url)) as {
      data?: { klines?: string[] }
    }
    const lines = json.data?.klines || []
    // API 返回按日期升序；取末尾 limit 条后保持升序
    const sliced = lines.slice(-limit)
    return sliced
      .map((line) => {
        const p = line.split(',')
        return {
          trade_date: p[0],
          main_net_inflow: num(p[1]),
          small_net_inflow: num(p[2]),
          medium_net_inflow: num(p[3]),
          large_net_inflow: num(p[4]),
          super_net_inflow: num(p[5]),
          main_net_ratio: num(p[6]),
          close: num(p[11]),
        }
      })
      .filter((x) => x.trade_date)
  } catch (e) {
    console.warn(`[fund-flow] history ${code} failed:`, (e as Error).message)
    return []
  }
}

/** 个股当日主力资金 + 近几日历史 */
export async function fetchStockFundFlow(
  code: string,
  market?: Market,
): Promise<StockFundFlowResult | null> {
  const [today, history] = await Promise.all([
    fetchToday(code, market),
    fetchHistory(code, market, 10),
  ])
  if (!today) return null

  // 若当日 ulist 主力为 0 且历史有最新日，用历史最新日补齐（休市等）
  if (today.main_net_inflow === 0 && history.length) {
    const last = history[history.length - 1]
    today.trade_date = last.trade_date
    today.main_net_inflow = last.main_net_inflow
    today.main_net_ratio = last.main_net_ratio
    today.super_net_inflow = last.super_net_inflow
    today.large_net_inflow = last.large_net_inflow
    today.medium_net_inflow = last.medium_net_inflow
    today.small_net_inflow = last.small_net_inflow
  }

  return { today, history }
}
