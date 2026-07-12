/**
 * Apply schema + seed stock master/realtime, then generate daily quotes & financials.
 * Usage: npm run db:setup --workspace=backend
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

function mustEnv(name: string, value: string | undefined): string {
  if (!value) {
    console.error(`[db] Missing ${name} in backend/.env`)
    process.exit(1)
  }
  return value
}

const supabaseUrl = mustEnv('SUPABASE_URL', process.env.SUPABASE_URL)
const supabaseSecret = mustEnv(
  'SUPABASE_SECRET_KEY',
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
)
const dbUrl = mustEnv('DATABASE_URL', process.env.DATABASE_URL)

async function runSqlFiles(client: pg.Client) {
  const root = path.resolve(__dirname, '../../../supabase')
  for (const file of ['schema.sql', 'seed.sql']) {
    const sql = fs.readFileSync(path.join(root, file), 'utf8')
    console.log(`[db] applying ${file}...`)
    await client.query(sql)
    console.log(`[db] ${file} ok`)
  }
}

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function generateDaily(code: string, base: number, days = 250) {
  const rand = seededRandom(code.split('').reduce((a, c) => a + c.charCodeAt(0), 0))
  let price = base
  const quotes = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    if (d.getDay() === 0 || d.getDay() === 6) continue
    const changePct = (rand() - 0.48) * 0.04
    const open = +(price * (1 + (rand() - 0.5) * 0.01)).toFixed(3)
    const close = +(open * (1 + changePct)).toFixed(3)
    const high = +Math.max(open, close, open * (1 + rand() * 0.015)).toFixed(3)
    const low = +Math.min(open, close, open * (1 - rand() * 0.015)).toFixed(3)
    const volume = Math.floor(5_000_000 + rand() * 50_000_000)
    quotes.push({
      stock_code: code,
      trade_date: d.toISOString().slice(0, 10),
      open,
      high,
      low,
      close,
      volume,
      amount: +(volume * close).toFixed(2),
      turnover: +(0.5 + rand() * 3).toFixed(4),
    })
    price = close
  }
  return quotes
}

const BASE: Record<string, number> = {
  '000001': 11.34,
  '000002': 8.88,
  '600000': 9.18,
  '600519': 1665.5,
  '000858': 144.1,
  '601318': 47.8,
  '300750': 193.3,
  '002594': 269.2,
  '600036': 35.1,
  '601012': 19.1,
  '000063': 28.3,
  '002415': 32.4,
  '600276': 44.6,
  '300059': 21.4,
  '688981': 53.2,
}

async function seedQuotes() {
  const supabase = createClient(supabaseUrl, supabaseSecret, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: stockList, error } = await supabase.from('stocks').select('code')
  if (error) throw error
  const codes = (stockList || []).map((s) => s.code)
  console.log(`[db] seeding daily quotes for ${codes.length} stocks...`)

  for (const code of codes) {
    const quotes = generateDaily(code, BASE[code] || 20)
    // upsert in chunks
    for (let i = 0; i < quotes.length; i += 100) {
      const chunk = quotes.slice(i, i + 100)
      const { error: upErr } = await supabase.from('daily_quotes').upsert(chunk, {
        onConflict: 'stock_code,trade_date',
      })
      if (upErr) throw upErr
    }

    const last = quotes[quotes.length - 1]
    const prev = quotes[quotes.length - 2] || last
    const change = +(last.close - prev.close).toFixed(3)
    await supabase.from('realtime_quotes').upsert({
      stock_code: code,
      price: last.close,
      change,
      change_percent: +((change / prev.close) * 100).toFixed(4),
      volume: last.volume,
      amount: last.amount,
      high: last.high,
      low: last.low,
      open: last.open,
      pre_close: prev.close,
      updated_at: new Date().toISOString(),
    })

    const base = BASE[code] || 20
    await supabase.from('financial_metrics').upsert(
      [
        {
          stock_code: code,
          report_date: '2024-12-31',
          report_type: 'YEAR',
          revenue: +(base * 1e8 * 1.2).toFixed(4),
          net_profit: +(base * 1e7 * 0.8).toFixed(4),
          eps: +(0.8 + (base % 7)).toFixed(4),
          roe: +(12 + (base % 10)).toFixed(4),
          pe_ttm: +(15 + (base % 20)).toFixed(4),
          pb: +(2 + (base % 5)).toFixed(4),
          gross_margin: +(30 + (base % 20)).toFixed(4),
          net_margin: +(10 + (base % 15)).toFixed(4),
        },
        {
          stock_code: code,
          report_date: '2025-03-31',
          report_type: 'Q1',
          revenue: +(base * 3e7 * 1.1).toFixed(4),
          net_profit: +(base * 3e6 * 0.7).toFixed(4),
          eps: +(0.2 + (base % 3) * 0.1).toFixed(4),
          roe: +(3 + (base % 5)).toFixed(4),
          pe_ttm: +(15 + (base % 20)).toFixed(4),
          pb: +(2 + (base % 5)).toFixed(4),
          gross_margin: +(30 + (base % 20)).toFixed(4),
          net_margin: +(10 + (base % 15)).toFixed(4),
        },
      ],
      { onConflict: 'stock_code,report_date' },
    )
    console.log(`[db] ${code} quotes=${quotes.length}`)
  }
}

async function main() {
  console.log('[db] connecting', dbUrl.replace(/:[^:@/]+@/, ':***@'))

  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  try {
    await runSqlFiles(client)
  } finally {
    await client.end()
  }

  await seedQuotes()
  console.log('[db] setup complete')
}

main().catch((err) => {
  console.error('[db] failed:', err)
  process.exit(1)
})
