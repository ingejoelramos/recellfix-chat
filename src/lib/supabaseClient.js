import { createClient } from '@supabase/supabase-js'

const STORAGE_KEY = 'recellfix_supabase_config'
const FORCE_SETUP_KEY = 'recellfix_force_setup'

// Proyecto Supabase de RecellFix (recellfix-agent). La anon key es pública por diseño
// -- la seguridad real la dan las políticas RLS del proyecto -- así que es seguro
// dejarla como valor por defecto para que el panel arranque directo en el login.
const DEFAULT_URL = 'https://nraojaytexeayivtjbhr.supabase.co'
const DEFAULT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yYW9qYXl0ZXhlYXlpdnRqYmhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NTM0OTMsImV4cCI6MjEwNDAyOTQ5M30.L-NUEVU4vDvuz3F0ZMjBAA0qMwHdAz88AKAuhfWnUgA'

// Config explícita que el usuario guardó a mano (si la hay).
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

// true cuando el usuario pidió explícitamente cambiar de proyecto (botón
// "Cambiar proyecto de Supabase") y todavía no ha guardado uno nuevo.
export function shouldForceSetup() {
  return localStorage.getItem(FORCE_SETUP_KEY) === '1'
}

export function saveConfig(url, anonKey) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ url, anonKey }))
  localStorage.removeItem(FORCE_SETUP_KEY)
}

export function clearConfig() {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.setItem(FORCE_SETUP_KEY, '1')
}

// Config que realmente se usa para conectar: lo guardado explícitamente,
// o el proyecto de RecellFix por defecto, salvo que el usuario haya pedido
// configurar uno distinto.
export function getEffectiveConfig() {
  if (shouldForceSetup()) return null
  return getStoredConfig() || { url: DEFAULT_URL, anonKey: DEFAULT_ANON_KEY }
}

let cachedClient = null
let cachedKey = null

export function getSupabaseClient() {
  const config = getEffectiveConfig()
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
