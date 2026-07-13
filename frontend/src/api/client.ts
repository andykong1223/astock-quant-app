import axios from 'axios'
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import {
  getToken,
  getRefreshToken,
  clearAuthSession,
  setAuthSession,
  getStoredUserRaw,
} from '@/utils/authStorage'

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 15000,
})

let refreshing: Promise<string | null> | null = null

async function tryRefreshToken(): Promise<string | null> {
  const refresh = getRefreshToken()
  if (!refresh || refresh.startsWith('demo-')) return null

  try {
    const res = await axios.post<ApiResponse<{ token: string; refresh_token?: string }>>(
      `${api.defaults.baseURL}/auth/refresh`,
      { refresh_token: refresh },
      { timeout: 15000 },
    )
    const body = res.data
    if (!body || body.code !== 0 || !body.data?.token) return null

    const userRaw = getStoredUserRaw() || '{}'
    setAuthSession(body.data.token, userRaw, body.data.refresh_token ?? refresh)
    return body.data.token
  } catch {
    return null
  }
}

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => {
    const body = res.data as ApiResponse
    if (body && typeof body.code === 'number' && body.code !== 0) {
      return Promise.reject(new Error(body.message || '请求失败'))
    }
    return res
  },
  async (err) => {
    const status = err.response?.status
    let msg = err.response?.data?.message || err.message || '网络错误'
    const original = err.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (/violates|duplicate key|PGRST|SQLSTATE|JWT|relation |permission denied/i.test(String(msg))) {
      msg = status === 401 ? '登录已失效，请重新登录' : '操作失败，请稍后重试'
    }
    if (/timeout|Network Error|ECONNABORTED/i.test(String(msg))) {
      msg = '网络异常，请稍后重试'
    }

    if (status === 401 && original && !original._retry && !String(original.url || '').includes('/auth/')) {
      original._retry = true
      refreshing = refreshing ?? tryRefreshToken().finally(() => {
        refreshing = null
      })
      const newToken = await refreshing
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`
        return api.request(original)
      }
    }

    if (status === 401) {
      clearAuthSession()
      const path = window.location.pathname + window.location.search
      if (!path.startsWith('/login')) {
        window.location.assign(`/login?redirect=${encodeURIComponent(path)}`)
      }
    }

    return Promise.reject(new Error(msg))
  },
)

export async function request<T>(fn: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const { data } = await fn
  return data.data
}

export default api
