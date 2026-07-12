<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed, nextTick } from 'vue'
import { NEmpty } from 'naive-ui'
import * as echarts from 'echarts'
import type { DailyQuote } from '@/types'
import { backtestAdviceSignals } from '@/utils/adviceBacktest'

const props = defineProps<{
  quotes: DailyQuote[]
  active?: boolean
}>()

const chartRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

const perf = computed(() => backtestAdviceSignals(props.quotes))

function fmtSigned(n: number) {
  return `${n > 0 ? '+' : ''}${n}`
}

function pctClass(n: number) {
  if (n > 0) return 'up'
  if (n < 0) return 'down'
  return ''
}

function renderChart() {
  if (!chartRef.value || !perf.value?.equity_curve.length) return
  if (!chart) chart = echarts.init(chartRef.value)

  const curve = perf.value.equity_curve
  const dates = curve.map((p) => p.date)
  const strategy = curve.map((p) => p.strategy)
  const buyhold = curve.map((p) => p.buyhold)
  const marks = perf.value.trades.map((t) => ({
    name: t.side === 'buy' ? '买' : '卖',
    coord: [
      t.date,
      curve.find((p) => p.date === t.date)?.strategy ?? strategy[strategy.length - 1],
    ],
    value: t.price,
    itemStyle: { color: t.side === 'buy' ? '#ef4444' : '#22c55e' },
  }))

  chart.setOption(
    {
      animation: false,
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(18,26,43,0.95)',
        borderColor: 'rgba(148,163,184,0.2)',
        textStyle: { color: '#e8eef9', fontSize: 12 },
        valueFormatter: (v: number) => (typeof v === 'number' ? v.toFixed(0) : String(v)),
      },
      legend: {
        top: 0,
        textStyle: { color: '#94a3b8', fontSize: 12 },
        data: ['建议策略', '买入持有'],
      },
      grid: { left: 12, right: 16, top: 36, bottom: 28, containLabel: true },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLabel: { color: '#64748b', fontSize: 10, hideOverlap: true },
        axisLine: { lineStyle: { color: '#334155' } },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLabel: {
          color: '#64748b',
          fontSize: 10,
          formatter: (v: number) => `${(v / 10000).toFixed(1)}万`,
        },
        splitLine: { lineStyle: { color: 'rgba(148,163,184,0.08)' } },
      },
      dataZoom: [
        { type: 'inside', start: 0, end: 100 },
        {
          type: 'slider',
          height: 16,
          bottom: 4,
          borderColor: 'transparent',
          backgroundColor: 'rgba(24,34,54,0.8)',
          fillerColor: 'rgba(45,212,168,0.2)',
          handleStyle: { color: '#2dd4a8' },
          textStyle: { color: '#64748b' },
        },
      ],
      series: [
        {
          name: '建议策略',
          type: 'line',
          data: strategy,
          showSymbol: false,
          lineStyle: { width: 2, color: '#2dd4a8' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(45,212,168,0.28)' },
              { offset: 1, color: 'rgba(45,212,168,0.02)' },
            ]),
          },
          markPoint: {
            symbol: 'circle',
            symbolSize: 8,
            data: marks.slice(-20),
            label: { show: false },
          },
        },
        {
          name: '买入持有',
          type: 'line',
          data: buyhold,
          showSymbol: false,
          lineStyle: { width: 1.5, type: 'dashed', color: '#94a3b8' },
        },
      ],
    },
    true,
  )
}

function onResize() {
  chart?.resize()
}

watch(
  () => props.quotes,
  async () => {
    await nextTick()
    renderChart()
    chart?.resize()
  },
  { deep: true },
)

watch(
  () => props.active,
  async (active) => {
    if (!active) return
    await nextTick()
    renderChart()
    chart?.resize()
  },
)

