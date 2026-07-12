<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { NTabs, NTabPane, NEmpty, NSpin, NButton, NIcon, useMessage } from 'naive-ui'
import { RefreshOutline } from '@vicons/ionicons5'
import { fundFlowApi } from '@/api'
import type { SectorFundFlowItem, SectorFundFlowResult } from '@/types'
import PriceChange from '@/components/PriceChange.vue'

const message = useMessage()
const loading = ref(false)
const boardType = ref<'industry' | 'concept'>('industry')
const direction = ref<'inflow' | 'outflow'>('inflow')
const data = ref<SectorFundFlowResult | null>(null)
let timer: ReturnType<typeof setInterval> | null = null

function formatAmount(yuan: number): string {
  const abs = Math.abs(yuan)
  const sign = yuan > 0 ? '+' : yuan < 0 ? '-' : ''
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(2)}亿`
  if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(0)}万`
  return `${sign}${abs.toFixed(0)}`
}

function barWidth(item: SectorFundFlowItem, list: SectorFundFlowItem[]): number {
  const max = Math.max(...list.map((x) => Math.abs(x.main_net_inflow)), 1)
  return Math.max(6, Math.round((Math.abs(item.main_net_inflow) / max) * 100))
}

async function load(silent = false) {
  if (!silent) loading.value = true
  try {
    data.value = await fundFlowApi.sectors({ type: boardType.value, limit: 20 })
  } catch (e) {
    if (!silent) {
      data.value = null
      message.error((e as Error).message)
    }
  } finally {
    loading.value = false
  }
}

watch(boardType, () => load())

onMounted(() => {
  load()
  timer = setInterval(() => load(true), 60_000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="page">
    <div class="head">
      <div>
        <h1 class="title">板块资金</h1>
        <p class="sub">
          当日主力资金流入 / 撤出排行
          <span v-if="data" class="date">· {{ data.trade_date }}</span>
        </p>
      </div>
      <NButton quaternary circle :loading="loading" @click="load()">
        <template #icon>
          <NIcon :component="RefreshOutline" />
        </template>
      </NButton>
    </div>

    <div class="type-switch fade-up">
      <button
        type="button"
        class="chip"
        :class="{ active: boardType === 'industry' }"
        @click="boardType = 'industry'"
      >
        行业板块
      </button>
      <button
        type="button"
        class="chip"
        :class="{ active: boardType === 'concept' }"
        @click="boardType = 'concept'"
      >
        概念板块
      </button>
    </div>

    <NTabs v-model:value="direction" type="segment" class="dir-tabs fade-up" size="medium">
      <NTabPane name="inflow" tab="主力流入" />
      <NTabPane name="outflow" tab="主力撤出" />
    </NTabs>

    <div class="panel fade-up">
      <div class="meta">
        <span>{{ direction === 'inflow' ? '净流入靠前' : '净流出靠前' }} · 前 {{ (direction === 'inflow' ? data?.inflow : data?.outflow)?.length || 0 }} 名</span>
        <NSpin v-if="loading" :size="14" />
      </div>

      <div v-if="loading && !data" class="loading-box">
        <NSpin size="small" />
        <span>加载资金流向…</span>
      </div>
      <NEmpty
        v-else-if="!(direction === 'inflow' ? data?.inflow : data?.outflow)?.length"
        description="暂无数据"
      />

      <div
        v-for="(item, idx) in direction === 'inflow' ? data?.inflow : data?.outflow"
        :key="item.code"
        class="row"
      >
        <div class="rank" :class="direction">{{ idx + 1 }}</div>
        <div class="info">
          <div class="name-row">
            <span class="name">{{ item.name }}</span>
            <PriceChange :value="item.change_percent" suffix="%" />
          </div>
          <div class="bar-track">
            <div
              class="bar"
              :class="direction"
              :style="{ width: `${barWidth(item, (direction === 'inflow' ? data?.inflow : data?.outflow) || [])}%` }"
            />
          </div>
          <div class="detail">
            <span class="mono amount" :class="direction">{{ formatAmount(item.main_net_inflow) }}</span>
            <span class="ratio">占比 {{ item.main_net_ratio.toFixed(2) }}%</span>
          </div>
        </div>
      </div>
    </div>

    <p class="hint">数据来源东方财富，约每分钟自动刷新。主力净流入 = 超大单 + 大单净额。</p>
  </div>
</template>

<style scoped lang="scss">
.page {
  padding-bottom: 24px;
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.title {
  font-size: 24px;
  font-weight: 700;
}

.sub {
  color: var(--text-secondary);
  margin: 4px 0 16px;
  font-size: 14px;
}

.date {
  color: var(--text-muted);
}

.type-switch {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}

.chip {
  height: 36px;
  padding: 0 16px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: rgba(18, 26, 43, 0.6);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;

  &.active {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-dim);
    font-weight: 600;
  }
}

.dir-tabs {
  margin-bottom: 14px;
}

.panel {
  background: rgba(18, 26, 43, 0.7);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  min-height: 240px;
}

.meta {
  padding: 10px 14px;
  font-size: 12px;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 10px;
}

.loading-box {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 48px 16px;
  color: var(--text-secondary);
  font-size: 13px;
}

.row {
  display: flex;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  align-items: flex-start;

  &:last-child {
    border-bottom: none;
  }
}

.rank {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 2px;

  &.inflow {
    background: color-mix(in srgb, var(--up) 18%, transparent);
    color: var(--up);
  }

  &.outflow {
    background: color-mix(in srgb, var(--down) 18%, transparent);
    color: var(--down);
  }
}

.info {
  flex: 1;
  min-width: 0;
}

.name-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.name {
  font-weight: 600;
  font-size: 15px;
}

.bar-track {
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
  margin-bottom: 8px;
}

.bar {
  height: 100%;
  border-radius: 999px;

  &.inflow {
    background: linear-gradient(90deg, color-mix(in srgb, var(--up) 40%, transparent), var(--up));
  }

  &.outflow {
    background: linear-gradient(90deg, color-mix(in srgb, var(--down) 40%, transparent), var(--down));
  }
}

.detail {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.amount {
  font-weight: 600;
  font-size: 13px;

  &.inflow {
    color: var(--up);
  }

  &.outflow {
    color: var(--down);
  }
}

.ratio {
  color: var(--text-muted);
}

.hint {
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
}
</style>
