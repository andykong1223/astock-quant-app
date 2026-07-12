<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts'

const props = defineProps<{
  points: { time: string; price: number; volume: number; avg: number }[]
  preClose: number
}>()

const chartRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

function render() {
  if (!chartRef.value || !props.points.length) return
  if (!chart) chart = echarts.init(chartRef.value)

  const times = props.points.map((p) => p.time)
  const prices = props.points.map((p) => p.price)
  const avgs = props.points.map((p) => p.avg)
  const vols = props.points.map((p) => p.volume)
  const up = prices[prices.length - 1] >= props.preClose

  chart.setOption({
    animation: false,
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(18,26,43,0.95)', borderColor: 'rgba(148,163,184,0.2)', textStyle: { color: '#e8eef9' } },
    grid: [
      { left: 8, right: 12, top: 16, height: '58%' },
      { left: 8, right: 12, top: '78%', height: '14%' },
    ],
    xAxis: [
      { type: 'category', data: times, gridIndex: 0, axisLabel: { show: false }, axisLine: { lineStyle: { color: '#334155' } } },
      { type: 'category', data: times, gridIndex: 1, axisLabel: { color: '#64748b', fontSize: 10, interval: 40 }, axisLine: { lineStyle: { color: '#334155' } } },
    ],
    yAxis: [
      { scale: true, gridIndex: 0, splitLine: { lineStyle: { color: 'rgba(148,163,184,0.08)' } }, axisLabel: { color: '#64748b', fontSize: 10 } },
      { scale: true, gridIndex: 1, axisLabel: { show: false }, splitLine: { show: false } },
    ],
    series: [
      {
        type: 'line',
        data: prices,
        showSymbol: false,
        lineStyle: { width: 1.5, color: up ? '#ef4444' : '#22c55e' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: up ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)' },
            { offset: 1, color: 'transparent' },
          ]),
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { type: 'dashed', color: '#64748b' },
          data: [{ yAxis: props.preClose }],
          label: { formatter: '昨收', color: '#94a3b8', fontSize: 10 },
        },
        xAxisIndex: 0,
        yAxisIndex: 0,
      },
      { type: 'line', data: avgs, showSymbol: false, lineStyle: { width: 1, color: '#f5a524' }, xAxisIndex: 0, yAxisIndex: 0 },
      {
        type: 'bar',
        data: vols.map((v, i) => ({
          value: v,
          itemStyle: { color: prices[i] >= props.preClose ? '#ef4444' : '#22c55e', opacity: 0.5 },
        })),
        xAxisIndex: 1,
        yAxisIndex: 1,
      },
    ],
  }, true)
}

watch(() => props.points, render, { deep: true })
onMounted(() => {
  render()
  window.addEventListener('resize', () => chart?.resize())
})
onBeforeUnmount(() => chart?.dispose())
</script>

<template>
  <div ref="chartRef" class="intraday-chart" />
</template>

<style scoped>
.intraday-chart {
  width: 100%;
  height: 320px;
}
</style>
