<script setup lang="ts">
import { ref, onMounted, computed, watch, onBeforeUnmount } from 'vue'
import {
  NInput,
  NButton,
  NTabs,
  NTabPane,
  NModal,
  NSpin,
  NEmpty,
  useMessage,
} from 'naive-ui'
import { stocksApi, watchlistApi } from '@/api'
import { useWatchlistStore } from '@/stores/quotes'
import QuoteList from '@/components/QuoteList.vue'
import type { Stock } from '@/types'

const store = useWatchlistStore()
const message = useMessage()
const keyword = ref('')
const results = ref<Stock[]>([])
const searching = ref(false)
const searched = ref(false)
const showGroupModal = ref(false)
const newGroupName = ref('')
let timer: ReturnType<typeof setTimeout> | null = null
let searchSeq = 0

const activeGroup = ref<string | 'all'>('all')

const filteredItems = computed(() => {
  if (activeGroup.value === 'all') return store.sortedItems
  return store.sortedItems.filter((i) => i.group_id === activeGroup.value)
})

async function doSearch(raw: string) {
  const q = String(raw ?? '').trim()
  if (!q) {
    results.value = []
    searched.value = false
    searching.value = false
    return
  }

  const seq = ++searchSeq
  searching.value = true
  searched.value = true
  try {
    const list = await stocksApi.search(q)
    if (seq !== searchSeq) return
    results.value = Array.isArray(list) ? list : []
  } catch (e) {
    if (seq !== searchSeq) return
    results.value = []
    message.error((e as Error).message || '搜索失败')
  } finally {
    if (seq === searchSeq) searching.value = false
  }
}

watch(keyword, (v) => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    void doSearch(v)
  }, 280)
})

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})

async function add(code: string) {
  try {
    await store.addStock(code, activeGroup.value === 'all' ? undefined : activeGroup.value)
    message.success('已加入自选')
    keyword.value = ''
    results.value = []
    searched.value = false
  } catch (e) {
    message.error((e as Error).message)
  }
}

async function remove(id: string) {
  try {
    await store.removeItem(id)
    message.success('已移除')
  } catch (e) {
    message.error((e as Error).message)
  }
}

async function createGroup() {
  if (!newGroupName.value.trim()) return
  try {
    await watchlistApi.createGroup(newGroupName.value.trim())
    await store.fetchWatchlist()
    showGroupModal.value = false
    newGroupName.value = ''
    message.success('分组已创建')
  } catch (e) {
    message.error((e as Error).message)
  }
}

onMounted(() => store.fetchWatchlist())
</script>

<template>
  <div class="page">
    <h1 class="title">自选管理</h1>
    <p class="sub">搜索股票并加入自选，支持分组</p>

    <div class="search-wrap">
      <NInput
        v-model:value="keyword"
        placeholder="搜索代码 / 名称，如 600519 或 茅台"
        clearable
        size="large"
        :loading="searching"
        @keyup.enter="doSearch(keyword)"
      />

      <div v-if="keyword.trim()" class="search-panel">
        <div v-if="searching" class="search-status">
          <NSpin :size="18" />
          <span>搜索中…</span>
        </div>
        <NEmpty
          v-else-if="searched && !results.length"
          size="small"
          description="未找到匹配股票"
        />
        <button
          v-for="s in results"
          :key="s.code"
          type="button"
          class="result-row"
          @click="add(s.code)"
        >
          <div class="result-info">
            <div class="result-name">{{ s.name }}</div>
            <div class="result-meta mono">{{ s.code }} · {{ s.market }} · {{ s.sector || '-' }}</div>
          </div>
          <span class="add-label">添加</span>
        </button>
      </div>
    </div>

    <div class="group-bar">
      <NTabs v-model:value="activeGroup" type="segment" size="small">
        <NTabPane name="all" tab="全部" />
        <NTabPane v-for="g in store.groups" :key="g.id" :name="g.id" :tab="g.name" />
      </NTabs>
      <NButton size="small" @click="showGroupModal = true">新建分组</NButton>
    </div>

    <div class="panel">
      <QuoteList :items="filteredItems" :loading="store.loading" removable @remove="remove" />
    </div>

    <NModal
      v-model:show="showGroupModal"
      preset="dialog"
      title="新建分组"
      positive-text="创建"
      @positive-click="createGroup"
    >
      <NInput v-model:value="newGroupName" placeholder="分组名称" />
    </NModal>
  </div>
</template>

<style scoped lang="scss">
.title {
  font-size: 24px;
  font-weight: 700;
}
.sub {
  color: var(--text-secondary);
  margin: 4px 0 16px;
  font-size: 14px;
}
.search-wrap {
  position: relative;
  margin-bottom: 16px;
  z-index: 5;
}
.search-panel {
  margin-top: 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  max-height: 320px;
  overflow-y: auto;
}
.search-status {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
  color: var(--text-secondary);
  font-size: 13px;
}
.result-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  min-height: 56px;
  border: none;
  border-bottom: 1px solid var(--border);
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;

  &:last-child {
    border-bottom: none;
  }

  &:hover,
  &:active {
    background: var(--bg-soft);
  }
}
.result-name {
  font-weight: 600;
  font-size: 15px;
}
.result-meta {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-muted);
}
.add-label {
  flex-shrink: 0;
  color: var(--accent);
  font-size: 13px;
  font-weight: 600;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--accent-dim);
}
.group-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.panel {
  background: rgba(18, 26, 43, 0.7);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}
</style>