onMounted(async () => {
  await nextTick()
  if (props.active !== false) {
    renderChart()
  }
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div class="advice-bt fade-up">
    <div class="head">
      <h3>建议买卖收益回测</h3>
      <p class="hint">
        按技术建议模拟：出现偏多/建议买入开仓，偏空/建议卖出平仓；观望不操作。初始资金 10 万。
      </p>
    </div>

    <NEmpty v-if="!perf" description="日线不足，暂无法回测（约需 80 根以上）" />

    <template v-else>
      <p class="range">区间 {{ perf.start_date }} ~ {{ perf.end_date }}</p>

      <div class="metrics">
        <div>
          <span>策略收益</span>
          <b class="mono" :class="pctClass(perf.strategy_return)">{{ fmtSigned(perf.strategy_return) }}%</b>
        </div>
        <div>
          <span>同期持有</span>
          <b class="mono" :class="pctClass(perf.buyhold_return)">{{ fmtSigned(perf.buyhold_return) }}%</b>
        </div>
        <div>
          <span>相对超额</span>
          <b class="mono" :class="pctClass(perf.excess_return)">{{ fmtSigned(perf.excess_return) }}%</b>
        </div>
        <div>
          <span>最大回撤</span>
          <b class="mono down">{{ perf.max_drawdown }}%</b>
        </div>
        <div>
          <span>交易次数</span>
          <b class="mono">{{ perf.trade_count }}</b>
        </div>
        <div>
          <span>胜率</span>
          <b class="mono">{{ perf.win_rate }}%</b>
        </div>
      </div>

      <div v-if="perf.in_position && perf.unrealized_return != null" class="open-pos">
        当前仍按建议持仓，浮动盈亏
        <b class="mono" :class="pctClass(perf.unrealized_return)">{{ fmtSigned(perf.unrealized_return) }}%</b>
      </div>

      <h4 class="sub">收益曲线</h4>
      <div class="chart-wrap">
        <div ref="chartRef" class="chart" />
      </div>

      <h4 class="sub">交易明细</h4>
      <ul v-if="perf.trades.length" class="trade-list">
        <li v-for="(t, idx) in [...perf.trades].reverse()" :key="`${t.date}-${t.side}-${idx}`">
          <div class="left">
            <span class="side" :class="t.side">{{ t.side === 'buy' ? '买入' : '卖出' }}</span>
            <span class="date">{{ t.date }}</span>
          </div>
          <div class="right mono">
            <span>{{ t.price.toFixed(2) }}</span>
            <span v-if="t.return_pct != null" :class="pctClass(t.return_pct)">
              {{ fmtSigned(t.return_pct) }}%
            </span>
          </div>
        </li>
      </ul>
      <NEmpty v-else description="区间内暂无完整买卖回合" />

      <p class="foot">历史模拟不含手续费与滑点，仅供参考，不构成投资建议。</p>
    </template>
  </div>
</template>

<style scoped lang="scss">
.advice-bt {
  padding-bottom: 12px;
}

.head h3 {
  margin: 0 0 6px;
  font-size: 18px;
  font-weight: 700;
}

.hint {
  margin: 0 0 14px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.range {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--text-muted);
}

.metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 12px;

  div {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  span {
    font-size: 12px;
    color: var(--text-muted);
  }
  b {
    font-size: 18px;
    font-weight: 700;
  }
}

.up {
  color: var(--up);
}
.down {
  color: var(--down);
}

.open-pos {
  margin-bottom: 14px;
  font-size: 13px;
  color: var(--text-secondary);

  b {
    margin-left: 4px;
  }
}

.sub {
  margin: 8px 0 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
}

.chart-wrap {
  background: rgba(18, 26, 43, 0.6);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 8px 4px 4px;
  margin-bottom: 16px;
}

.chart {
  width: 100%;
  height: 320px;
}

.trade-list {
  list-style: none;
  margin: 0 0 12px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  background: rgba(18, 26, 43, 0.6);

  li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border);

    &:last-child {
      border-bottom: none;
    }
  }
}

.left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.side {
  font-size: 12px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;

  &.buy {
    color: var(--up);
    background: color-mix(in srgb, var(--up) 16%, transparent);
  }
  &.sell {
    color: var(--down);
    background: color-mix(in srgb, var(--down) 16%, transparent);
  }
}

.date {
  font-size: 13px;
  color: var(--text-secondary);
}

.right {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 600;
}

.foot {
  margin: 0;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.4;
}

@media (max-width: 480px) {
  .metrics {
    grid-template-columns: repeat(2, 1fr);
  }
  .chart {
    height: 260px;
  }
}
</style>
