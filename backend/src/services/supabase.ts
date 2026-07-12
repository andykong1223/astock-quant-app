import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let adminClient: SupabaseClient | null = null
let anonClient: SupabaseClient | null = null

function requireUrl() {
  const url = process.env.SUPABASE_URL
  if (!url || url.includes('your-project')) {
    throw new Error('Supabase 未配置：缺少 SUPABASE_URL')
  }
  return url
}

/** secret / service_role：后端管理权限，绕过 RLS */
function requireSecretKey() {
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key || key.includes('your-')) {
    throw new Error('Supabase 未配置：缺少 SUPABASE_SECRET_KEY')
  }
  return key
}

/** publishable / anon：对外只读权限 */
function requirePublishableKey() {
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY
  if (!key || key.includes('your-')) {
    throw new Error('Supabase 未配置：缺少 SUPABASE_PUBLISHABLE_KEY')
  }
  return key
}

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient
  adminClient = createClient(requireUrl(), requireSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return adminClient
}

export function getSupabaseAnon(): SupabaseClient {
  if (anonClient) return anonClient
  anonClient = createClient(requireUrl(), requirePublishableKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return anonClient
}
