<script setup lang="ts">
import { computed } from 'vue'
import type { DailyQuote, StockNewsItem } from '@/types'
import { analyzeCombined } from '@/utils/combinedAdvice'
import type { ActionAdvice, SignalBias } from '@/utils/signalAnalysis'

const props = defineProps<{
  quotes: DailyQuote[]
  news?: StockNewsItem[]
  period?: 'day' | 'week' | 'month'
}>()

/** 建议统一按日K + 资讯计算，与自选列表一致 */
const analysis = computed(() =>
  analyzeCombined(
    props.quotes.map((q) => q.close),
    props.news || [],
  ),
)

function actionClass(action: ActionAdvice) {
  if (action === 'strong_buy' || action === 'buy') return 'buy'
  if (action === 'strong_sell' || action === 'sell') return 'sell'
  return 'hold'
}

function biasClass(bias: SignalBias) {
  if (bias === 'bullish') return 'bull'
  if (bias === 'bearish') return 'bear'
  return 'neu'
}

function biasText(bias: SignalBias) {
  if (bias === 'bullish') return '看多'
  if (bias === 'bearish') return '看空'
  return '中性'
}

function fmtSigned(n: number) {
  return `${n > 0 ? '+' : ''}${n}`
}
</script>

<template>
  <div class="signal-panel fade-up">
    <div class="signal-head">
      <h3 class="section-title">综合研判</h3>
      <span class="period-tag">日K + 资讯舆情</span>
    </div>

    <div v-if="!analysis" class="empty">日线数据不足，暂无法生成分析</div>

    <template v-else>
      <div class="verdict" :class="actionClass(analysis.action)">
        <div class="verdict-main">
          <div class="action">{{ analysis.actionLabel }}</div>
          <div class="score mono">综合 {{ fmtSigned(analysis.score) }}</div>
        </div>
        <p class="summary">{{ analysis.summary }}</p>
      </div>

      <div class="score-break">
        <div>
          <span>技术面</span>
          <b
            class="mono"
            :class="biasClass(analysis.techScore >= 0.5 ? 'bullish' : analysis.techScore <= -0.5 ? 'bearish' : 'neutral')"
          >
            {{ fmtSigned(analysis.techScore) }}
          </b>
        </div>
        <div>
          <span>资讯舆情</span>
          <b
            class="mono"
            :class="biasClass(analysis.newsScore >= 0.5 ? 'bullish' : analysis.newsScore <= -0.5 ? 'bearish' : 'neutral')"
          >
            {{ fmtSigned(analysis.newsScore) }}
          </b>
        </div>
        <div>
          <span>舆情结论</span>
          <b>{{ analysis.newsLabel }}</b>
        </div>
      </div>

      <div class="snap">
        <div v-if="analysis.snapshot.ma5 != null">
          <span>MA5</span><b class="mono">{{ analysis.snapshot.ma5.toFixed(2) }}</b>
        </div>
        <div v-if="analysis.snapshot.ma20 != null">
          <span>MA20</span><b class="mono">{{ analysis.snapshot.ma20.toFixed(2) }}</b>
        </div>
        <div v-if="analysis.snapshot.rsi != null">
          <span>RSI</span><b class="mono">{{ analysis.snapshot.rsi.toFixed(1) }}</b>
        </div>
        <div v-if="analysis.snapshot.macd != null">
          <span>MACD</span><b class="mono">{{ analysis.snapshot.macd.toFixed(3) }}</b>
        </div>
      </div>

      <section v-if="analysis.newsHighlights.length" class="sub-block">
        <h4 class="sub-title">舆情要点</h4>
        <ul class="signal-list">
          <li v-for="h in analysis.newsHighlights" :key="h.id" class="signal-item">
            <div class="sig-top">
              <span class="sig-name">{{ h.title }}</span>
              <span class="bias" :class="biasClass(h.bias)">{{ biasText(h.bias) }}</span>
            </div>
            <p class="sig-detail">
              {{ h.type === 'announcement' ? '公告' : '新闻' }}
              <template v-if="h.hits.length"> · 关键词 {{ h.hits.join('、') }}</template>
            </p>
          </li>
        </ul>
      </section>

      <section class="sub-block">
        <h4 class="sub-title">技术信号</h4>
        <ul class="signal-list">
          <li v-for="s in analysis.signals" :key="s.id" class="signal-item">
            <div class="sig-top">
              <span class="sig-name">{{ s.name }}</span>
              <span class="bias" :class="biasClass(s.bias)">{{ biasText(s.bias) }}</span>
            </div>
            <p class="sig-detail">{{ s.detail }}</p>
          </li>
        </ul>
      </section>

      <p class="disclaimer">
        建议收益为历史模拟，不含手续费/滑点；舆情不参与回放。仅供参考，不构成投资建议。
      </p>
    </template>
  </div>
</template>

<style scoped lang="scss">
.signal-panel {
  margin-bottom: 16px;
}

.signal-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.section-title {
  font-size: 16px;
  margin: 0;
}

.period-tag {
  font-size: 12px;
  color: var(--text-muted);
}

.empty {
  padding: 20px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.verdict {
  border-radius: var(--radius);
  border: 1px solid var(--border);
  padding: 14px 16px;
  margin-bottom: 10px;

  &.buy {
    background: color-mix(in srgb, var(--up) 12%, transparent);
    border-color: color-mix(in srgb, var(--up) 35%, transparent);
  }
  &.sell {
    background: color-mix(in srgb, var(--down) 12%, transparent);
    border-color: color-mix(in srgb, var(--down) 35%, transparent);
  }
  &.hold {
    background: var(--bg-elevated);
  }
}

.verdict-main {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.action {
  font-size: 20px;
  font-weight: 700;
}

.buy .action {
  color: var(--up);
}
.sell .action {
  color: var(--down);
}
.hold .action {
  color: var(--accent);
}

.score {
  font-size: 13px;
  color: var(--text-secondary);
}

.summary {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-secondary);
}

.score-break {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 10px;

  div {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  span {
    font-size: 11px;
    color: var(--text-muted);
  }
  b {
    font-size: 13px;
  }
  .bull {
    color: var(--up);
  }
  .bear {
    color: var(--down);
  }
  .neu {
    color: var(--text-secondary);
  }
}

.snap {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 10px;

  div {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  span {
    font-size: 11px;
    color: var(--text-muted);
  }
  b {
    font-size: 13px;
  }
}

.sub-block {
  margin-bottom: 12px;
}

.sub-title {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 600;
}

.signal-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  background: rgba(18, 26, 43, 0.6);
}

.signal-item {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);

  &:last-child {
    border-bottom: none;
  }
}

.sig-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 4px;
}

.sig-name {
  font-weight: 600;
  font-size: 14px;
  line-height: 1.4;
}

.bias {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 600;
  flex-shrink: 0;

  &.bull {
    color: var(--up);
    background: color-mix(in srgb, var(--up) 16%, transparent);
  }
  &.bear {
    color: var(--down);
    background: color-mix(in srgb, var(--down) 16%, transparent);
  }
  &.neu {
    color: var(--text-secondary);
    background: rgba(148, 163, 184, 0.12);
  }
}

.sig-detail {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.45;
}

.disclaimer {
  margin: 10px 0 0;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.4;
}

@media (max-width: 480px) {
  .snap,
  .score-break {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
