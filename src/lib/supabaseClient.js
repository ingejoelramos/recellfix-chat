import { createClient } from '@supabase/supabase-js'

const STORAGE_KEY = 'recellfix_supabase_config'

export function getStoredConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed.url || !parsed.anonKey) return null
    return parsed
  } catch {
    return null
  }
}

export function saveConfig(url, anonKey) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ url, anonKey }))
}

export function clearConfig() {
  localStorage.removeItem(STORAGE_KEY)
}

let cachedClient = null
let cachedKey = null

export function getSupabaseClient() {
  const config = getStoredConfig()
  if (!config) return null

  const cacheKey = config.url + config.anonKey
  if (cachedClient && cachedKey === cacheKey) return cachedClient

  cachedClient = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  })
  cachedKey = cacheKey
  return cachedClient
}
