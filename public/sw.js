// Service worker para notificaciones push (RecellFix Agent).
// No cachea nada de la app -- Vercel ya sirve todo por HTTPS con su propio CDN --
// su único trabajo es escuchar eventos push y mostrar la notificación del sistema.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'RecellFix Agent', body: event.data ? event.data.text() : '' }
  }

  const title = data.title || 'Nuevo mensaje'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'recellfix-mensaje',
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => c.url.includes(self.location.origin))
      if (existing) {
        existing.focus()
        return
      }
      self.clients.openWindow(url)
    })
  )
})
