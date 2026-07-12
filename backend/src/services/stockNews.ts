import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { Market } from './marketData.js'

const execFileAsync = promisify(execFile)

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

export interface StockNewsItem {
  id: string
  title: string
  summary: string
  url: string
  published_at: string
  source: string
  type: 'news' | 'announcement'
}

function marketPrefix(code: string, market?: Market): string {
  const m = market || (code.startsWith('6') ? 'SH' : code.startsWith('8') || code.startsWith('4') ? 'BJ' : 'SZ')
  return `${m}${code}`
}

function stripHtml(text: string): string {
  return text.replace(/<\/?em>/gi, '').replace(/<[^>]+>/g, '').trim()
}

function toIsoFromMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return new Date().toISOString()
  return new Date(ms).toISOString()
}

function parseDisplayTime(raw: string): string {
  // e.g. 2026-06-21 15:31:10:656
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/)
  if (m) return new Date(`${m[1]}T${m[2]}+08:00`).toISOString()
  const d = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (d) return new Date(`${d[1]}T00:00:00+08:00`).toISOString()
  return new Date().toISOString()
}

async function curlJson(url: string, referer: string): Promise<unknown> {
  const { stdout } = await execFileAsync(
    'curl',
    [
      '-sS',
      '--max-time',
      '20',
      '-L',
      '-H',
      `User-Agent: ${UA}`,
      '-H',
      `Referer: ${referer}`,
      '-H',
      'Accept: application/json, text/plain, */*',
      url,
    ],
    { maxBuffer: 8 * 1024 * 1024 },
  )
  if (!stdout?.trim()) throw new Error('empty response')
  return JSON.parse(stdout)
}

async function fetchJsonpSearch(keyword: string, pageSize: number): Promise<StockNewsItem[]> {
  const param = {
    uid: '',
    keyword,
    type: ['cmsArticleWebOld'],
    client: 'web',
    clientType: 'web',
    clientVersion: 'curr',
    param: {
      cmsArticleWebOld: {
        searchScope: 'default',
        sort: 'default',
        pageIndex: 1,
        pageSize,
        preTag: '',
        postTag: '',
      },
    },
  }
  const url =
    'https://search-api-web.eastmoney.com/search/jsonp?cb=cb&param=' +
    encodeURIComponent(JSON.stringify(param))

  const { stdout } = await execFileAsync(
    'curl',
    [
      '-sS',
      '--max-time',
      '20',
      '-H',
      `User-Agent: ${UA}`,
      '-H',
      'Referer: https://so.eastmoney.com/',
      url,
    ],
    { maxBuffer: 8 * 1024 * 1024 },
  )
  const match = stdout.match(/^cb\(([\s\S]*)\)\s*$/)
  if (!match) return []
  const json = JSON.parse(match[1]) as {
    result?: {
      cmsArticleWebOld?: Array<{
        code?: string
        title?: string
        content?: string
        date?: string
        mediaName?: string
        url?: string
      }>
    }
  }

  return (json.result?.cmsArticleWebOld || []).map((row) => ({
    id: String(row.code || row.url || row.title),
    title: stripHtml(String(row.title || '')),
    summary: stripHtml(String(row.content || '')).slice(0, 160),
    url: String(row.url || '').replace(/^http:/, 'https:'),
    published_at: row.date ? new Date(row.date.replace(' ', 'T') + '+08:00').toISOString() : new Date().toISOString(),
    source: String(row.mediaName || '东方财富'),
    type: 'news' as const,
  }))
}

interface BulletinResponse {
  gszx?: {
    data?: {
      items?: Array<{
        code?: string
        title?: string
        summary?: string
        url?: string
        uniqueUrl?: string
        showDateTime?: number
        source?: string | null
      }>
    }
  }
  gsgg?: Array<{
    art_code?: string
    title?: string
    display_time?: string
    notice_date?: string
  }>
}

/** 东方财富 F10 资讯 + 公告，必要时用名称搜索补充 */
export async function fetchStockNews(
  code: string,
  opts?: { market?: Market; name?: string; limit?: number },
): Promise<StockNewsItem[]> {
  const limit = Math.min(Math.max(opts?.limit || 15, 5), 30)
  const emCode = marketPrefix(code, opts?.market)
  const url = `https://emweb.securities.eastmoney.com/PC_HSF10/NewsBulletin/PageAjax?code=${emCode}`

  let bulletin: BulletinResponse = {}
  try {
    bulletin = (await curlJson(url, 'https://emweb.securities.eastmoney.com/')) as BulletinResponse
  } catch {
    bulletin = {}
  }

  const news: StockNewsItem[] = (bulletin.gszx?.data?.items || [])
    .filter((row) => row.title)
    .map((row) => ({
      id: String(row.code || row.uniqueUrl || row.url),
      title: stripHtml(String(row.title)),
      summary: stripHtml(String(row.summary || '')).slice(0, 160),
      url: String(row.uniqueUrl || row.url || '').replace(/^http:/, 'https:'),
      published_at: toIsoFromMs(Number(row.showDateTime || 0)),
      source: String(row.source || '东方财富'),
      type: 'news' as const,
    }))

  const announcements: StockNewsItem[] = (bulletin.gsgg || [])
    .filter((row) => row.title && row.art_code)
    .map((row) => ({
      id: String(row.art_code),
      title: stripHtml(String(row.title)),
      summary: '',
      url: `https://data.eastmoney.com/notices/detail/${code}/${row.art_code}.html`,
      published_at: parseDisplayTime(String(row.display_time || row.notice_date || '')),
      source: '公司公告',
      type: 'announcement' as const,
    }))

  let searched: StockNewsItem[] = []
  if (opts?.name) {
    try {
      searched = await fetchJsonpSearch(opts.name, Math.min(limit, 10))
    } catch {
      searched = []
    }
  }

  const merged = [...news, ...searched, ...announcements]
  const seen = new Set<string>()
  const deduped: StockNewsItem[] = []
  for (const item of merged) {
    if (!item.title || !item.url) continue
    const key = item.url || item.id
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(item)
  }

  deduped.sort((a, b) => +new Date(b.published_at) - +new Date(a.published_at))
  return deduped.slice(0, limit)
}
