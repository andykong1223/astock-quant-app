<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import PriceChange from './PriceChange.vue'
import type { WatchlistItem } from '@/types'
import { NButton, NEmpty, NSkeleton } from 'naive-ui'

const props = defineProps<{
  items: WatchlistItem[]
  loading?: boolean
  removable?: boolean
}>()

const emit = defineEmits<{ remove: [id: string] }>()
const router = useRouter()

function formatVol(v?: number) {
  if (!v) return '-'
  if (v >= 1e8) return `${(v / 1e8).toFixed(2)}亿`
  if (v >= 1e4) return `${(v / 1e4).toFixed(1)}万`
  return String(v)
}

const hasData = computed(() => props.items.length > 0)

function open(code: string) {
  router.push(`/stock/${code}`)
}
</script>

<template>
  <div class="quote-list">
    <div v-if="loading" class="skel-wrap">
      <div v-for="i in 5" :key="i" class="skel-row">
        <NSkeleton text :repeat="2" />
      </div>
    </div>
    <NEmpty v-else-if="!hasData" description="暂无自选股" />
    <template v-else>
      <div class="list-head">
        <span>名称/代码</span>
        <span>现价</span>
        <span>涨跌幅</span>
      </div>
      <button
        v-for="item in items"
        :key="item.id"
        class="quote-row fade-up"
        @click="open(item.stock_code)"
      >
        <div class="col-name">
          <div class="name">{{ item.stock?.name || item.stock_code }}</div>
          <div class="code mono">{{ item.stock_code }}</div>
        </div>
        <div class="col-price mono" :class="{ 'price-up': (item.quote?.change || 0) > 0, 'price-down': (item.quote?.change || 0) < 0 }">
          {{ item.quote?.price?.toFixed(2) ?? '-' }}
        </div>
        <div class="col-chg">
          <PriceChange :value="item.quote?.change_percent || 0" suffix="%" />
          <div class="vol">量 {{ formatVol(item.quote?.volume) }}</div>
        </div>
        <NButton
          v-if="removable"
          size="tiny"
          quaternary
          type="error"
          class="rm-btn"
          @click.stop="emit('remove', item.id)"
        >
          删除
        </NButton>
      </button>
    </template>
  </div>
</template>

<style scoped lang="scss">
.list-head {
  display: grid;
  grid-template-columns: 1fr 88px 88px;
  gap: 8px;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text-muted);
}

.quote-row {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 88px 88px;
  gap: 8px;
  align-items: center;
  padding: 12px;
  min-height: 64px;
  border: none;
  border-bottom: 1px solid var(--border);
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  position: relative;
  transition: background 0.15s;

  &:active,
  &:hover {
    background: var(--bg-soft);
  }
}

.name {
  font-weight: 600;
  font-size: 15px;
}

.code {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.col-price {
  font-size: 16px;
  font-weight: 600;
  text-align: right;
}

.col-chg {
  text-align: right;
}

.vol {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.rm-btn {
  position: absolute;
  right: 8px;
  top: 8px;
}

.skel-row {
  padding: 16px 12px;
  border-bottom: 1px solid var(--border);
}
</style>
