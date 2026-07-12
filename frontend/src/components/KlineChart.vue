<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import * as echarts from 'echarts'
import type { DailyQuote } from '@/types'
import { buildIndicators } from '@/utils/indicators'

const props = defineProps<{
  quotes: DailyQuote[]
  /** @deprecated 日/周/月指标均按当前周期 K 线本地计算，此字段保留兼容 */
  indicators?: unknown
  period?: 'day' | 'week' | 'month'
  showMa?: boolean
  showMacd?: boolean
  showRsi?: boolean
  showBoll?: boolean
}>()

const chartRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function aggregate(quotes: DailyQuote[], period: string): DailyQuote[] {
  if (period === 'day' || !quotes.length) return quotes
  const bucket = new Map<string, DailyQuote>()
  for (const q of quotes) {
    const d = new Date(q.trade_date + 'T00:00:00')
    let key: string
    if (period === 'week') {
      const day = d.getDay() || 7
      const monday = new Date(d)
      monday.setDate(d.getDate() - day + 1)
      key = toLocalDateKey(monday)
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    }
    const prev = bucket.get(key)
    if (!prev) {
      bucket.set(key, { ...q, trade_date: key })
    } else {
      prev.high = Math.max(prev.high, q.high)
      prev.low = Math.min(prev.low, q.low)
      prev.close = q.close
      prev.volume += q.volume
      prev.amount += q.amount
    }
  }
  return [...bucket.values()]
}

const seriesQuotes = computed(() => aggregate(props.quotes, props.period || 'day'))

const chartIndicators = computed(() => {
  const closes = seriesQuotes.value.map((q) => q.close)
  if (!closes.length) return null
  return buildIndicators(closes)
})

