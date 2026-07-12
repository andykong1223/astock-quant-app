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
    const msg = err.response?.data?.message || err.message || '网络错误'
    return Promise.reject(new Error(msg))
  },
)

export async function request<T>(fn: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const { data } = await fn
  return data.data
}

export default api
