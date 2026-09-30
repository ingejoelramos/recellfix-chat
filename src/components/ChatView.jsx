import { useEffect, useRef, useState } from 'react'
import { getSupabaseClient } from '../lib/supabaseClient'
import { getSendWebhookUrl, setSendWebhookUrl } from '../lib/n8nConfig'

function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

export default function ChatView({ conversation }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [showWebhookConfig, setShowWebhookConfig] = useState(false)
  const [webhookInput, setWebhookInput] = useState(getSendWebhookUrl())
  const bottomRef = useRef(null)

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

    const channel = supabase
      .channel(`mensajes-${conversation.id}`)
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
        }
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [conversation?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    if (!draft.trim() || !conversation) return
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
  }

  async function handleToggleMode() {
    if (!conversation) return
    setToggling(true)
    const supabase = getSupabaseClient()
    const nuevoModo = conversation.modo === 'humano' ? 'bot' : 'humano'
    await supabase
      .from('conversaciones')
      .update({ modo: nuevoModo })
      .eq('id', conversation.id)
    setToggling(false)
  }

  function saveWebhook() {
    setSendWebhookUrl(webhookInput.trim())
    setShowWebhookConfig(false)
  }

  if (!conversation) {
    return (
      <div className="chat-view chat-view-empty">
        <p>Selecciona una conversación para ver los mensajes.</p>
      </div>
    )
  }

  return (
    <div className="chat-view">
      <div className="chat-header">
        <div className="avatar">
          {(conversation.nombre_cliente || conversation.numero_whatsapp || '?')
            .charAt(0)
            .toUpperCase()}
        </div>
        <div className="chat-header-info">
          <span className="chat-header-name">
            {conversation.nombre_cliente || conversation.numero_whatsapp}
          </span>
          <span className="chat-header-number">{conversation.numero_whatsapp}</span>
        </div>
        <button
          type="button"
          className={`mode-toggle ${conversation.modo === 'humano' ? 'human' : 'bot'}`}
          onClick={handleToggleMode}
          disabled={toggling}
        >
          {conversation.modo === 'humano' ? 'Modo: Humano' : 'Modo: Bot'}
        </button>
        <button
          type="button"
          className="link-button small"
          onClick={() => setShowWebhookConfig((v) => !v)}
        >
          ⚙
        </button>
      </div>

      {showWebhookConfig && (
        <div className="webhook-config">
          <input
            type="text"
            placeholder="URL del webhook n8n para enviar a WhatsApp (opcional)"
            value={webhookInput}
            onChange={(e) => setWebhookInput(e.target.value)}
          />
          <button type="button" onClick={saveWebhook}>
            Guardar
          </button>
        </div>
      )}

      <div className="messages-container">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`message-bubble ${m.remitente === 'cliente' ? 'incoming' : 'outgoing'}`}
          >
            <div className="message-content">{m.contenido}</div>
            <div className="message-time">{formatTime(m.creado_en)}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form className="message-input-bar" onSubmit={handleSend}>
        <input
          type="text"
          placeholder="Escribe un mensaje"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" disabled={sending || !draft.trim()}>
          Enviar
        </button>
      </form>
      {!getSendWebhookUrl() && (
        <p className="webhook-warning">
          Sin webhook de envío configurado: el mensaje se guarda en Supabase pero no se
          reenvía a WhatsApp automáticamente. Configúralo con el ícono ⚙.
        </p>
      )}
    </div>
  )
}
