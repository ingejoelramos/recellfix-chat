import { useEffect, useRef, useState } from 'react'
import { getSupabaseClient } from '../lib/supabaseClient'
import { isUnread, markSeen } from '../lib/readTracking'
import { playNotificationSound } from '../lib/notificationSound'
import {
  isPushSupported,
  isPushEnabled,
  enablePush,
  disablePush,
} from '../lib/pushNotifications'

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) {
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  }
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

export default function ConversationList({ selectedId, onSelect }) {
  const [conversations, setConversations] = useState([])
  const [lastMessages, setLastMessages] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [unreadTick, setUnreadTick] = useState(0)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!isPushSupported()) return
    isPushEnabled().then(setPushEnabled)
  }, [])

  useEffect(() => {
    const supabase = getSupabaseClient()
    let active = true

    async function load() {
      const { data, error } = await supabase
        .from('conversaciones')
        .select('*')
        .order('actualizado_en', { ascending: false })
      if (active && !error) {
        setConversations(data || [])
      }
      setLoading(false)

      const { data: recentMessages } = await supabase
        .from('mensajes')
        .select('conversacion_id, contenido, remitente, creado_en')
        .order('creado_en', { ascending: false })
        .limit(300)
      if (active && recentMessages) {
        const map = {}
        for (const m of recentMessages) {
          if (!map[m.conversacion_id]) map[m.conversacion_id] = m
        }
        setLastMessages(map)
      }
    }
    load()

    const channel = supabase
      .channel('conversaciones-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversaciones' },
        (payload) => {
          setConversations((prev) => {
            if (payload.eventType === 'DELETE') {
              return prev.filter((c) => c.id !== payload.old.id)
            }
            const row = payload.new
            const exists = prev.some((c) => c.id === row.id)
            const next = exists
              ? prev.map((c) => (c.id === row.id ? row : c))
              : [row, ...prev]
            return next.sort(
              (a, b) => new Date(b.actualizado_en) - new Date(a.actualizado_en)
            )
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensajes' },
        (payload) => {
          setLastMessages((prev) => ({ ...prev, [payload.new.conversacion_id]: payload.new }))
          if (payload.new.remitente === 'cliente') {
            playNotificationSound()
          }
        }
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    if (!showMenu) return
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu])

  function handleMarkAllRead() {
    conversations.forEach((c) => markSeen(c.id))
    setUnreadTick((t) => t + 1)
    setShowMenu(false)
  }

  async function handleLogout() {
    setShowMenu(false)
    const supabase = getSupabaseClient()
    await supabase.auth.signOut()
  }

  async function handleTogglePush() {
    const supabase = getSupabaseClient()
    setPushBusy(true)
    try {
      if (pushEnabled) {
        await disablePush(supabase)
        setPushEnabled(false)
      } else {
        await enablePush(supabase)
        setPushEnabled(true)
      }
    } catch (err) {
      alert(err.message || 'No se pudo cambiar el estado de las notificaciones.')
    } finally {
      setPushBusy(false)
      setShowMenu(false)
    }
  }

  const filtered = conversations.filter((c) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      (c.nombre_cliente || '').toLowerCase().includes(q) ||
      (c.numero_whatsapp || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="conversation-list">
      <div className="conversation-list-header">
        <h2>RecellFix Agent</h2>
        <div className="header-menu" ref={menuRef}>
          <button
            type="button"
            className="header-menu-toggle"
            onClick={() => setShowMenu((v) => !v)}
            aria-label="Más opciones"
          >
            ⋮
          </button>
          {showMenu && (
            <div className="header-menu-dropdown">
              <button type="button" onClick={handleMarkAllRead}>
                Marcar todas como leídas
              </button>
              {isPushSupported() && (
                <button type="button" onClick={handleTogglePush} disabled={pushBusy}>
                  {pushEnabled ? 'Desactivar notificaciones' : 'Activar notificaciones'}
                </button>
              )}
              <button type="button" onClick={handleLogout}>
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="conversation-search">
        <input
          type="text"
          placeholder="Buscar conversación"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="conversation-items">
        {loading && <p className="empty-hint">Cargando...</p>}
        {!loading && filtered.length === 0 && (
          <p className="empty-hint">Sin conversaciones todavía.</p>
        )}
        {filtered.map((c) => {
          const unread = unreadTick >= 0 && selectedId !== c.id && isUnread(c)
          const last = lastMessages[c.id]
          const preview = last
            ? `${last.remitente === 'cliente' ? '' : '↳ '}${last.contenido}`
            : 'Sin mensajes'
          return (
            <button
              key={c.id}
              className={`conversation-item ${selectedId === c.id ? 'active' : ''}`}
              onClick={() => onSelect(c)}
            >
              <div className="avatar">
                {(c.nombre_cliente || c.numero_whatsapp || '?').charAt(0).toUpperCase()}
              </div>
              <div className="conversation-info">
                <div className="conversation-row">
                  <span className={`conversation-name ${unread ? 'unread' : ''}`}>
                    {c.nombre_cliente || c.numero_whatsapp}
                  </span>
                  <span className="conversation-time">{formatTime(c.actualizado_en)}</span>
                </div>
                <div className="conversation-row">
                  <span className="conversation-preview">{preview}</span>
                  <span className={`mode-badge ${c.modo === 'humano' ? 'human' : 'bot'}`}>
                    {c.modo === 'humano' ? 'Humano' : 'Bot'}
                  </span>
                </div>
              </div>
              {unread && <span className="unread-dot" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
