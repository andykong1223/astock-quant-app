import type { StockNewsItem } from '@/types'
import type { SignalBias } from './signalAnalysis'

export interface NewsHit {
  word: string
  weight: number
}

export interface ScoredNewsItem {
  id: string
  title: string
  type: StockNewsItem['type']
  bias: SignalBias
  score: number
  hits: string[]
  published_at: string
}

export interface NewsSentimentResult {
  score: number
  bias: SignalBias
  label: string
  summary: string
  bullishCount: number
  bearishCount: number
  neutralCount: number
  items: ScoredNewsItem[]
  highlights: ScoredNewsItem[]
}

/** 利多关键词（标题/摘要命中加权） */
const BULLISH: Array<[string, number]> = [
  ['超预期', 1.2],
  ['大增', 1],
  ['增长', 0.6],
  ['上涨', 0.7],
  ['涨停', 1.2],
  ['突破', 0.8],
  ['创新高', 1],
  ['回购', 1.2],
  ['增持', 1.2],
  ['加仓', 0.9],
  ['买入', 0.8],
  ['看好', 0.8],
  ['利好', 1],
  ['提振', 0.7],
  ['复苏', 0.7],
  ['景气', 0.7],
  ['订单', 0.6],
  ['中标', 0.9],
  ['签约', 0.6],
  ['扩产', 0.7],
  ['分红', 0.5],
  ['高分红', 0.8],
  ['扭亏', 1],
  ['盈利', 0.5],
  ['业绩预增', 1.3],
  ['预增', 1.1],
  ['上调', 0.7],
  ['获批', 0.8],
  ['通过', 0.4],
  ['合作', 0.4],
  ['重组', 0.5],
  ['注入', 0.6],
  ['反弹', 0.6],
  ['走强', 0.7],
  ['活跃', 0.4],
]

/** 利空关键词 */
const BEARISH: Array<[string, number]> = [
  ['下滑', 0.8],
  ['下降', 0.7],
  ['下跌', 0.7],
  ['跌停', 1.2],
  ['亏损', 1],
  ['预减', 1.1],
  ['业绩预减', 1.3],
  ['不及预期', 1.2],
  ['减持', 1.2],
  ['抛售', 1],
  ['卖出', 0.7],
  ['利空', 1],
  ['风险', 0.5],
  ['警示', 0.8],
  ['处罚', 1.1],
  ['立案', 1.3],
  ['调查', 1],
  ['违规', 1],
  ['造假', 1.4],
  ['暴雷', 1.4],
  ['爆雷', 1.4],
  ['退市', 1.5],
  ['摘牌', 1.3],
  ['停牌', 0.6],
  ['质押', 0.5],
  ['爆仓', 1.2],
  ['下调', 0.8],
  ['砍单', 1],
  ['取消', 0.5],
  ['推迟', 0.5],
  ['延期', 0.4],
  ['疲软', 0.7],
  ['走弱', 0.7],
  ['承压', 0.6],
  ['低迷', 0.7],
  ['亏损扩大', 1.2],
  ['商誉减值', 1.1],
  ['诉讼', 0.8],
  ['冻结', 0.9],
]

function recencyWeight(iso: string): number {
  const t = +new Date(iso)
  if (!Number.isFinite(t)) return 0.6
  const days = (Date.now() - t) / (24 * 3600 * 1000)
  if (days <= 2) return 1.2
  if (days <= 7) return 1
  if (days <= 14) return 0.75
  if (days <= 30) return 0.5
  return 0.3
}

function scoreText(text: string): { score: number; hits: string[] } {
  let score = 0
  const hits: string[] = []
  for (const [word, w] of BULLISH) {
    if (text.includes(word)) {
      score += w
      hits.push(word)
    }
  }
  for (const [word, w] of BEARISH) {
    if (text.includes(word)) {
      score -= w
      hits.push(word)
    }
  }
  return { score, hits }
}

function biasFromScore(score: number): SignalBias {
  if (score >= 0.6) return 'bullish'
  if (score <= -0.6) return 'bearish'
  return 'neutral'
}

function labelFromBias(bias: SignalBias, score: number): string {
  if (bias === 'bullish') return score >= 2 ? '舆情偏多' : '舆情略偏多'
  if (bias === 'bearish') return score <= -2 ? '舆情偏空' : '舆情略偏空'
  return '舆情中性'
}

/**
 * 基于标题/摘要关键词的简易舆情评分（非 NLP 模型，可解释、可离线）
 */
export function analyzeNewsSentiment(news: StockNewsItem[]): NewsSentimentResult {
  const recent = [...news]
    .filter((n) => n.title)
    .sort((a, b) => +new Date(b.published_at) - +new Date(a.published_at))
    .slice(0, 12)

  const items: ScoredNewsItem[] = recent.map((n) => {
    const text = `${n.title} ${n.summary || ''}`
    const { score: raw, hits } = scoreText(text)
    // 公告权重略高（更贴近公司本身）
    const typeMul = n.type === 'announcement' ? 1.25 : 1
    const score = +(raw * typeMul * recencyWeight(n.published_at)).toFixed(2)
    return {
      id: n.id,
      title: n.title,
      type: n.type,
      bias: biasFromScore(score),
      score,
      hits: [...new Set(hits)].slice(0, 4),
      published_at: n.published_at,
    }
  })

  const score = items.length
    ? +items.reduce((s, x) => s + x.score, 0).toFixed(2)
    : 0
  // 归一到大致与技术分同量级：多条新闻累加后限制幅度
  const capped = Math.max(-3.5, Math.min(3.5, score * 0.45))
  const bias = biasFromScore(capped)
  const bullishCount = items.filter((x) => x.bias === 'bullish').length
  const bearishCount = items.filter((x) => x.bias === 'bearish').length
  const neutralCount = items.length - bullishCount - bearishCount

  const highlights = [...items]
    .filter((x) => Math.abs(x.score) >= 0.6)
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, 4)

  let summary: string
  if (!items.length) {
    summary = '暂无可用资讯，本次建议主要依据技术指标。'
  } else if (bias === 'bullish') {
    summary = `近 ${items.length} 条资讯中偏多 ${bullishCount} 条、偏空 ${bearishCount} 条，舆情整体偏积极。`
  } else if (bias === 'bearish') {
    summary = `近 ${items.length} 条资讯中偏空 ${bearishCount} 条、偏多 ${bullishCount} 条，舆情整体偏谨慎。`
  } else {
    summary = `近 ${items.length} 条资讯多空交织（多 ${bullishCount} / 空 ${bearishCount}），舆情方向不明确。`
  }

  return {
    score: +capped.toFixed(2),
    bias,
    label: labelFromBias(bias, capped),
    summary,
    bullishCount,
    bearishCount,
    neutralCount,
    items,
    highlights,
  }
}
