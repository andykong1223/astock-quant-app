import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { authRouter } from './routes/auth.js'
import { stocksRouter } from './routes/stocks.js'
import { watchlistRouter } from './routes/watchlist.js'
import { quantRouter } from './routes/quant.js'
import { strategiesRouter } from './routes/strategies.js'
import { syncRouter } from './routes/sync.js'
import { fundFlowRouter } from './routes/fundFlow.js'
import { errorHandler } from './middleware/errorHandler.js'
import { startCronJobs } from './jobs/cron.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const app = express()
const PORT = Number(process.env.PORT) || 3000

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { code: 429, message: '请求过于频繁，请稍后再试', data: null },
  }),
)

app.get('/health', (_req, res) => {
  res.json({ code: 0, message: 'ok', data: { status: 'healthy', demo: process.env.DEMO_MODE === 'true' } })
})

app.use('/api/v1/auth', authRouter)
app.use('/api/v1/stocks', stocksRouter)
app.use('/api/v1/watchlist', watchlistRouter)
app.use('/api/v1/quant', quantRouter)
app.use('/api/v1/strategies', strategiesRouter)
app.use('/api/v1/sync', syncRouter)
app.use('/api/v1/fund-flow', fundFlowRouter)

app.use(errorHandler)

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[AStock Quant] API listening on http://0.0.0.0:${PORT}`)
  console.log(`[AStock Quant] Demo mode: ${process.env.DEMO_MODE === 'true'}`)
  startCronJobs()
})
