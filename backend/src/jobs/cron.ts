import cron from 'node-cron'
import { getRealtimeQuotes, stocks } from '../services/demoData.js'

export function startCronJobs() {
  // 默认每天 15:30（5 段：分 时 日 月 周）
  const expr = process.env.CRON_UPDATE_QUOTES || '30 15 * * *'
  const schedule = expr.split(' ').length === 6 ? expr.split(' ').slice(1).join(' ') : expr

  if (!cron.validate(schedule)) {
    console.warn('[Cron] Invalid expression, skipping:', schedule)
    return
  }

  try {
    cron.schedule(schedule, () => {
      console.log(`[Cron] Updating quotes at ${new Date().toISOString()}`)
      if (process.env.DEMO_MODE === 'true') {
        const quotes = getRealtimeQuotes()
        console.log(`[Cron] Demo refresh: ${quotes.length} stocks / ${stocks.length} total`)
        return
      }
      console.log('[Cron] Production quote update placeholder — wire DATA_API here')
    })
    console.log(`[Cron] Scheduled quote update: ${schedule}`)
  } catch (err) {
    console.warn('[Cron] Failed to schedule:', err)
  }
}
