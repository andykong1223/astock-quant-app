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
const gridClass = computed(() => (props.removable ? 'with-action' : ''))

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
      <div class="list-head" :class="gridClass">
        <span>名称/代码</span>
        <span>现价</span>
        <span>涨跌幅</span>
        <span v-if="removable" class="col-action-head">操作</span>
      </div>
      <div
        v-for="item in items"
        :key="item.id"
        class="quote-row fade-up"
        :class="gridClass"
        role="button"
        tabindex="0"
        @click="open(item.stock_code)"
        @keydown.enter="open(item.stock_code)"
      >
        <div class="col-name">
          <div class="name">{{ item.stock?.name || item.stock_code }}</div>
          <div class="code mono">{{ item.stock_code }}</div>
        </div>
        <div
          class="col-price mono"
          :class="{
            'price-up': (item.quote?.change || 0) > 0,
            'price-down': (item.quote?.change || 0) < 0,
          }"
        >
          {{ item.quote?.price?.toFixed(2) ?? '-' }}
        </div>
        <div class="col-chg">
          <PriceChange :value="item.quote?.change_percent || 0" suffix="%" />
          <div class="vol">量 {{ formatVol(item.quote?.volume) }}</div>
        </div>
        <div v-if="removable" class="col-action" @click.stop>
          <NButton size="small" quaternary type="error" @click="emit('remove', item.id)">
            删除
          </NButton>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.list-head,
.quote-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 84px 88px;
  gap: 8px;
  align-items: center;
  padding: 12px 14px;

  &.with-action {
    grid-template-columns: minmax(0, 1fr) 84px 88px 56px;
  }
}

.list-head {
  padding-top: 8px;
  padding-bottom: 8px;
  font-size: 12px;
  color: var(--text-muted);
}

.col-action-head {
  text-align: center;
}

.quote-row {
  min-height: 64px;
  border-bottom: 1px solid var(--border);
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;

  &:active,
  &:hover {
    background: var(--bg-soft);
  }
}

.name {
  font-weight: 600;
  font-size: 15px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.col-action {
  display: flex;
  justify-content: center;
  align-items: center;
}

.skel-row {
  padding: 16px 12px;
  border-bottom: 1px solid var(--border);
}
</style>
