import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { watchlistApi, stocksApi } from '@/api'
import type { WatchlistGroup, WatchlistItem } from '@/types'
import { useUserStore } from './user'

/** Demo watchlist for guests */
const DEMO_CODES = ['600519', '300750', '002594', '000001', '600036']

export const useWatchlistStore = defineStore('watchlist', () => {
  const groups = ref<WatchlistGroup[]>([])
  const items = ref<WatchlistItem[]>([])
  const loading = ref(false)
  const refreshInterval = ref<number>(0)
  let timer: ReturnType<typeof setInterval> | null = null

  const sortedItems = computed(() =>
    [...items.value].sort((a, b) => a.sort_order - b.sort_order),
  )

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
        return
      }
      const data = await watchlistApi.list()
      groups.value = data.groups
      items.value = data.items
    } finally {
      loading.value = false
    }
  }

  async function addStock(code: string, groupId?: string | null) {
    await watchlistApi.add(code, groupId ?? null)
    await fetchWatchlist()
  }

  async function removeItem(itemId: string) {
    await watchlistApi.remove(itemId)
    items.value = items.value.filter((i) => i.id !== itemId)
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
    sortedItems,
    loading,
    refreshInterval,
    fetchWatchlist,
    addStock,
    removeItem,
    setRefreshInterval,
    sortByChange,
  }
})
