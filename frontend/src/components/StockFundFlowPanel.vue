<script setup lang="ts">
import { NEmpty, NSpin, NGrid, NGi } from 'naive-ui'
import type { StockFundFlowResult } from '@/types'

const props = defineProps<{
  data: StockFundFlowResult | null
  loading?: boolean
}>()

function fmtMoney(yuan: number): string {
  const abs = Math.abs(yuan)
  const sign = yuan > 0 ? '+' : yuan < 0 ? '-' : ''
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(2)}亿`
  if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(0)}万`
  return `${sign}${abs.toFixed(0)}`
}

function amountClass(v: number) {
  if (v > 0) return 'price-up'
  if (v < 0) return 'price-down'
  return ''
}

function barWidth(v: number, maxAbs: number) {
  if (!maxAbs) return 0
  return Math.max(4, Math.round((Math.abs(v) / maxAbs) * 100))
}

const today = () => props.data?.today
const history = () => props.data?.history || []
const maxHist = () => Math.max(...history().map((x) => Math.abs(x.main_net_inflow)), 1)
</script>

<template>
  <div class="flow-panel fade-up">
    <div v-if="loading && !data" class="loading-box">
      <NSpin size="small" />
      <span>加载资金流向…</span>
    </div>

    <NEmpty v-else-if="!data" description="暂无资金流向数据" />

    <template v-else>
      <div class="head">
        <h3 class="title">主力资金流向</h3>
        <span class="date">{{ today()?.trade_date }}</span>
      </div>
      <p class="hint">主力 = 超大单 + 大单净额，数据来自东方财富</p>

      <NGrid :cols="2" :x-gap="12" :y-gap="12">
        <NGi>
          <div class="fin-card">
            <span>主力净流入</span>
            <b class="mono" :class="amountClass(today()!.main_net_inflow)">
              {{ fmtMoney(today()!.main_net_inflow) }}
            </b>
            <em>占比 {{ today()!.main_net_ratio.toFixed(2) }}%</em>
          </div>
        </NGi>
        <NGi>
          <div class="fin-card">
            <span>超大单</span>
            <b class="mono" :class="amountClass(today()!.super_net_inflow)">
              {{ fmtMoney(today()!.super_net_inflow) }}
            </b>
            <em>占比 {{ today()!.super_net_ratio.toFixed(2) }}%</em>
          </div>
        </NGi>
        <NGi>
          <div class="fin-card">
            <span>大单</span>
            <b class="mono" :class="amountClass(today()!.large_net_inflow)">
              {{ fmtMoney(today()!.large_net_inflow) }}
            </b>
            <em>占比 {{ today()!.large_net_ratio.toFixed(2) }}%</em>
          </div>
        </NGi>
        <NGi>
          <div class="fin-card">
            <span>中单</span>
            <b class="mono" :class="amountClass(today()!.medium_net_inflow)">
              {{ fmtMoney(today()!.medium_net_inflow) }}
            </b>
            <em>占比 {{ today()!.medium_net_ratio.toFixed(2) }}%</em>
          </div>
        </NGi>
        <NGi>
          <div class="fin-card">
            <span>小单</span>
            <b class="mono" :class="amountClass(today()!.small_net_inflow)">
              {{ fmtMoney(today()!.small_net_inflow) }}
            </b>
            <em>占比 {{ today()!.small_net_ratio.toFixed(2) }}%</em>
          </div>
        </NGi>
      </NGrid>

      <div v-if="history().length" class="hist">
        <h4 class="sub-title">近 {{ history().length }} 日主力净流入</h4>
        <div v-for="row in [...history()].reverse()" :key="row.trade_date" class="hist-row">
          <span class="d">{{ row.trade_date.slice(5) }}</span>
          <div class="track">
            <div
              class="bar"
              :class="row.main_net_inflow >= 0 ? 'in' : 'out'"
              :style="{ width: `${barWidth(row.main_net_inflow, maxHist())}%` }"
            />
          </div>
          <span class="mono amt" :class="amountClass(row.main_net_inflow)">
            {{ fmtMoney(row.main_net_inflow) }}
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.loading-box {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 16px;
  color: var(--text-secondary);
  font-size: 13px;
}

.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.title {
  margin: 0;
  font-size: 16px;
}

.date {
  font-size: 12px;
  color: var(--text-muted);
}

.hint {
  margin: 6px 0 14px;
  font-size: 12px;
  color: var(--text-muted);
}

.fin-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;

  span {
    font-size: 12px;
    color: var(--text-muted);
  }
  b {
    font-size: 18px;
  }
  em {
    font-style: normal;
    font-size: 11px;
    color: var(--text-muted);
  }
}

.hist {
  margin-top: 18px;
}

.sub-title {
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 600;
}

.hist-row {
  display: grid;
  grid-template-columns: 48px 1fr 88px;
  gap: 10px;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  font-size: 12px;

  &:last-child {
    border-bottom: none;
  }
}

.d {
  color: var(--text-muted);
}

.track {
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.bar {
  height: 100%;
  border-radius: 999px;

  &.in {
    background: linear-gradient(90deg, color-mix(in srgb, var(--up) 40%, transparent), var(--up));
  }
  &.out {
    background: linear-gradient(90deg, color-mix(in srgb, var(--down) 40%, transparent), var(--down));
  }
}

.amt {
  text-align: right;
  font-weight: 600;
}
</style>
