import cron from 'node-cron'
import { getRealtimeQuotes, stocks } from '../services/demoData.js'
import { syncStockUniverse, syncAllRealtimeFromDb } from '../services/syncMarket.js'
import { isDemo } from '../services/quotes.js'

export function startCronJobs() {
  const quoteExpr = process.env.CRON_UPDATE_QUOTES || '30 15 * * 1-5'
  const listExpr = process.env.CRON_SYNC_LIST || '0 9 * * 1-5'
  const rtExpr = process.env.CRON_SYNC_REALTIME || '*/5 9-14 * * 1-5'

  const normalize = (expr: string) =>
    expr.split(' ').length === 6 ? expr.split(' ').slice(1).join(' ') : expr

  const scheduleQuote = normalize(quoteExpr)
  const scheduleList = normalize(listExpr)
  const scheduleRt = normalize(rtExpr)

  if (cron.validate(scheduleQuote)) {
    cron.schedule(scheduleQuote, async () => {
      console.log(`[Cron] Daily quote sync ${new Date().toISOString()}`)
      if (isDemo()) {
        console.log(`[Cron] Demo refresh: ${getRealtimeQuotes().length}/${stocks.length}`)
        return
      }
      try {
        const r = await syncAllRealtimeFromDb(2000)
        console.log('[Cron] realtime refreshed', r)
      } catch (e) {
        console.error('[Cron] quote sync failed', e)
      }
    })
    console.log(`[Cron] Quote update: ${scheduleQuote}`)
  }

  if (cron.validate(scheduleList)) {
    cron.schedule(scheduleList, async () => {
      if (isDemo()) return
      console.log(`[Cron] Universe sync ${new Date().toISOString()}`)
      try {
        const r = await syncStockUniverse((m) => console.log('[Cron]', m))
        console.log('[Cron] universe done', r)
      } catch (e) {
        console.error('[Cron] universe failed', e)
      }
    })
    console.log(`[Cron] Stock list sync: ${scheduleList}`)
  }

  if (cron.validate(scheduleRt)) {
    cron.schedule(scheduleRt, async () => {
      if (isDemo()) return
      try {
        const r = await syncAllRealtimeFromDb(500)
        console.log('[Cron] intraday realtime', r)
      } catch (e) {
        console.warn('[Cron] intraday realtime failed', (e as Error).message)
      }
    })
    console.log(`[Cron] Intraday realtime: ${scheduleRt}`)
  }
}