function render() {
  if (!chartRef.value || !seriesQuotes.value.length) return
  if (!chart) chart = echarts.init(chartRef.value, undefined, { renderer: 'canvas' })

  const data = seriesQuotes.value
  const ind = chartIndicators.value
  const dates = data.map((d) => d.trade_date)
  const ohlc = data.map((d) => [d.open, d.close, d.low, d.high])
  const volumes = data.map((d) => d.volume)
  const upColor = '#ef4444'
  const downColor = '#22c55e'

  const grids: echarts.GridComponentOption[] = [
    { left: 8, right: 12, top: 24, height: props.showMacd || props.showRsi ? '46%' : '58%' },
    { left: 8, right: 12, top: props.showMacd || props.showRsi ? '58%' : '72%', height: '14%' },
  ]
  if (props.showMacd || props.showRsi) {
    grids.push({ left: 8, right: 12, top: '78%', height: '14%' })
  }

  const option: echarts.EChartsOption = {
    animation: false,
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: 'rgba(18,26,43,0.95)',
      borderColor: 'rgba(148,163,184,0.2)',
      textStyle: { color: '#e8eef9', fontSize: 12 },
    },
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    legend: {
      top: 0,
      textStyle: { color: '#94a3b8', fontSize: 11 },
      data: [
        ...(props.showMa ? ['MA5', 'MA10', 'MA20', 'MA60'] : []),
        ...(props.showBoll ? ['BOLL上', 'BOLL中', 'BOLL下'] : []),
      ],
    },
    grid: grids,
    xAxis: [
      { type: 'category', data: dates, gridIndex: 0, axisLabel: { show: false }, axisLine: { lineStyle: { color: '#334155' } } },
      { type: 'category', data: dates, gridIndex: 1, axisLabel: { show: !(props.showMacd || props.showRsi), color: '#64748b', fontSize: 10 }, axisLine: { lineStyle: { color: '#334155' } } },
      ...(props.showMacd || props.showRsi
        ? [{ type: 'category' as const, data: dates, gridIndex: 2, axisLabel: { color: '#64748b', fontSize: 10 }, axisLine: { lineStyle: { color: '#334155' } } }]
        : []),
    ],
    yAxis: [
      { scale: true, gridIndex: 0, splitLine: { lineStyle: { color: 'rgba(148,163,184,0.08)' } }, axisLabel: { color: '#64748b', fontSize: 10 } },
      { scale: true, gridIndex: 1, splitNumber: 2, axisLabel: { show: false }, splitLine: { show: false } },
      ...(props.showMacd || props.showRsi
        ? [{ scale: true, gridIndex: 2, splitNumber: 2, axisLabel: { color: '#64748b', fontSize: 10 }, splitLine: { lineStyle: { color: 'rgba(148,163,184,0.06)' } } }]
        : []),
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1, 2].slice(0, grids.length), start: 60, end: 100 },
      { type: 'slider', xAxisIndex: [0, 1, 2].slice(0, grids.length), bottom: 4, height: 18, borderColor: 'transparent', backgroundColor: 'rgba(24,34,54,0.8)', fillerColor: 'rgba(45,212,168,0.2)', handleStyle: { color: '#2dd4a8' }, textStyle: { color: '#64748b' } },
    ],
    series: [
      {
        name: 'K线',
        type: 'candlestick',
        data: ohlc,
        xAxisIndex: 0,
        yAxisIndex: 0,
        itemStyle: { color: upColor, color0: downColor, borderColor: upColor, borderColor0: downColor },
      },
      ...(props.showMa && ind
        ? [
            { name: 'MA5', type: 'line' as const, data: ind.ma5, showSymbol: false, lineStyle: { width: 1, color: '#f5a524' }, xAxisIndex: 0, yAxisIndex: 0 },
            { name: 'MA10', type: 'line' as const, data: ind.ma10, showSymbol: false, lineStyle: { width: 1, color: '#38bdf8' }, xAxisIndex: 0, yAxisIndex: 0 },
            { name: 'MA20', type: 'line' as const, data: ind.ma20, showSymbol: false, lineStyle: { width: 1, color: '#a78bfa' }, xAxisIndex: 0, yAxisIndex: 0 },
            { name: 'MA60', type: 'line' as const, data: ind.ma60, showSymbol: false, lineStyle: { width: 1, color: '#fb7185' }, xAxisIndex: 0, yAxisIndex: 0 },
          ]
        : []),
      ...(props.showBoll && ind?.boll
        ? [
            { name: 'BOLL上', type: 'line' as const, data: ind.boll.upper, showSymbol: false, lineStyle: { width: 1, type: 'dashed' as const, color: '#94a3b8' }, xAxisIndex: 0, yAxisIndex: 0 },
            { name: 'BOLL中', type: 'line' as const, data: ind.boll.mid, showSymbol: false, lineStyle: { width: 1, color: '#64748b' }, xAxisIndex: 0, yAxisIndex: 0 },
            { name: 'BOLL下', type: 'line' as const, data: ind.boll.lower, showSymbol: false, lineStyle: { width: 1, type: 'dashed' as const, color: '#94a3b8' }, xAxisIndex: 0, yAxisIndex: 0 },
          ]
        : []),
      {
        name: '成交量',
        type: 'bar',
        data: volumes.map((v, i) => ({
          value: v,
          itemStyle: { color: data[i].close >= data[i].open ? upColor : downColor, opacity: 0.55 },
        })),
        xAxisIndex: 1,
        yAxisIndex: 1,
      },
      ...(props.showMacd && ind?.macd
        ? [
            {
              name: 'MACD',
              type: 'bar' as const,
              data: ind.macd.macd.map((v) => ({
                value: v,
                itemStyle: { color: v >= 0 ? upColor : downColor, opacity: 0.7 },
              })),
              xAxisIndex: 2,
              yAxisIndex: 2,
            },
            { name: 'DIF', type: 'line' as const, data: ind.macd.dif, showSymbol: false, lineStyle: { width: 1, color: '#f5a524' }, xAxisIndex: 2, yAxisIndex: 2 },
            { name: 'DEA', type: 'line' as const, data: ind.macd.dea, showSymbol: false, lineStyle: { width: 1, color: '#38bdf8' }, xAxisIndex: 2, yAxisIndex: 2 },
          ]
        : []),
      ...(props.showRsi && !props.showMacd && ind?.rsi
        ? [
            { name: 'RSI', type: 'line' as const, data: ind.rsi, showSymbol: false, lineStyle: { width: 1.5, color: '#2dd4a8' }, xAxisIndex: 2, yAxisIndex: 2, markLine: { silent: true, symbol: 'none', lineStyle: { type: 'dashed' as const, color: '#64748b' }, data: [{ yAxis: 70 }, { yAxis: 30 }] } },
          ]
        : []),
    ],
  }

  chart.setOption(option, true)
}

function onResize() {
  chart?.resize()
}

watch(() => [props.quotes, props.period, props.showMa, props.showMacd, props.showRsi, props.showBoll], render, { deep: true })

onMounted(() => {
  render()
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div ref="chartRef" class="kline-chart" />
</template>

<style scoped>
.kline-chart {
  width: 100%;
  height: 420px;
}
@media (max-width: 767px) {
  .kline-chart {
    height: 360px;
  }
}
</style>
