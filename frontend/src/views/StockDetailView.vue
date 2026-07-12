<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NButton,
  NSpace,
  NTabs,
  NTabPane,
  NCheckbox,
  NSpin,
  NStatistic,
  NGrid,
  NGi,
  NInputNumber,
  NForm,
  NFormItem,
  useMessage,
  NIcon,
} from 'naive-ui'
import { ArrowBackOutline, DownloadOutline, StarOutline } from '@vicons/ionicons5'
import { stocksApi, quantApi, watchlistApi } from '@/api'
import { useUserStore } from '@/stores/user'
import type { Stock, DailyQuote, FinancialMetric, RealtimeQuote, BacktestResult } from '@/types'
import PriceChange from '@/components/PriceChange.vue'
import KlineChart from '@/components/KlineChart.vue'
import IntradayChart from '@/components/IntradayChart.vue'
import * as echarts from 'echarts'
import { onBeforeUnmount } from 'vue'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const user = useUserStore()

const code = computed(() => route.params.code as string)
const loading = ref(true)
const stock = ref<Stock | null>(null)
const quote = ref<RealtimeQuote | null>(null)
const daily = ref<DailyQuote[]>([])
const financial = ref<FinancialMetric[]>([])
const indicators = ref<any>(null)
const intraday = ref<{ time: string; price: number; volume: number; avg: number }[]>([])
const preClose = ref(0)
const tab = ref('overview')
const period = ref<'day' | 'week' | 'month'>('day')
const showMa = ref(true)
const showMacd = ref(true)
const showRsi = ref(false)
const showBoll = ref(false)

const shortPeriod = ref(5)
const longPeriod = ref(20)
const backtesting = ref(false)
const backtest = ref<(BacktestResult & { status: string }) | null>(null)
const equityRef = ref<HTMLDivElement | null>(null)
let equityChart: echarts.ECharts | null = null

const latestFin = computed(() => financial.value[0] || null)

