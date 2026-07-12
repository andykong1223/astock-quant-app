/**
 * CLI: 全量同步 A 股列表与实时行情
 * npm run sync:market --workspace=backend
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { syncStockUniverse } from '../services/syncMarket.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

async function main() {
  console.log('[sync] start universe sync…')
  const result = await syncStockUniverse((msg) => console.log('[sync]', msg))
  console.log('[sync] done', result)
}

main().catch((err) => {
  console.error('[sync] failed', err)
  process.exit(1)
})
