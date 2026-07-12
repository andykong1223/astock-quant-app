import axios from 'axios'
import type { AxiosInstance } from 'axios'

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('astock_token')
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
  (err) => {
    const status = err.response?.status
    let msg = err.response?.data?.message || err.message || '网络错误'

    // 兜底：避免偶发英文底层信息直接展示
    if (/violates|duplicate key|PGRST|SQLSTATE|JWT|relation |permission denied/i.test(String(msg))) {
      msg = status === 401 ? '登录已失效，请重新登录' : '操作失败，请稍后重试'
    }
    if (/timeout|Network Error|ECONNABORTED/i.test(String(msg))) {
      msg = '网络异常，请稍后重试'
    }

    if (status === 401) {
      sessionStorage.removeItem('astock_token')
      sessionStorage.removeItem('astock_user')
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
