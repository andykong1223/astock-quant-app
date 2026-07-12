import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api'
import type { User } from '@/types'

const TOKEN_KEY = 'astock_token'
const USER_KEY = 'astock_user'

export const useUserStore = defineStore('user', () => {
  const token = ref<string | null>(sessionStorage.getItem(TOKEN_KEY))
  const user = ref<User | null>(
    (() => {
      try {
        const raw = sessionStorage.getItem(USER_KEY)
        return raw ? (JSON.parse(raw) as User) : null
      } catch {
        return null
      }
    })(),
  )
  const loading = ref(false)

  const isLoggedIn = computed(() => !!token.value && !!user.value)

  function persist(t: string, u: User) {
    token.value = t
    user.value = u
    sessionStorage.setItem(TOKEN_KEY, t)
    sessionStorage.setItem(USER_KEY, JSON.stringify(u))
  }

  function clear() {
    token.value = null
    user.value = null
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(USER_KEY)
  }

  async function login(email: string, password: string) {
    loading.value = true
    try {
      const data = await authApi.login(email, password)
      persist(data.token, data.user)
      return data.user
    } finally {
      loading.value = false
    }
  }

  async function register(email: string, password: string, username?: string) {
    loading.value = true
    try {
      const data = await authApi.register(email, password, username)
      persist(data.token, data.user)
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
      sessionStorage.setItem(USER_KEY, JSON.stringify(me))
      return me
    } catch {
      clear()
      return null
    }
  }

  return { token, user, loading, isLoggedIn, login, register, logout, fetchMe, clear }
})
