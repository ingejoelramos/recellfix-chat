import { useEffect, useRef, useState } from 'react'
import { getSupabaseClient } from '../lib/supabaseClient'
import { getSendWebhookUrl } from '../lib/n8nConfig'
import { markSeen } from '../lib/readTracking'
import EmojiPicker from './EmojiPicker'

function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

function dateLabel(iso) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Hoy'
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
}

function groupByDay(messages) {
  const groups = []
  let currentDay = null
  let currentGroup = null

  for (const m of messages) {
    const day = new Date(m.creado_en).toDateString()
    if (day !== currentDay) {
      currentDay = day
      currentGroup = { day, label: dateLabel(m.creado_en), items: [] }
      groups.push(currentGroup)
    }
    currentGroup.items.push(m)
  }
  return groups
}

function bubbleInfo(remitente) {
  if (remitente === 'cliente') {
    return { side: 'incoming', label: null }
  }
  if (remitente === 'humano') {
    return { side: 'outgoing outgoing-human', label: null }
  }
  return { side: 'outgoing outgoing-bot', label: 'Alex 🤖' }
}

function MessageMedia({ tipo, url, caption }) {
  if (tipo === 'imagen') {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt={caption || 'Imagen'} className="message-media-image" />
      </a>
    )
  }
  if (tipo === 'video') {
    // eslint-disable-next-line jsx-a11y/media-has-caption
    return <video src={url} controls className="message-media-video" />
  }
  if (tipo === 'audio') {
    // eslint-disable-next-line jsx-a11y/media-has-caption
    return <audio src={url} controls className="message-media-audio" />
  }
  if (tipo === 'documento') {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="message-media-doc">
        📄 {caption || 'Documento'}
      </a>
    )
  }
  return null
}

