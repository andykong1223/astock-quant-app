import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * 外部行情：
 * - 股票列表/实时：东方财富 push2delay（公开）
 * - 日线：腾讯财经 fqkline（公开）
 */

export type Market = 'SH' | 'SZ' | 'BJ'

export interface MarketStock {
  code: string
  name: string
  market: Market
  sector?: string
}

export interface MarketRealtime {
  stock_code: string
  price: number
  change: number
  change_percent: number
  volume: number
  amount: number
  high: number
  low: number
  open: number
  pre_close: number
  updated_at: string
}

export interface MarketDaily {
  stock_code: string
  trade_date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  amount: number
  turnover: number
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

function listBase() {
  return (process.env.DATA_API_BASE_URL || 'https://push2delay.eastmoney.com').replace(/\/$/, '')
}

function isAShareCode(code: string, market: Market): boolean {
  if (!/^\d{6}$/.test(code)) return false
  if (market === 'SH') return code.startsWith('60') || code.startsWith('68')
  if (market === 'SZ') return code.startsWith('00') || code.startsWith('30')
  if (market === 'BJ') return code.startsWith('8') || code.startsWith('4')
  return false
}

function marketFromEm(f13: number, code: string): Market {
  if (f13 === 1) return 'SH'
  if (f13 === 0) {
    if (code.startsWith('8') || code.startsWith('4')) return 'BJ'
    return 'SZ'
  }
  return code.startsWith('6') ? 'SH' : 'SZ'
}

export function toSecId(code: string, market?: Market): string {
  const m = market || (code.startsWith('6') ? 'SH' : 'SZ')
  return m === 'SH' ? `1.${code}` : `0.${code}`
}

function toTxSymbol(code: string, market?: Market): string {
  const m = market || (code.startsWith('6') ? 'SH' : 'SZ')
  if (m === 'SH') return `sh${code}`
  if (m === 'BJ') return `bj${code}`
  return `sz${code}`
}

async function curlJson(url: string): Promise<unknown> {
  const { stdout } = await execFileAsync(
    'curl',
    [
      '-sS',
      '--max-time',
      '25',
      '-L',
      '-H',
      `User-Agent: ${UA}`,
      '-H',
      'Referer: https://quote.eastmoney.com/',
      '-H',
      'Accept: application/json, text/plain, */*',
      url,
    ],
    { maxBuffer: 20 * 1024 * 1024 },
  )
  if (!stdout?.trim()) throw new Error('empty response')
  return JSON.parse(stdout)
}

async function emFetch<T>(url: string, retries = 3): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < retries; i++) {
    try {
      return (await curlJson(url)) as T
    } catch (curlErr) {
      lastErr = curlErr
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': UA,
            Referer: 'https://quote.eastmoney.com/',
            Accept: 'application/json, text/plain, */*',
          },
        })
        if (!res.ok) throw new Error(`行情接口 HTTP ${res.status}`)
        return (await res.json()) as T
      } catch (fetchErr) {
        lastErr = fetchErr
      }
    }
    await new Promise((r) => setTimeout(r, 350 * (i + 1)))
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

interface ClistResponse {
  rc: number
  data?: {
    total: number
    diff: Array<Record<string, string | number | null>>
  }
}

