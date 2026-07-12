import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let adminClient: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes('your-project')) {
    throw new Error('Supabase 未配置，请设置环境变量或启用 DEMO_MODE=true')
  }
  adminClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return adminClient
}

export function getSupabaseAnon(): SupabaseClient {
  const url = process.env.SUPABASE_URL!
  const key = process.env.SUPABASE_ANON_KEY!
  return createClient(url, key)
}