export default function ChatView({ conversation, onClose }) {
  const [liveConversation, setLiveConversation] = useState(conversation)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [avatarColor, setAvatarColor] = useState(undefined)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    setLiveConversation(conversation)
  }, [conversation])

  useEffect(() => {
    if (!conversation) return
    const supabase = getSupabaseClient()
    let active = true

    async function load() {
      const { data, error } = await supabase
        .from('mensajes')
        .select('*')
        .eq('conversacion_id', conversation.id)
        .order('creado_en', { ascending: true })
      if (active && !error) setMessages(data || [])
    }
    load()
    markSeen(conversation.id)

    const channel = supabase
      .channel(`conversacion-${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensajes',
          filter: `conversacion_id=eq.${conversation.id}`,
        },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
          markSeen(conversation.id)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversaciones',
          filter: `id=eq.${conversation.id}`,
        },
        (payload) => {
          setLiveConversation(payload.new)
        }
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [conversation?.id])

  useEffect(() => {
    if (!conversation) {
      setAvatarColor(undefined)
      return
    }
    const supabase = getSupabaseClient()
    let active = true

    async function loadAvatarColor() {
      const { data: memberships } = await supabase
        .from('conversacion_listas')
        .select('lista_id')
        .eq('conversacion_id', conversation.id)

      if (!active) return
      if (!memberships || memberships.length === 0) {
        setAvatarColor(undefined)
        return
      }

      const listaIds = memberships.map((m) => m.lista_id)
      const { data: lists } = await supabase
        .from('listas_chat')
        .select('id, color')
        .in('id', listaIds)
        .order('creado_en', { ascending: true })

      if (!active) return
      setAvatarColor(lists?.[0]?.color)
    }
    loadAvatarColor()

    const listsChannel = supabase
      .channel(`conversacion-listas-${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversacion_listas',
          filter: `conversacion_id=eq.${conversation.id}`,
        },
        () => loadAvatarColor()
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(listsChannel)
    }
  }, [conversation?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [draft])

  useEffect(() => {
    if (!conversation) return
    function handleGlobalKeyDown(e) {
      if (e.key === 'Escape') {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [conversation, onClose])

  async function handleSend(e) {
    e.preventDefault()
    const isHumano = liveConversation?.modo === 'humano'
    if (!draft.trim() || !conversation || !isHumano) return
    setSending(true)
    const supabase = getSupabaseClient()
    const contenido = draft.trim()
    setDraft('')

    const { error } = await supabase.from('mensajes').insert({
      conversacion_id: conversation.id,
      remitente: 'humano',
      contenido,
      tipo: 'texto',
    })

    if (error) {
      console.error(error)
    }

    const webhookUrl = getSendWebhookUrl()
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            numero_whatsapp: conversation.numero_whatsapp,
            conversacion_id: conversation.id,
            contenido,
          }),
        })
      } catch (err) {
        console.error('Error enviando a n8n:', err)
      }
    }
    setSending(false)
    textareaRef.current?.focus()
  }

  function handleInsertEmoji(emoji) {
    const el = textareaRef.current
    if (!el) {
      setDraft((prev) => prev + emoji)
      return
    }
    const start = el.selectionStart ?? draft.length
    const end = el.selectionEnd ?? draft.length
    const next = draft.slice(0, start) + emoji + draft.slice(end)
    setDraft(next)
    requestAnimationFrame(() => {
      el.focus()
      const cursor = start + emoji.length
      el.setSelectionRange(cursor, cursor)
    })
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  async function handleToggleMode() {
    if (!conversation) return
    setToggling(true)
    const supabase = getSupabaseClient()
    const nuevoModo = liveConversation?.modo === 'humano' ? 'bot' : 'humano'
    const { data } = await supabase
      .from('conversaciones')
      .update({ modo: nuevoModo })
      .eq('id', conversation.id)
      .select()
      .single()
    if (data) setLiveConversation(data)
    setToggling(false)
  }

  if (!conversation || !liveConversation) {
    return (
      <div className="chat-view chat-view-empty">
        <p>Selecciona una conversación para ver los mensajes.</p>
      </div>
    )
  }

  const dayGroups = groupByDay(messages)
  const isHumano = liveConversation.modo === 'humano'

  return (
    <div className="chat-view">
      <div className="chat-header">
        <button
          type="button"
          className="back-button"
          onClick={() => onClose?.()}
          aria-label="Volver a la lista"
        >
          ←
        </button>
        <div className="avatar" style={avatarColor ? { background: avatarColor } : undefined}>
          {liveConversation.nombre_cliente?.trim()
            ? liveConversation.nombre_cliente.trim().charAt(0).toUpperCase()
            : '?'}
        </div>
        <div className="chat-header-info">
          <span className="chat-header-name">
            {liveConversation.nombre_cliente || liveConversation.numero_whatsapp}
          </span>
          <span className="chat-header-number">{liveConversation.numero_whatsapp}</span>
        </div>
        <button
          type="button"
          className={`mode-toggle ${isHumano ? 'human' : 'bot'}`}
          onClick={handleToggleMode}
          disabled={toggling}
        >
          {isHumano ? 'Modo: Humano' : 'Modo: Bot'}
        </button>
        <button type="button" className="link-button small" onClick={() => onClose?.()}>
          ✕
        </button>
      </div>

      <div className="messages-container">
        {dayGroups.map((group) => (
          <div key={group.day} className="day-group">
            <div className="date-separator">
              <span>{group.label}</span>
            </div>
            {group.items.map((m) => {
              const { side, label } = bubbleInfo(m.remitente)
              const isMedia = !!m.media_url && m.tipo !== 'texto'
              return (
                <div key={m.id} className={`message-bubble ${side} ${isMedia ? 'has-media' : ''}`}>
                  {label && <div className="message-sender-label">{label}</div>}
                  {isMedia ? (
                    <>
                      <MessageMedia tipo={m.tipo} url={m.media_url} caption={m.contenido} />
                      {m.tipo !== 'documento' && m.contenido && (
                        <div className="message-content">{m.contenido}</div>
                      )}
                    </>
                  ) : (
                    <div className="message-content">{m.contenido}</div>
                  )}
                  <div className="message-time">{formatTime(m.creado_en)}</div>
                </div>
              )
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form className="message-input-bar" onSubmit={handleSend}>
        <div className="emoji-anchor">
          {showEmojiPicker && (
            <EmojiPicker
              onSelect={handleInsertEmoji}
              onClose={() => setShowEmojiPicker(false)}
            />
          )}
          <button
            type="button"
            className="emoji-toggle"
            disabled={!isHumano}
            onClick={() => setShowEmojiPicker((v) => !v)}
            aria-label="Insertar emoji"
          >
            😊
          </button>
        </div>
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder={isHumano ? 'Escribe un mensaje' : 'Activa modo Humano para escribir'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowEmojiPicker(false)}
          disabled={!isHumano}
        />
        <button type="submit" disabled={sending || !draft.trim() || !isHumano}>
          Enviar
        </button>
      </form>
    </div>
  )
}