/** 单市场分页（fs 分段更稳） */
export async function fetchASharePage(
  page: number,
  pageSize = 100,
  fs = 'm:1+t:2',
): Promise<{
  total: number
  stocks: MarketStock[]
  quotes: MarketRealtime[]
}> {
  const fields = ['f12', 'f13', 'f14', 'f2', 'f3', 'f4', 'f5', 'f6', 'f15', 'f16', 'f17', 'f18'].join(',')
  const url =
    `${listBase()}/api/qt/clist/get?pn=${page}&pz=${pageSize}&po=1&np=1&fltt=2&invt=2&fid=f12` +
    `&fs=${fs}&fields=${fields}`

  const json = await emFetch<ClistResponse>(url)
  if (json.rc !== 0 || !json.data?.diff) {
    return { total: 0, stocks: [], quotes: [] }
  }

  const now = new Date().toISOString()
  const stocks: MarketStock[] = []
  const quotes: MarketRealtime[] = []

  for (const row of json.data.diff) {
    const code = String(row.f12 || '')
    const name = String(row.f14 || '').trim()
    if (!code || !name || name.includes('退市')) continue

    const market = marketFromEm(num(row.f13), code)
    if (!isAShareCode(code, market)) continue
    stocks.push({ code, name, market })

    const price = num(row.f2)
    const preClose = num(row.f18)
    if (price <= 0 && preClose <= 0) continue

    quotes.push({
      stock_code: code,
      price: price || preClose,
      change: num(row.f4),
      change_percent: num(row.f3),
      volume: Math.round(num(row.f5) * 100),
      amount: num(row.f6),
      high: num(row.f15),
      low: num(row.f16),
      open: num(row.f17),
      pre_close: preClose,
      updated_at: now,
    })
  }

  return { total: json.data.total || stocks.length, stocks, quotes }
}

const MARKET_FS = [
  'm:1+t:2', // 沪主板
  'm:1+t:23', // 科创板
  'm:0+t:6', // 深主板
  'm:0+t:80', // 创业板
  'm:0+t:81', // 北交所等
]

export async function fetchAllAShares(onProgress?: (done: number, total: number) => void) {
  const pageSize = 100
  const stockMap = new Map<string, MarketStock>()
  const quoteMap = new Map<string, MarketRealtime>()
  let estimatedTotal = 0

  for (const fs of MARKET_FS) {
    const first = await fetchASharePage(1, pageSize, fs)
    estimatedTotal += first.total
    first.stocks.forEach((s) => stockMap.set(s.code, s))
    first.quotes.forEach((q) => quoteMap.set(q.stock_code, q))
    onProgress?.(stockMap.size, Math.max(estimatedTotal, stockMap.size))

    const pages = Math.max(1, Math.ceil(first.total / pageSize))
    for (let pn = 2; pn <= pages; pn++) {
      await new Promise((r) => setTimeout(r, 80))
      const page = await fetchASharePage(pn, pageSize, fs)
      page.stocks.forEach((s) => stockMap.set(s.code, s))
      page.quotes.forEach((q) => quoteMap.set(q.stock_code, q))
      onProgress?.(stockMap.size, Math.max(estimatedTotal, stockMap.size))
    }
    console.log(`[market] fs=${fs} done, stocks=${stockMap.size}`)
  }

  return {
    stocks: [...stockMap.values()],
    quotes: [...quoteMap.values()],
  }
}

