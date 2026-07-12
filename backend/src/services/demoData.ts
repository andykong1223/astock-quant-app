/** Demo in-memory dataset so the app runs without Supabase */

export interface DemoUser {
  id: string
  email: string
  password: string
  username: string
  token: string
  avatar_url?: string
}

export interface Stock {
  code: string
  name: string
  market: string
  sector: string
  list_date: string
  is_active: boolean
}

export interface RealtimeQuote {
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

export interface DailyQuote {
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

export interface FinancialMetric {
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

export const demoUsers: DemoUser[] = [
  {
    id: 'demo-user-001',
    email: 'demo@astock.com',
    password: 'demo123456',
    username: '演示用户',
    token: 'demo-token-astock-quant',
  },
]

export const stocks: Stock[] = [
  { code: '000001', name: '平安银行', market: 'SZ', sector: '银行', list_date: '1991-04-03', is_active: true },
  { code: '000002', name: '万科A', market: 'SZ', sector: '房地产', list_date: '1991-01-29', is_active: true },
  { code: '600000', name: '浦发银行', market: 'SH', sector: '银行', list_date: '1999-11-10', is_active: true },
  { code: '600519', name: '贵州茅台', market: 'SH', sector: '白酒', list_date: '2001-08-27', is_active: true },
  { code: '000858', name: '五粮液', market: 'SZ', sector: '白酒', list_date: '1998-04-27', is_active: true },
  { code: '601318', name: '中国平安', market: 'SH', sector: '保险', list_date: '2007-03-01', is_active: true },
  { code: '300750', name: '宁德时代', market: 'SZ', sector: '新能源', list_date: '2018-06-11', is_active: true },
  { code: '002594', name: '比亚迪', market: 'SZ', sector: '汽车', list_date: '2011-06-30', is_active: true },
  { code: '600036', name: '招商银行', market: 'SH', sector: '银行', list_date: '2002-04-09', is_active: true },
  { code: '601012', name: '隆基绿能', market: 'SH', sector: '光伏', list_date: '2012-04-11', is_active: true },
  { code: '000063', name: '中兴通讯', market: 'SZ', sector: '通信', list_date: '1997-11-18', is_active: true },
  { code: '002415', name: '海康威视', market: 'SZ', sector: '安防', list_date: '2010-05-28', is_active: true },
  { code: '600276', name: '恒瑞医药', market: 'SH', sector: '医药', list_date: '2000-10-18', is_active: true },
  { code: '300059', name: '东方财富', market: 'SZ', sector: '证券', list_date: '2010-03-19', is_active: true },
  { code: '688981', name: '中芯国际', market: 'SH', sector: '半导体', list_date: '2020-07-16', is_active: true },
]

const basePrices: Record<string, number> = {
  '000001': 11.34,
  '000002': 8.88,
  '600000': 9.18,
  '600519': 1665.5,
  '000858': 144.1,
  '601318': 47.8,
  '300750': 193.3,
  '002594': 269.2,
  '600036': 35.1,
  '601012': 19.1,
  '000063': 28.3,
  '002415': 32.4,
  '600276': 44.6,
  '300059': 21.4,
  '688981': 53.2,
}

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function generateDailyQuotes(code: string, days = 250): DailyQuote[] {
  const rand = seededRandom(code.split('').reduce((a, c) => a + c.charCodeAt(0), 0))
  let price = basePrices[code] || 20
  const quotes: DailyQuote[] = []
  const today = new Date()

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    if (d.getDay() === 0 || d.getDay() === 6) continue

    const changePct = (rand() - 0.48) * 0.04
    const open = +(price * (1 + (rand() - 0.5) * 0.01)).toFixed(3)
    const close = +(open * (1 + changePct)).toFixed(3)
    const high = +Math.max(open, close, open * (1 + rand() * 0.015)).toFixed(3)
    const low = +Math.min(open, close, open * (1 - rand() * 0.015)).toFixed(3)
    const volume = Math.floor(5_000_000 + rand() * 50_000_000)
    const amount = +(volume * close).toFixed(2)

    quotes.push({
      stock_code: code,
      trade_date: d.toISOString().slice(0, 10),
      open,
      high,
      low,
      close,
      volume,
      amount,
      turnover: +(0.5 + rand() * 3).toFixed(4),
    })
    price = close
  }
  return quotes
}

export const dailyQuotesMap: Record<string, DailyQuote[]> = Object.fromEntries(
  stocks.map((s) => [s.code, generateDailyQuotes(s.code)]),
)

export function getRealtimeQuotes(): RealtimeQuote[] {
  return stocks.map((s) => {
    const series = dailyQuotesMap[s.code]
    const last = series[series.length - 1]
    const prev = series[series.length - 2]
    const change = +(last.close - prev.close).toFixed(3)
    const change_percent = +((change / prev.close) * 100).toFixed(4)
    return {
      stock_code: s.code,
      price: last.close,
      change,
      change_percent,
      volume: last.volume,
      amount: last.amount,
      high: last.high,
      low: last.low,
      open: last.open,
      pre_close: prev.close,
      updated_at: new Date().toISOString(),
    }
  })
}

export const financialMetrics: FinancialMetric[] = stocks.flatMap((s) => {
  const base = basePrices[s.code] || 20
  return [
    {
      stock_code: s.code,
      report_date: '2024-12-31',
      report_type: 'YEAR',
      revenue: +(base * 1e8 * (0.8 + Math.random())).toFixed(4),
      net_profit: +(base * 1e7 * (0.5 + Math.random())).toFixed(4),
      eps: +(0.5 + Math.random() * 8).toFixed(4),
      roe: +(8 + Math.random() * 25).toFixed(4),
      pe_ttm: +(10 + Math.random() * 40).toFixed(4),
      pb: +(1 + Math.random() * 8).toFixed(4),
      gross_margin: +(20 + Math.random() * 50).toFixed(4),
      net_margin: +(5 + Math.random() * 30).toFixed(4),
    },
    {
      stock_code: s.code,
      report_date: '2025-03-31',
      report_type: 'Q1',
      revenue: +(base * 3e7 * (0.8 + Math.random())).toFixed(4),
      net_profit: +(base * 3e6 * (0.5 + Math.random())).toFixed(4),
      eps: +(0.1 + Math.random() * 2).toFixed(4),
      roe: +(2 + Math.random() * 8).toFixed(4),
      pe_ttm: +(10 + Math.random() * 40).toFixed(4),
      pb: +(1 + Math.random() * 8).toFixed(4),
      gross_margin: +(20 + Math.random() * 50).toFixed(4),
      net_margin: +(5 + Math.random() * 30).toFixed(4),
    },
  ]
})

// In-memory watchlist / strategies for demo user
export interface WatchlistGroup {
  id: string
  user_id: string
  name: string
  sort_order: number
}

export interface WatchlistItem {
  id: string
  user_id: string
  stock_code: string
  group_id: string | null
  sort_order: number
  added_at: string
}

export interface Strategy {
  id: string
  user_id: string
  name: string
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

export const demoGroups: WatchlistGroup[] = [
  { id: 'group-default', user_id: 'demo-user-001', name: '默认分组', sort_order: 0 },
  { id: 'group-bank', user_id: 'demo-user-001', name: '银行股', sort_order: 1 },
]

export const demoWatchlist: WatchlistItem[] = [
  { id: 'wl-1', user_id: 'demo-user-001', stock_code: '600519', group_id: 'group-default', sort_order: 0, added_at: new Date().toISOString() },
  { id: 'wl-2', user_id: 'demo-user-001', stock_code: '300750', group_id: 'group-default', sort_order: 1, added_at: new Date().toISOString() },
  { id: 'wl-3', user_id: 'demo-user-001', stock_code: '000001', group_id: 'group-bank', sort_order: 0, added_at: new Date().toISOString() },
  { id: 'wl-4', user_id: 'demo-user-001', stock_code: '600036', group_id: 'group-bank', sort_order: 1, added_at: new Date().toISOString() },
  { id: 'wl-5', user_id: 'demo-user-001', stock_code: '002594', group_id: 'group-default', sort_order: 2, added_at: new Date().toISOString() },
]

export const demoStrategies: Strategy[] = [
  {
    id: 'strategy-1',
    user_id: 'demo-user-001',
    name: '双均线交叉',
    config: { type: 'dual_ma', shortPeriod: 5, longPeriod: 20 },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

export const backtestTasks = new Map<string, unknown>()
