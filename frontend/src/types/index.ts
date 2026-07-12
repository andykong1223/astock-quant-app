export interface User {
  id: string
  email: string
  username?: string
  avatar_url?: string
}

export interface Stock {
  code: string
  name: string
  market: string
  sector?: string
  list_date?: string
  is_active?: boolean
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
  stock?: Stock
  quote?: RealtimeQuote
}

export interface WatchlistResponse {
  groups: WatchlistGroup[]
  items: WatchlistItem[]
}

export interface Strategy {
  id: string
  user_id: string
  name: string
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface BacktestResult {
  status: string
  stock_code?: string
  start_date?: string
  end_date?: string
  total_return?: number
  annual_return?: number
  sharpe_ratio?: number
  max_drawdown?: number
  win_rate?: number
  trade_count?: number
  equity_curve?: { date: string; equity: number; benchmark: number }[]
  trades?: { date: string; side: string; price: number; shares: number; equity: number }[]
  error?: string
}

export interface SectorFundFlowItem {
  code: string
  name: string
  price: number
  change_percent: number
  main_net_inflow: number
  main_net_ratio: number
  super_net_inflow: number
  large_net_inflow: number
  medium_net_inflow: number
  small_net_inflow: number
}

export interface SectorFundFlowResult {
  board_type: 'industry' | 'concept'
  trade_date: string
  updated_at: string
  inflow: SectorFundFlowItem[]
  outflow: SectorFundFlowItem[]
}

export interface StockNewsItem {
  id: string
  title: string
  summary: string
  url: string
  published_at: string
  source: string
  type: 'news' | 'announcement'
}

export interface StockAdvice {
  code: string
  action: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'
  action_label: string
  score: number
}

export interface StockFundFlowToday {
  stock_code: string
  name: string
  trade_date: string
  updated_at: string
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
