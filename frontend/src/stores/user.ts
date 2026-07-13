import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api'
import type { User } from '@/types'
import {
  getToken,
  getRefreshToken,
  getStoredUserRaw,
  setAuthSession,
  setUserRaw,
  clearAuthSession,
} from '@/utils/authStorage'

export const useUserStore = defineStore('user', () => {
  const token = ref<string | null>(getToken())
  const refreshToken = ref<string | null>(getRefreshToken())
  const user = ref<User | null>(
    (() => {
      try {
        const raw = getStoredUserRaw()
        return raw ? (JSON.parse(raw) as User) : null
      } catch {
        return null
      }
    })(),
  )
  const loading = ref(false)

  const isLoggedIn = computed(() => !!token.value && !!user.value)

  function persist(t: string, u: User, refresh?: string | null) {
    token.value = t
    user.value = u
    if (refresh !== undefined) refreshToken.value = refresh
    setAuthSession(t, JSON.stringify(u), refresh === undefined ? undefined : refresh)
  }

  function clear() {
    token.value = null
    refreshToken.value = null
    user.value = null
    clearAuthSession()
  }

  async function login(email: string, password: string) {
    loading.value = true
    try {
      const data = await authApi.login(email, password)
      persist(data.token, data.user, data.refresh_token ?? null)
      return data.user
    } finally {
      loading.value = false
    }
  }

  async function register(email: string, password: string, username?: string) {
    loading.value = true
    try {
      const data = await authApi.register(email, password, username)
      persist(data.token, data.user, data.refresh_token ?? null)
      return data.user
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try {
      if (token.value) await authApi.logout()
    } finally {
      clear()
    }
  }

  async function fetchMe() {
    if (!token.value) return null
    try {
      const me = await authApi.me()
      user.value = me
      setUserRaw(JSON.stringify(me))
      return me
    } catch {
      clear()
      return null
    }
  }

  return { token, refreshToken, user, loading, isLoggedIn, login, register, logout, fetchMe, clear, persist }
})
