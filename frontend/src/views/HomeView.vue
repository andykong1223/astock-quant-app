<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage, NButton, NSelect, NTag, NSpace } from 'naive-ui'
import { useWatchlistStore } from '@/stores/quotes'
import { useUserStore } from '@/stores/user'
import QuoteList from '@/components/QuoteList.vue'
import { RefreshOutline, AddOutline, SwapVerticalOutline } from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'

const store = useWatchlistStore()
const user = useUserStore()
const router = useRouter()
const message = useMessage()
const refreshing = ref(false)

const intervalOptions = [
  { label: '手动刷新', value: 0 },
  { label: '3秒', value: 3 },
  { label: '5秒', value: 5 },
  { label: '10秒', value: 10 },
]

async function refresh() {
  refreshing.value = true
  try {
    await store.fetchWatchlist()
  } finally {
    refreshing.value = false
  }
}

function onInterval(v: number) {
  store.setRefreshInterval(v)
  message.success(v ? `已开启 ${v}s 自动刷新` : '已关闭自动刷新')
}

onMounted(() => {
  void store.fetchWatchlist()
})

onBeforeUnmount(() => {
  store.setRefreshInterval(0)
})
</script>

<template>
  <div class="page home">
    <div class="hero fade-up">
      <div>
        <h1>自选行情</h1>
        <p class="sub">
          {{ user.isLoggedIn ? `你好，${user.user?.username || user.user?.email}` : '演示模式 · 登录后可保存自选股' }}
        </p>
      </div>
      <NSpace>
        <NButton quaternary circle :loading="refreshing" @click="refresh">
          <template #icon><NIcon :component="RefreshOutline" /></template>
        </NButton>
        <NButton v-if="user.isLoggedIn" type="primary" @click="router.push('/watchlist')">
          <template #icon><NIcon :component="AddOutline" /></template>
          管理
        </NButton>
        <NButton v-else type="primary" @click="router.push('/login')">登录</NButton>
      </NSpace>
    </div>

    <div class="toolbar fade-up">
      <NSelect
        :value="store.refreshInterval"
        :options="intervalOptions"
        size="small"
        style="width: 120px"
        @update:value="onInterval"
      />
      <NButton size="small" quaternary @click="store.sortByChange()">
        <template #icon><NIcon :component="SwapVerticalOutline" /></template>
        按涨跌幅
      </NButton>
      <NTag v-if="!user.isLoggedIn" size="small" type="warning" :bordered="false">演示数据</NTag>
    </div>

    <div class="panel fade-up">
      <QuoteList :items="store.sortedItems" :loading="store.loading" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  gap: 12px;

  h1 {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.03em;
  }

  .sub {
    color: var(--text-secondary);
    margin-top: 4px;
    font-size: 14px;
  }
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.panel {
  background: rgba(18, 26, 43, 0.7);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  backdrop-filter: blur(8px);
}
</style>
