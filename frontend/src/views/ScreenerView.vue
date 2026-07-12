<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  NSelect,
  NInputNumber,
  NButton,
  NTag,
  NEmpty,
  NSpin,
  useMessage,
} from 'naive-ui'
import { quantApi } from '@/api'
import PriceChange from '@/components/PriceChange.vue'

const router = useRouter()
const message = useMessage()
const loading = ref(false)
const results = ref<any[]>([])
const hint = ref('')

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
  hint.value = ''
  try {
    results.value = (await quantApi.screener({
      indicator: indicator.value,
      op: op.value,
      value: value.value ?? 0,
    })) as any[]
    if (!results.value.length) {
      hint.value =
        indicator.value === 'change_percent'
          ? '当前没有符合条件的股票'
          : '暂无足够日线数据用于指标筛选，可先打开几只个股详情预热日线，或改用「涨跌幅」筛选'
    }
  } catch (e) {
    results.value = []
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
    <p class="sub">按技术指标或涨跌幅筛选标的</p>

    <div class="filters fade-up">
      <NSelect
        v-model:value="indicator"
        class="filter-item filter-indicator"
        size="medium"
        :options="indicatorOptions"
        :consistent-menu-width="false"
      />
      <NSelect
        v-model:value="op"
        class="filter-item filter-op"
        size="medium"
        :options="opOptions"
      />
      <NInputNumber
        v-model:value="value"
        class="filter-item filter-value"
        size="medium"
        :show-button="false"
        placeholder="阈值"
      />
      <NButton class="filter-btn" type="primary" size="medium" :loading="loading" @click="run">
        筛选
      </NButton>
    </div>

    <div class="panel fade-up">
      <div class="count">
        <span>共 {{ results.length }} 只</span>
        <NSpin v-if="loading" :size="16" />
      </div>

      <div v-if="loading && !results.length" class="loading-box">
        <NSpin size="small" />
        <span>筛选计算中…</span>
      </div>
      <NEmpty v-else-if="!results.length" :description="hint || '暂无结果'" />

      <button
        v-for="r in results"
        :key="r.code"
        type="button"
        class="row"
        @click="router.push(`/stock/${r.code}`)"
      >
        <div>
          <div class="name">{{ r.name }}</div>
          <div class="code mono">{{ r.code }} · {{ r.sector || r.market || '-' }}</div>
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
.title {
  font-size: 24px;
  font-weight: 700;
}
.sub {
  color: var(--text-secondary);
  margin: 4px 0 16px;
  font-size: 14px;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.filter-item {
  height: 40px;
}

.filter-indicator {
  width: 160px;
  flex: 0 0 160px;
}

.filter-op {
  width: 110px;
  flex: 0 0 110px;
}

.filter-value {
  width: 120px;
  flex: 0 0 120px;
}

.filter-btn {
  height: 40px;
  min-width: 88px;
  padding: 0 18px;
}

:deep(.filter-item .n-base-selection),
:deep(.filter-item .n-input),
:deep(.filter-item.n-input-number) {
  height: 40px !important;
}

:deep(.filter-item .n-base-selection-label),
:deep(.filter-item .n-input__input-el) {
  height: 40px !important;
  line-height: 40px !important;
}

.panel {
  background: rgba(18, 26, 43, 0.7);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  min-height: 200px;
}

.count {
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
  padding: 40px 16px;
  color: var(--text-secondary);
  font-size: 13px;
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

  &:hover {
    background: var(--bg-soft);
  }
}

.name {
  font-weight: 600;
}
.code {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}
.right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}
</style>
