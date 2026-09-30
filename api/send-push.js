// Vercel Serverless Function: envía notificaciones Web Push cuando llega
// un mensaje nuevo de un cliente. Se dispara vía un Database Webhook de
// Supabase configurado en la tabla `mensajes` (evento INSERT).
//
// Variables de entorno requeridas (configurar SOLO en Vercel, nunca en git):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   (clave sensible, bypassa RLS)
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY           (clave sensible)
//   PUSH_WEBHOOK_SECRET         (secreto compartido con el Database Webhook)

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
}

let vapidConfigured = false
function ensureVapid() {
  if (vapidConfigured) return
  webpush.setVapidDetails(
    'mailto:soporte@recellfix.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
  vapidConfigured = true
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // Autenticación: solo aceptar llamadas que traigan el secreto compartido.
  const secret = req.headers['x-push-secret']
  if (!process.env.PUSH_WEBHOOK_SECRET || secret !== process.env.PUSH_WEBHOOK_SECRET) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const body = req.body || {}
    // Supabase Database Webhooks envían { type, table, record, old_record }.
    const record = body.record || body

    if (!record || !record.conversacion_id) {
      res.status(400).json({ error: 'Missing record.conversacion_id' })
      return
    }

    // Solo notificar mensajes que vienen del cliente (no eco de humano/bot).
    if (record.remitente && record.remitente !== 'cliente') {
      res.status(200).json({ skipped: true, reason: 'not a client message' })
      return
    }

    ensureVapid()
    const supabase = getSupabaseAdmin()

    const { data: conversacion } = await supabase
      .from('conversaciones')
      .select('nombre_cliente, numero_whatsapp')
      .eq('id', record.conversacion_id)
      .maybeSingle()

    const title = conversacion?.nombre_cliente || conversacion?.numero_whatsapp || 'Nuevo mensaje'
    const bodyText = (record.contenido || '').slice(0, 180)

    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, keys')

    if (subsError) throw subsError
    if (!subscriptions || subscriptions.length === 0) {
      res.status(200).json({ sent: 0, reason: 'no subscriptions' })
      return
    }

    const payload = JSON.stringify({
      title,
      body: bodyText || 'Nuevo mensaje de WhatsApp',
      tag: `conversacion-${record.conversacion_id}`,
      url: '/',
    })

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload
        )
      )
    )

    const expiredEndpoints = []
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const statusCode = r.reason?.statusCode
        if (statusCode === 404 || statusCode === 410) {
          expiredEndpoints.push(subscriptions[i].endpoint)
        }
      }
    })

    if (expiredEndpoints.length > 0) {
      await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints)
    }

    const sent = results.filter((r) => r.status === 'fulfilled').length
    res.status(200).json({ sent, expiredRemoved: expiredEndpoints.length })
  } catch (err) {
    console.error('send-push error:', err)
    res.status(500).json({ error: err.message || 'Internal error' })
  }
}
