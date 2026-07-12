<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  NSelect,
  NInputNumber,
  NButton,
  NSpace,
  NTag,
  useMessage,
} from 'naive-ui'
import { quantApi } from '@/api'
import PriceChange from '@/components/PriceChange.vue'

const router = useRouter()
const message = useMessage()
const loading = ref(false)
const results = ref<any[]>([])

const indicator = ref('rsi')
const op = ref('gt')
const value = ref(70)

const indicatorOptions = [
  { label: 'RSI(14)', value: 'rsi' },
  { label: 'MA5-MA20 差值', value: 'ma_cross' },
  { label: '涨跌幅(%)', value: 'change_percent' },
]
const opOptions = [
  { label: '大于', value: 'gt' },
  { label: '小于', value: 'lt' },
  { label: '等于', value: 'eq' },
]

async function run() {
  loading.value = true
  try {
    results.value = (await quantApi.screener({
      indicator: indicator.value,
      op: op.value,
      value: value.value,
    })) as any[]
  } catch (e) {
    message.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

onMounted(run)
</script>

<template>
  <div class="page">
    <h1 class="title">条件选股</h1>
    <p class="sub">按技术指标筛选标的</p>

    <div class="filters fade-up">
      <NSelect v-model:value="indicator" :options="indicatorOptions" style="width: 140px" />
      <NSelect v-model:value="op" :options="opOptions" style="width: 100px" />
      <NInputNumber v-model:value="value" style="width: 100px" />
      <NButton type="primary" :loading="loading" @click="run">筛选</NButton>
    </div>

    <div class="panel fade-up">
      <div class="count">共 {{ results.length }} 只</div>
      <button
        v-for="r in results"
        :key="r.code"
        class="row"
        @click="router.push(`/stock/${r.code}`)"
      >
        <div>
          <div class="name">{{ r.name }}</div>
          <div class="code mono">{{ r.code }} · {{ r.sector }}</div>
        </div>
        <div class="right">
          <NTag size="small" :bordered="false" type="info">指标 {{ r.metric }}</NTag>
          <PriceChange v-if="r.quote" :value="r.quote.change_percent" suffix="%" />
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.title { font-size: 24px; font-weight: 700; }
.sub { color: var(--text-secondary); margin: 4px 0 16px; font-size: 14px; }
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.panel {
  background: rgba(18, 26, 43, 0.7);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}
.count {
  padding: 10px 14px;
  font-size: 12px;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
}
.row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px;
  min-height: 56px;
  border: none;
  border-bottom: 1px solid var(--border);
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
  &:hover { background: var(--bg-soft); }
}
.name { font-weight: 600; }
.code { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
</style>
