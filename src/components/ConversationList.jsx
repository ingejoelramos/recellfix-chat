import { useEffect, useState } from 'react'
import { getSupabaseClient } from '../lib/supabaseClient'
import { isUnread } from '../lib/readTracking'

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) {
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })
}

export default function ConversationList({ selectedId, onSelect }) {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

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
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [])

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
        <h2>RecellFix Chat</h2>
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
          const unread = selectedId !== c.id && isUnread(c)
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
                  <span className="conversation-number">{c.numero_whatsapp}</span>
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