async function load() {
  loading.value = true
  try {
    const [s, q, d, f, ind, intra] = await Promise.all([
      stocksApi.get(code.value),
      stocksApi.realtime(code.value),
      stocksApi.daily(code.value, { limit: 300 }),
      stocksApi.financial(code.value),
      quantApi.indicators(code.value),
      stocksApi.intraday(code.value),
    ])
    stock.value = s
    quote.value = q
    daily.value = d
    financial.value = f
    indicators.value = ind
    intraday.value = intra.points
    preClose.value = intra.pre_close
  } catch (e) {
    message.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

async function addWatch() {
  if (!user.isLoggedIn) {
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  try {
    await watchlistApi.add(code.value)
    message.success('已加入自选')
  } catch (e) {
    message.error((e as Error).message)
  }
}

function exportCsv() {
  window.open(quantApi.exportUrl(code.value), '_blank')
}

async function runBacktest() {
  if (!user.isLoggedIn) {
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  backtesting.value = true
  backtest.value = null
  try {
    const { taskId } = await quantApi.backtest({
      stock_code: code.value,
      config: { type: 'dual_ma', shortPeriod: shortPeriod.value, longPeriod: longPeriod.value },
    })
    const poll = async () => {
      const result = await quantApi.backtestResult(taskId)
      if (result.status === 'running') {
        setTimeout(poll, 500)
        return
      }
      backtest.value = result
      backtesting.value = false
      if (result.status === 'completed') {
        setTimeout(renderEquity, 50)
      } else {
        message.error(result.error || '回测失败')
      }
    }
    await poll()
  } catch (e) {
    backtesting.value = false
    message.error((e as Error).message)
  }
}

function renderEquity() {
  if (!equityRef.value || !backtest.value?.equity_curve) return
  if (!equityChart) equityChart = echarts.init(equityRef.value)
  const curve = backtest.value.equity_curve
  equityChart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: { data: ['策略', '基准'], textStyle: { color: '#94a3b8' } },
    grid: { left: 48, right: 16, top: 32, bottom: 28 },
    xAxis: { type: 'category', data: curve.map((c) => c.date), axisLabel: { color: '#64748b', fontSize: 10 } },
    yAxis: { type: 'value', scale: true, axisLabel: { color: '#64748b' }, splitLine: { lineStyle: { color: 'rgba(148,163,184,0.08)' } } },
    series: [
      { name: '策略', type: 'line', data: curve.map((c) => c.equity), showSymbol: false, lineStyle: { color: '#2dd4a8', width: 2 } },
      { name: '基准', type: 'line', data: curve.map((c) => c.benchmark), showSymbol: false, lineStyle: { color: '#64748b', width: 1.5, type: 'dashed' } },
    ],
  })
}

watch(code, load)
watch(tab, (t) => {
  if (t === 'backtest' && backtest.value?.equity_curve) setTimeout(renderEquity, 50)
})

onMounted(load)
onBeforeUnmount(() => equityChart?.dispose())

function fmtMoney(v?: number) {
  if (v == null) return '-'
  if (v >= 1e8) return `${(v / 1e8).toFixed(2)}亿`
  if (v >= 1e4) return `${(v / 1e4).toFixed(2)}万`
  return v.toFixed(2)
}

function pct(v?: number) {
  if (v == null) return '-'
  return `${(v * 100).toFixed(2)}%`
}
</script>

<template>
  <div class="page stock-detail">
    <div class="nav-row">
      <NButton quaternary circle @click="router.back()">
        <template #icon><NIcon :component="ArrowBackOutline" /></template>
      </NButton>
      <NSpace>
        <NButton quaternary @click="exportCsv">
          <template #icon><NIcon :component="DownloadOutline" /></template>
          导出
        </NButton>
        <NButton type="primary" @click="addWatch">
          <template #icon><NIcon :component="StarOutline" /></template>
          自选
        </NButton>
      </NSpace>
    </div>

    <NSpin :show="loading">
      <div v-if="stock && quote" class="header fade-up">
        <div>
          <h1>{{ stock.name }} <span class="code mono">{{ stock.code }}</span></h1>
          <div class="meta">{{ stock.market }} · {{ stock.sector }}</div>
        </div>
        <div class="price-block">
          <div class="price mono" :class="{ 'price-up': quote.change > 0, 'price-down': quote.change < 0 }">
            {{ quote.price.toFixed(2) }}
          </div>
          <div class="chg">
            <PriceChange :value="quote.change" :digits="2" />
            <PriceChange :value="quote.change_percent" suffix="%" class="pct" />
          </div>
        </div>
      </div>

      <div v-if="quote" class="stats fade-up">
        <div><span>今开</span><b class="mono">{{ quote.open.toFixed(2) }}</b></div>
        <div><span>最高</span><b class="mono price-up">{{ quote.high.toFixed(2) }}</b></div>
        <div><span>最低</span><b class="mono price-down">{{ quote.low.toFixed(2) }}</b></div>
        <div><span>昨收</span><b class="mono">{{ quote.pre_close.toFixed(2) }}</b></div>
      </div>

      <NTabs v-model:value="tab" type="line" class="tabs">
        <NTabPane name="overview" tab="概览">
          <div class="chart-tools">
            <NSpace>
              <NButton
                v-for="p in (['day', 'week', 'month'] as const)"
                :key="p"
                size="small"
                :type="period === p ? 'primary' : 'default'"
                @click="period = p"
              >
                {{ p === 'day' ? '日K' : p === 'week' ? '周K' : '月K' }}
              </NButton>
            </NSpace>
            <NSpace>
              <NCheckbox v-model:checked="showMa">MA</NCheckbox>
              <NCheckbox v-model:checked="showBoll">BOLL</NCheckbox>
              <NCheckbox v-model:checked="showMacd" @update:checked="(v: boolean) => v && (showRsi = false)">MACD</NCheckbox>
              <NCheckbox v-model:checked="showRsi" @update:checked="(v: boolean) => v && (showMacd = false)">RSI</NCheckbox>
            </NSpace>
          </div>
          <div class="chart-panel">
            <KlineChart
              :quotes="daily"
              :indicators="indicators"
              :period="period"
              :show-ma="showMa"
              :show-macd="showMacd"
              :show-rsi="showRsi"
              :show-boll="showBoll"
            />
          </div>
          <h3 class="section-title">分时</h3>
          <div class="chart-panel">
            <IntradayChart :points="intraday" :pre-close="preClose" />
          </div>
        </NTabPane>

        <NTabPane name="financial" tab="财务">
          <div v-if="latestFin" class="fin-grid fade-up">
            <div class="fin-card"><span>PE (TTM)</span><b class="mono">{{ latestFin.pe_ttm.toFixed(2) }}</b></div>
            <div class="fin-card"><span>PB</span><b class="mono">{{ latestFin.pb.toFixed(2) }}</b></div>
            <div class="fin-card"><span>ROE</span><b class="mono">{{ latestFin.roe.toFixed(2) }}%</b></div>
            <div class="fin-card"><span>EPS</span><b class="mono">{{ latestFin.eps.toFixed(2) }}</b></div>
            <div class="fin-card"><span>营收</span><b class="mono">{{ fmtMoney(latestFin.revenue) }}</b></div>
            <div class="fin-card"><span>净利润</span><b class="mono">{{ fmtMoney(latestFin.net_profit) }}</b></div>
            <div class="fin-card"><span>毛利率</span><b class="mono">{{ latestFin.gross_margin.toFixed(2) }}%</b></div>
            <div class="fin-card"><span>净利率</span><b class="mono">{{ latestFin.net_margin.toFixed(2) }}%</b></div>
          </div>
          <p class="hint">报告期：{{ latestFin?.report_date }} · {{ latestFin?.report_type }}</p>
        </NTabPane>

        <NTabPane name="flow" tab="资金">
          <div class="flow-panel fade-up">
            <p class="hint">主力资金流向（演示估算）</p>
            <NGrid :cols="2" :x-gap="12" :y-gap="12">
              <NGi>
                <div class="fin-card">
                  <span>主力净流入</span>
                  <b class="mono price-up">+{{ fmtMoney((quote?.amount || 0) * 0.12) }}</b>
                </div>
              </NGi>
              <NGi>
                <div class="fin-card">
                  <span>主力净流出</span>
                  <b class="mono price-down">-{{ fmtMoney((quote?.amount || 0) * 0.08) }}</b>
                </div>
              </NGi>
              <NGi><div class="fin-card"><span>大单</span><b>42%</b></div></NGi>
              <NGi><div class="fin-card"><span>中单</span><b>31%</b></div></NGi>
              <NGi><div class="fin-card"><span>小单</span><b>27%</b></div></NGi>
            </NGrid>
          </div>
        </NTabPane>

        <NTabPane name="backtest" tab="回测">
          <div class="backtest-panel fade-up">
            <h3>双均线策略回测</h3>
            <p class="hint">短期均线上穿长期均线买入，下穿卖出</p>
            <NForm label-placement="left" label-width="80">
              <NFormItem label="短期MA">
                <NInputNumber v-model:value="shortPeriod" :min="2" :max="60" />
              </NFormItem>
              <NFormItem label="长期MA">
                <NInputNumber v-model:value="longPeriod" :min="5" :max="250" />
              </NFormItem>
              <NButton type="primary" :loading="backtesting" @click="runBacktest">运行回测</NButton>
            </NForm>

            <div v-if="backtest?.status === 'completed'" class="result">
              <NGrid :cols="2" :x-gap="12" :y-gap="12" responsive="screen" item-responsive>
                <NGi span="1 m:1">
                  <NStatistic label="总收益率" :value="pct(backtest.total_return)" />
                </NGi>
                <NGi>
                  <NStatistic label="年化收益" :value="pct(backtest.annual_return)" />
                </NGi>
                <NGi>
                  <NStatistic label="夏普比率" :value="backtest.sharpe_ratio?.toFixed(2)" />
                </NGi>
                <NGi>
                  <NStatistic label="最大回撤" :value="pct(backtest.max_drawdown)" />
                </NGi>
                <NGi>
                  <NStatistic label="胜率" :value="pct(backtest.win_rate)" />
                </NGi>
                <NGi>
                  <NStatistic label="交易次数" :value="backtest.trade_count" />
                </NGi>
              </NGrid>
              <div ref="equityRef" class="equity-chart" />
            </div>
          </div>
        </NTabPane>
      </NTabs>
    </NSpin>
  </div>
</template>

<style scoped lang="scss">
.nav-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
  h1 {
    font-size: 24px;
    font-weight: 700;
  }
  .code {
    font-size: 14px;
    color: var(--text-muted);
    font-weight: 500;
  }
  .meta {
    color: var(--text-secondary);
    font-size: 13px;
    margin-top: 4px;
  }
}
.price-block {
  text-align: right;
  .price {
    font-size: 32px;
    font-weight: 700;
    letter-spacing: -0.03em;
  }
  .chg {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 4px;
  }
}
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 16px;
  div {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    span {
      font-size: 11px;
      color: var(--text-muted);
    }
    b {
      font-size: 14px;
    }
  }
}
.chart-tools {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.chart-panel {
  background: rgba(18, 26, 43, 0.6);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 8px 4px;
  margin-bottom: 16px;
}
.section-title {
  font-size: 16px;
  margin-bottom: 8px;
}
.fin-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
@media (min-width: 768px) {
  .fin-grid {
    grid-template-columns: repeat(4, 1fr);
  }
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
}
.hint {
  color: var(--text-muted);
  font-size: 13px;
  margin: 12px 0;
}
.equity-chart {
  height: 280px;
  margin-top: 20px;
}
.backtest-panel h3 {
  margin-bottom: 4px;
}
.result {
  margin-top: 24px;
}
</style>
