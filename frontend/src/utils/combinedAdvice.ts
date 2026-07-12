import type { StockNewsItem } from '@/types'
import {
  analyzeSignals,
  actionFromScore,
  ACTION_META,
  type SignalAnalysis,
  type SignalBias,
} from './signalAnalysis'
import { analyzeNewsSentiment } from './newsSentiment'

export interface CombinedAnalysis extends SignalAnalysis {
  techScore: number
  newsScore: number
  newsLabel: string
  newsSummary: string
  newsHighlights: Array<{
    id: string
    title: string
    bias: SignalBias
    score: number
    hits: string[]
    type: string
  }>
}

function fmtSigned(n: number) {
  return `${n > 0 ? '+' : ''}${n}`
}

/**
 * 技术指标 + 新闻舆情综合研判
 * 技术面权重约 65%，舆情约 35%
 */
export function analyzeCombined(
  closes: number[],
  news: StockNewsItem[] = [],
): CombinedAnalysis | null {
  const tech = analyzeSignals(closes)
  if (!tech) return null

  const newsResult = analyzeNewsSentiment(news)
  const techScore = tech.score
  const newsScore = newsResult.score
  const combined = +(techScore * 0.65 + newsScore * 0.35).toFixed(2)
  const action = actionFromScore(combined)

  const aligned =
    (techScore > 0.5 && newsScore > 0.3) || (techScore < -0.5 && newsScore < -0.3)
  const conflict =
    (techScore > 1 && newsScore < -0.8) || (techScore < -1 && newsScore > 0.8)

  let summary: string
  if (conflict) {
    summary = `技术面（${fmtSigned(techScore)}）与舆情（${fmtSigned(newsScore)}）方向不一致，建议降低仓位、观望确认。${newsResult.summary}`
  } else if (action === 'strong_buy' || action === 'buy') {
    summary = aligned
      ? `技术面与舆情共振偏多（技术 ${fmtSigned(techScore)} / 舆情 ${fmtSigned(newsScore)}），可关注买入或加仓机会。`
      : `综合偏多（技术 ${fmtSigned(techScore)} / 舆情 ${fmtSigned(newsScore)}）。${newsResult.summary}`
  } else if (action === 'strong_sell' || action === 'sell') {
    summary = aligned
      ? `技术面与舆情共振偏空（技术 ${fmtSigned(techScore)} / 舆情 ${fmtSigned(newsScore)}），宜谨慎，考虑减仓或回避。`
      : `综合偏空（技术 ${fmtSigned(techScore)} / 舆情 ${fmtSigned(newsScore)}）。${newsResult.summary}`
  } else {
    summary = `综合评分接近中性（技术 ${fmtSigned(techScore)} / 舆情 ${fmtSigned(newsScore)}），建议观望。${newsResult.summary}`
  }

  return {
    ...tech,
    action,
    actionLabel: ACTION_META[action].label,
    score: combined,
    summary,
    techScore,
    newsScore,
    newsLabel: newsResult.label,
    newsSummary: newsResult.summary,
    newsHighlights: newsResult.highlights.map((h) => ({
      id: h.id,
      title: h.title,
      bias: h.bias,
      score: h.score,
      hits: h.hits,
      type: h.type,
    })),
  }
}