/** 腾讯日 K：param=sh600519,day,,,250,qfq → [date, open, close, high, low, volume] */
export async function fetchDailyKlines(
  code: string,
  market?: Market,
  limit = 250,
): Promise<MarketDaily[]> {
  const symbol = toTxSymbol(code, market)
  const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${symbol},day,,,${limit},qfq`
  const json = await emFetch<{
    code: number
    data?: Record<string, { qfqday?: string[][]; day?: string[][] }>
  }>(url)

  const block = json.data?.[symbol]
  const rows = block?.qfqday || block?.day || []
  return rows.map((p) => ({
    stock_code: code,
    trade_date: String(p[0]).slice(0, 10),
    open: num(p[1]),
    close: num(p[2]),
    high: num(p[3]),
    low: num(p[4]),
    volume: Math.round(num(p[5])),
    amount: 0,
    turnover: 0,
  }))
}

export async function fetchRealtimeBatch(codes: string[]): Promise<MarketRealtime[]> {
  if (!codes.length) return []

  const secids = codes.map((c) => toSecId(c))
  const chunks: string[][] = []
  for (let i = 0; i < secids.length; i += 40) chunks.push(secids.slice(i, i + 40))

  const now = new Date().toISOString()
  const result: MarketRealtime[] = []
  const fields = 'f12,f14,f2,f3,f4,f5,f6,f15,f16,f17,f18'

  for (const part of chunks) {
    const url =
      `${listBase()}/api/qt/ulist.np/get?fltt=2&invt=2&fields=${fields}` +
      `&secids=${part.join(',')}`
    const json = await emFetch<{
      rc: number
      data?: { diff?: Array<Record<string, string | number | null>> }
    }>(url)

    for (const row of json.data?.diff || []) {
      const code = String(row.f12 || '')
      if (!code) continue
      const price = num(row.f2)
      const preClose = num(row.f18)
      if (price <= 0 && preClose <= 0) continue
      result.push({
        stock_code: code,
        price: price || preClose,
        change: num(row.f4),
        change_percent: num(row.f3),
        volume: Math.round(num(row.f5) * 100),
        amount: num(row.f6),
        high: num(row.f15),
        low: num(row.f16),
        open: num(row.f17),
        pre_close: preClose,
        updated_at: now,
      })
    }
    await new Promise((r) => setTimeout(r, 80))
  }

  return result
}

export type SectorBoardType = 'industry' | 'concept'

export interface SectorFundFlowItem {
  code: string
  name: string
  price: number
  change_percent: number
  /** 主力净流入（元） */
  main_net_inflow: number
  /** 主力净流入占比（%） */
  main_net_ratio: number
  super_net_inflow: number
  large_net_inflow: number
  medium_net_inflow: number
  small_net_inflow: number
}

export interface SectorFundFlowResult {
  board_type: SectorBoardType
  trade_date: string
  updated_at: string
  inflow: SectorFundFlowItem[]
  outflow: SectorFundFlowItem[]
}

const BOARD_FS: Record<SectorBoardType, string> = {
  industry: 'm:90+t:2',
  concept: 'm:90+t:3',
}

function mapSectorRow(row: Record<string, string | number | null>): SectorFundFlowItem | null {
  const code = String(row.f12 || '')
  const name = String(row.f14 || '').trim()
  if (!code || !name) return null
  return {
    code,
    name,
    price: num(row.f2),
    change_percent: num(row.f3),
    main_net_inflow: num(row.f62),
    main_net_ratio: num(row.f184),
    super_net_inflow: num(row.f66),
    large_net_inflow: num(row.f72),
    medium_net_inflow: num(row.f78),
    small_net_inflow: num(row.f84),
  }
}

async function fetchSectorFundFlowPage(
  boardType: SectorBoardType,
  ascending: boolean,
  limit: number,
): Promise<SectorFundFlowItem[]> {
  const fields = ['f12', 'f14', 'f2', 'f3', 'f62', 'f184', 'f66', 'f72', 'f78', 'f84'].join(',')
  const po = ascending ? 0 : 1
  const url =
    `${listBase()}/api/qt/clist/get?pn=1&pz=${limit}&po=${po}&np=1&fltt=2&invt=2&fid=f62` +
    `&fs=${BOARD_FS[boardType]}&fields=${fields}`

  const json = await emFetch<ClistResponse>(url)
  if (json.rc !== 0 || !json.data?.diff) return []

  const items: SectorFundFlowItem[] = []
  for (const row of json.data.diff) {
    const item = mapSectorRow(row)
    if (item) items.push(item)
  }
  return items
}

/** 行业/概念板块当日主力资金流入、流出排行 */
export async function fetchSectorFundFlow(
  boardType: SectorBoardType = 'industry',
  limit = 20,
): Promise<SectorFundFlowResult> {
  const size = Math.min(Math.max(limit, 5), 50)
  const [inflow, outflowRaw] = await Promise.all([
    fetchSectorFundFlowPage(boardType, false, size),
    fetchSectorFundFlowPage(boardType, true, size),
  ])

  const outflow = outflowRaw.filter((x) => x.main_net_inflow < 0)
  const now = new Date()
  const tradeDate = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })

  return {
    board_type: boardType,
    trade_date: tradeDate,
    updated_at: now.toISOString(),
    inflow: inflow.filter((x) => x.main_net_inflow > 0),
    outflow,
  }
}
