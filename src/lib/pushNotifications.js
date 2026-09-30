// Llave pública VAPID (la privada vive solo en el backend / Vercel, nunca aquí).
const VAPID_PUBLIC_KEY =
  'BM0RrDkATOKd0DOAKGERGr9faoSJGvFLVSH8vphpeJbmo30LlPm81B1KKEtaJdZjWWw_bosor7zrts2C3lHLDGA'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function getPushPermission() {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission // 'default' | 'granted' | 'denied'
}

async function registerServiceWorker() {
  return navigator.serviceWorker.register('/sw.js')
}

export async function enablePush(supabase) {
  if (!isPushSupported()) {
    throw new Error('Este navegador no soporta notificaciones push.')
  }

  const registration = await registerServiceWorker()
  await navigator.serviceWorker.ready

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('No se concedió el permiso de notificaciones.')
  }

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  const json = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      endpoint: json.endpoint,
      keys: json.keys,
      user_agent: navigator.userAgent,
    },
    { onConflict: 'endpoint' }
  )
  if (error) throw error

  return subscription
}

export async function disablePush(supabase) {
  if (!isPushSupported()) return
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) return
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return

  const endpoint = subscription.endpoint
  await subscription.unsubscribe()
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
}

export async function isPushEnabled() {
  if (!isPushSupported()) return false
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) return false
  const subscription = await registration.pushManager.getSubscription()
  return !!subscription
}
