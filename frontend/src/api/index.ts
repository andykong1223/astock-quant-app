import api, { request } from './client'
import type {
  Stock,
  RealtimeQuote,
  DailyQuote,
  FinancialMetric,
  WatchlistResponse,
  Strategy,
  BacktestResult,
  User,
  SectorFundFlowResult,
  StockNewsItem,
  StockFundFlowResult,
  StockAdvice,
} from '@/types'

export const authApi = {
  login: (email: string, password: string) =>
    request<{ user: User; token: string }>(api.post('/auth/login', { email, password })),
  register: (email: string, password: string, username?: string) =>
    request<{ user: User; token: string }>(
      api.post('/auth/register', { email, password, username }),
    ),
  logout: () => request(api.post('/auth/logout')),
  resetPassword: (email: string) => request(api.post('/auth/reset-password', { email })),
  me: () => request<User>(api.get('/auth/me')),
  updateProfile: (payload: { username?: string; avatar_url?: string }) =>
    request<User>(api.put('/auth/profile', payload)),
}

export const stocksApi = {
  search: (q: string) => request<Stock[]>(api.get('/stocks/search', { params: { q } })),
  get: (code: string) => request<Stock>(api.get(`/stocks/${code}`)),
  daily: (code: string, params?: { from?: string; to?: string; limit?: number }) =>
    request<DailyQuote[]>(api.get(`/stocks/${code}/daily`, { params })),
  realtime: (code: string) => request<RealtimeQuote>(api.get(`/stocks/${code}/realtime`)),
  financial: (code: string) => request<FinancialMetric[]>(api.get(`/stocks/${code}/financial`)),
  batch: (codes: string[]) =>
    request<(Stock & RealtimeQuote)[]>(api.get('/stocks/batch', { params: { codes: codes.join(',') } })),
  intraday: (code: string) =>
    request<{ code: string; pre_close: number; points: { time: string; price: number; volume: number; avg: number }[] }>(
      api.get(`/stocks/${code}/intraday`),
    ),
  news: (code: string, limit = 15) =>
    request<StockNewsItem[]>(api.get(`/stocks/${code}/news`, { params: { limit } })),
  fundFlow: (code: string) => request<StockFundFlowResult>(api.get(`/stocks/${code}/fund-flow`)),
}

export const watchlistApi = {
  list: () => request<WatchlistResponse>(api.get('/watchlist')),
  add: (stock_code: string, group_id?: string | null) =>
    request(api.post('/watchlist', { stock_code, group_id })),
  remove: (itemId: string) => request(api.delete(`/watchlist/${itemId}`)),
  move: (itemId: string, payload: { group_id?: string | null; sort_order?: number }) =>
    request(api.put(`/watchlist/${itemId}/move`, payload)),
  createGroup: (name: string) => request(api.post('/watchlist/groups', { name })),
  updateGroup: (groupId: string, name: string) =>
    request(api.put(`/watchlist/groups/${groupId}`, { name })),
  deleteGroup: (groupId: string) => request(api.delete(`/watchlist/groups/${groupId}`)),
}

export const quantApi = {
  indicators: (code: string) => request(api.get(`/quant/indicators/${code}`)),
  backtest: (payload: {
    stock_code: string
    start_date?: string
    end_date?: string
    config: { type: 'dual_ma'; shortPeriod: number; longPeriod: number; initialCapital?: number }
  }) => request<{ taskId: string }>(api.post('/quant/backtest', payload)),
  backtestResult: (taskId: string) =>
    request<BacktestResult & { status: string; error?: string }>(api.get(`/quant/backtest/${taskId}`)),
  screener: (params: { indicator: string; op: string; value: number }) =>
    request(api.get('/quant/screener', { params })),
  advice: (codes: string[]) =>
    request<StockAdvice[]>(api.get('/quant/advice', { params: { codes: codes.join(',') } })),
  exportUrl: (code: string) =>
    `${import.meta.env.VITE_API_BASE_URL || '/api/v1'}/quant/export/${code}`,
}

export const strategiesApi = {
  list: () => request<Strategy[]>(api.get('/strategies')),
  create: (name: string, config: Record<string, unknown>) =>
    request<Strategy>(api.post('/strategies', { name, config })),
  get: (id: string) => request<Strategy>(api.get(`/strategies/${id}`)),
  update: (id: string, payload: { name?: string; config?: Record<string, unknown> }) =>
    request<Strategy>(api.put(`/strategies/${id}`, payload)),
  remove: (id: string) => request(api.delete(`/strategies/${id}`)),
}

export const fundFlowApi = {
  sectors: (params?: { type?: 'industry' | 'concept'; limit?: number }) =>
    request<SectorFundFlowResult>(api.get('/fund-flow/sectors', { params })),
}
