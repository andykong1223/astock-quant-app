import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { watchlistApi, stocksApi } from '@/api'
import type { WatchlistGroup, WatchlistItem, StockAdvice } from '@/types'
import { useUserStore } from './user'
import { analyzeCombined } from '@/utils/combinedAdvice'

/** Demo watchlist for guests */
const DEMO_CODES = ['600519', '300750', '002594', '000001', '600036']

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++
      results[idx] = await fn(items[idx])
    }
  }
  const n = Math.min(concurrency, Math.max(items.length, 1))
  await Promise.all(Array.from({ length: n }, () => worker()))
  return results
}

export const useWatchlistStore = defineStore('watchlist', () => {
  const groups = ref<WatchlistGroup[]>([])
  const items = ref<WatchlistItem[]>([])
  const adviceByCode = ref<Record<string, StockAdvice>>({})
  const adviceLoading = ref(false)
  const loading = ref(false)
  const refreshInterval = ref<number>(0)
  let timer: ReturnType<typeof setInterval> | null = null
  let adviceTimer: ReturnType<typeof setTimeout> | null = null
  let lastAdviceAt = 0
  let adviceSeq = 0

  const sortedItems = computed(() =>
    [...items.value].sort((a, b) => a.sort_order - b.sort_order),
  )

  /**
   * 与个股详情「综合研判」同一套逻辑：日线 closes + 资讯 → analyzeCombined
   */
  async function fetchAdvice(force = false) {
    const codes = [...new Set(items.value.map((i) => i.stock_code))]
    if (!codes.length) {
      adviceByCode.value = {}
      return
    }

    if (!force && Date.now() - lastAdviceAt < 60_000 && Object.keys(adviceByCode.value).length) {
      const missing = codes.filter((c) => !adviceByCode.value[c])
      if (!missing.length) return
    }

    const seq = ++adviceSeq
    adviceLoading.value = true
    try {
      const target = force
        ? codes
        : codes.filter((c) => !adviceByCode.value[c] || Date.now() - lastAdviceAt >= 60_000)
      const toFetch = target.length ? target : codes

      const rows = await mapPool(toFetch, 3, async (code) => {
        try {
          const [daily, news] = await Promise.all([
            stocksApi.daily(code, { limit: 300 }),
            stocksApi.news(code, 15).catch(() => []),
          ])
          const closes = daily.map((d) => d.close)
          const analysis = analyzeCombined(closes, news)
          if (!analysis) return null
          const advice: StockAdvice = {
            code,
            action: analysis.action,
            action_label: analysis.actionLabel,
            score: analysis.score,
          }
          return advice
        } catch {
          return null
        }
      })

      if (seq !== adviceSeq) return

      const map: Record<string, StockAdvice> = { ...adviceByCode.value }
      for (const a of rows) {
        if (a) map[a.code] = a
      }
      adviceByCode.value = map
      lastAdviceAt = Date.now()
    } finally {
      if (seq === adviceSeq) adviceLoading.value = false
    }
  }

  async function fetchWatchlist() {
    const userStore = useUserStore()
    loading.value = true
    try {
      if (!userStore.isLoggedIn) {
        const batch = await stocksApi.batch(DEMO_CODES)
        groups.value = [{ id: 'demo', user_id: '', name: '演示自选', sort_order: 0 }]
        items.value = batch.map((s, i) => ({
          id: `demo-${s.code}`,
          user_id: '',
          stock_code: s.code,
          group_id: 'demo',
          sort_order: i,
          added_at: new Date().toISOString(),
          stock: s,
          quote: s,
        }))
      } else {
        const data = await watchlistApi.list()
        groups.value = data.groups
        items.value = data.items
      }
    } finally {
      loading.value = false
    }

    if (adviceTimer) clearTimeout(adviceTimer)
    adviceTimer = setTimeout(() => {
      void fetchAdvice()
    }, 50)
  }

  async function addStock(code: string, groupId?: string | null) {
    await watchlistApi.add(code, groupId ?? null)
    await fetchWatchlist()
  }

  async function removeItem(itemId: string) {
    await watchlistApi.remove(itemId)
    const removed = items.value.find((i) => i.id === itemId)
    items.value = items.value.filter((i) => i.id !== itemId)
    if (removed) {
      const next = { ...adviceByCode.value }
      delete next[removed.stock_code]
      adviceByCode.value = next
    }
  }

  function setRefreshInterval(seconds: number) {
    refreshInterval.value = seconds
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    if (seconds > 0) {
      timer = setInterval(() => {
        void fetchWatchlist()
      }, seconds * 1000)
    }
  }

  function sortByChange() {
    items.value = [...items.value].sort(
      (a, b) => (b.quote?.change_percent || 0) - (a.quote?.change_percent || 0),
    )
  }

  return {
    groups,
    items,
    adviceByCode,
    adviceLoading,
    sortedItems,
    loading,
    refreshInterval,
    fetchWatchlist,
    fetchAdvice,
    addStock,
    removeItem,
    setRefreshInterval,
    sortByChange,
  }
})
