import { useEffect, useMemo, useRef, useState } from 'react'
import { useSwipeable } from 'react-swipeable'
import { getSupabaseClient } from '../lib/supabaseClient'
import { isUnread, markSeen } from '../lib/readTracking'
import { playNotificationSound } from '../lib/notificationSound'
import {
  isPushSupported,
  isPushEnabled,
  enablePush,
  disablePush,
} from '../lib/pushNotifications'
import {
  FIXED_TABS,
  LIST_COLOR_PALETTE,
  DEFAULT_LIST_COLOR,
  fetchLists,
  fetchMemberships,
  createList,
  deleteList,
  updateListColor,
  addConversationToList,
  removeConversationFromList,
} from '../lib/chatLists'

function ColorSwatchPicker({ value, onChange }) {
  return (
    <div className="color-swatch-picker">
      {LIST_COLOR_PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          className={`color-swatch ${value === color ? 'selected' : ''}`}
          style={{ background: color }}
          aria-label={`Color ${color}`}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  )
}

const MEDIA_PREVIEW_LABELS = {
  imagen: '📷 Foto',
  audio: '🎤 Audio',
  video: '🎥 Video',
  documento: '📄 Documento',
}

function buildPreview(conversation) {
  if (!conversation.ultimo_mensaje_contenido && !conversation.ultimo_mensaje_tipo) {
    return 'Sin mensajes'
  }
  const prefix = conversation.ultimo_mensaje_remitente === 'cliente' ? '' : '↳ '
  const tipo = conversation.ultimo_mensaje_tipo
  if (tipo && tipo !== 'texto') {
    return `${prefix}${MEDIA_PREVIEW_LABELS[tipo] || '📎 Archivo'}`
  }
  return `${prefix}${conversation.ultimo_mensaje_contenido}`
}

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

function ConversationRow({
  conversation,
  selected,
  unread,
  preview,
  time,
  avatarColor,
  swipeOpen,
  onSwipeOpen,
  onSwipeClose,
  onSelect,
  onOpenAddToList,
}) {
  const handlers = useSwipeable({
    onSwipedLeft: () => onSwipeOpen(conversation.id),
    onSwipedRight: () => onSwipeClose(),
    trackMouse: true,
    preventScrollOnSwipe: false,
  })

  const hasName = !!conversation.nombre_cliente?.trim()
  const initial = hasName ? conversation.nombre_cliente.trim().charAt(0).toUpperCase() : '?'

  return (
    <div
      className="conversation-row-wrapper"
      data-swipe-id={conversation.id}
      {...handlers}
    >
      <div className="conversation-swipe-actions">
        <button
          type="button"
          className="swipe-action-button"
          aria-label="Más opciones del chat"
          onClick={() => onOpenAddToList(conversation)}
        >
          ☰
        </button>
      </div>
      <button
        type="button"
        className={`conversation-item ${selected ? 'active' : ''} ${swipeOpen ? 'swiped' : ''}`}
        onClick={() => (swipeOpen ? onSwipeClose() : onSelect(conversation))}
      >
        <div className="avatar" style={avatarColor ? { background: avatarColor } : undefined}>
          {initial}
        </div>
        <div className="conversation-info">
          <div className="conversation-row">
            <span className={`conversation-name ${unread ? 'unread' : ''}`}>
              {conversation.nombre_cliente || conversation.numero_whatsapp}
            </span>
            <span className="conversation-time">{time}</span>
          </div>
          <div className="conversation-row">
            <span className="conversation-preview">{preview}</span>
            <span className={`mode-badge ${conversation.modo === 'humano' ? 'human' : 'bot'}`}>
              {conversation.modo === 'humano' ? 'Humano' : 'Bot'}
            </span>
          </div>
        </div>
        {unread && <span className="unread-dot" />}
      </button>
    </div>
  )
}

function AddToListModal({ conversation, lists, membership, onToggle, onClose, onCreateList }) {
  const [newListName, setNewListName] = useState('')
  const [newListColor, setNewListColor] = useState(DEFAULT_LIST_COLOR)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const current = membership[conversation.id] || new Set()

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await onCreateList(newListName, newListColor)
      setNewListName('')
      setNewListColor(DEFAULT_LIST_COLOR)
    } catch (err) {
      setError(err.message || 'No se pudo crear la lista.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Añadir a lista</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="modal-body">
          {lists.length === 0 && (
            <p className="modal-empty-hint">Todavía no hay listas. Crea una abajo.</p>
          )}
          {lists.map((list) => (
            <div className="modal-list-item" key={list.id}>
              <label>
                <input
                  type="checkbox"
                  checked={current.has(list.id)}
                  onChange={(e) => onToggle(conversation.id, list.id, e.target.checked)}
                />
                <span className="list-color-dot" style={{ background: list.color || DEFAULT_LIST_COLOR }} />
                {list.nombre}
              </label>
            </div>
          ))}
          <form className="modal-new-list-row" onSubmit={handleCreate}>
            <input
              type="text"
              placeholder="Nueva lista…"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
            />
            <button type="submit" disabled={busy}>
              Crear
            </button>
          </form>
          <ColorSwatchPicker value={newListColor} onChange={setNewListColor} />
          {error && <p className="modal-error">{error}</p>}
        </div>
      </div>
    </div>
  )
}

function ManageListsModal({ lists, onClose, onCreateList, onDeleteList, onUpdateColor }) {
  const [newListName, setNewListName] = useState('')
  const [newListColor, setNewListColor] = useState(DEFAULT_LIST_COLOR)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingColorId, setEditingColorId] = useState(null)

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await onCreateList(newListName, newListColor)
      setNewListName('')
      setNewListColor(DEFAULT_LIST_COLOR)
    } catch (err) {
      setError(err.message || 'No se pudo crear la lista.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(list) {
    if (!window.confirm(`¿Eliminar la lista "${list.nombre}"? Se quitará de todos los chats.`)) return
    try {
      await onDeleteList(list.id)
    } catch (err) {
      setError(err.message || 'No se pudo eliminar la lista.')
    }
  }

  async function handlePickColor(list, color) {
    setEditingColorId(null)
    try {
      await onUpdateColor(list.id, color)
    } catch (err) {
      setError(err.message || 'No se pudo cambiar el color.')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Gestionar listas</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="modal-body">
          {lists.length === 0 && <p className="modal-empty-hint">Todavía no hay listas creadas.</p>}
          {lists.map((list) => (
            <div className="modal-list-item-group" key={list.id}>
              <div className="modal-list-item">
                <button
                  type="button"
                  className="list-color-dot list-color-dot-button"
                  style={{ background: list.color || DEFAULT_LIST_COLOR }}
                  aria-label={`Cambiar color de ${list.nombre}`}
                  onClick={() => setEditingColorId(editingColorId === list.id ? null : list.id)}
                />
                <span style={{ flex: 1 }}>{list.nombre}</span>
                <button
                  type="button"
                  className="modal-delete-btn"
                  onClick={() => handleDelete(list)}
                  aria-label={`Eliminar lista ${list.nombre}`}
                >
                  🗑
                </button>
              </div>
              {editingColorId === list.id && (
                <ColorSwatchPicker value={list.color} onChange={(color) => handlePickColor(list, color)} />
              )}
            </div>
          ))}
          <form className="modal-new-list-row" onSubmit={handleCreate}>
            <input
              type="text"
              placeholder="Nueva lista…"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
            />
            <button type="submit" disabled={busy}>
              Crear
            </button>
          </form>
          <ColorSwatchPicker value={newListColor} onChange={setNewListColor} />
          {error && <p className="modal-error">{error}</p>}
        </div>
      </div>
    </div>
  )
}

export default function ConversationList({ selectedId, onSelect }) {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [unreadTick, setUnreadTick] = useState(0)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const menuRef = useRef(null)

  const [activeTab, setActiveTab] = useState('todos')
  const [customLists, setCustomLists] = useState([])
  const [membership, setMembership] = useState({})
  const [openSwipeId, setOpenSwipeId] = useState(null)
  const [addToListTarget, setAddToListTarget] = useState(null)
  const [manageListsOpen, setManageListsOpen] = useState(false)

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

      try {
        const [lists, memberships] = await Promise.all([fetchLists(supabase), fetchMemberships(supabase)])
        if (!active) return
        setCustomLists(lists)
        const map = {}
        for (const row of memberships) {
          if (!map[row.conversacion_id]) map[row.conversacion_id] = new Set()
          map[row.conversacion_id].add(row.lista_id)
        }
        setMembership(map)
      } catch (err) {
        console.error('No se pudieron cargar las listas:', err)
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
          if (payload.new.remitente === 'cliente') {
            playNotificationSound()
          }
        }
      )
      .subscribe()

    const listsChannel = supabase
      .channel('listas-chat-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'listas_chat' },
        (payload) => {
          setCustomLists((prev) => {
            if (payload.eventType === 'DELETE') {
              return prev.filter((l) => l.id !== payload.old.id)
            }
            const row = payload.new
            const exists = prev.some((l) => l.id === row.id)
            const next = exists ? prev.map((l) => (l.id === row.id ? row : l)) : [...prev, row]
            return next.sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en))
          })
          if (payload.eventType === 'DELETE') {
            setActiveTab((current) => (current === payload.old.id ? 'todos' : current))
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversacion_listas' },
        (payload) => {
          setMembership((prev) => {
            const next = { ...prev }
            if (payload.eventType === 'DELETE') {
              const row = payload.old
              const set = new Set(next[row.conversacion_id] || [])
              set.delete(row.lista_id)
              next[row.conversacion_id] = set
              return next
            }
            const row = payload.new
            const set = new Set(next[row.conversacion_id] || [])
            set.add(row.lista_id)
            next[row.conversacion_id] = set
            return next
          })
        }
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
      supabase.removeChannel(listsChannel)
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

  useEffect(() => {
    if (!openSwipeId) return
    function handleClickOutside(e) {
      if (!e.target.closest(`[data-swipe-id="${openSwipeId}"]`)) {
        setOpenSwipeId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openSwipeId])

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

  async function handleCreateList(nombre, color) {
    const supabase = getSupabaseClient()
    const created = await createList(supabase, nombre, color)
    setCustomLists((prev) =>
      prev.some((l) => l.id === created.id)
        ? prev
        : [...prev, created].sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en))
    )
  }

  async function handleDeleteList(listaId) {
    const supabase = getSupabaseClient()
    await deleteList(supabase, listaId)
    setCustomLists((prev) => prev.filter((l) => l.id !== listaId))
    setActiveTab((current) => (current === listaId ? 'todos' : current))
  }

  async function handleUpdateListColor(listaId, color) {
    const supabase = getSupabaseClient()
    setCustomLists((prev) => prev.map((l) => (l.id === listaId ? { ...l, color } : l)))
    await updateListColor(supabase, listaId, color)
  }

  async function handleToggleMembership(conversacionId, listaId, checked) {
    const supabase = getSupabaseClient()
    setMembership((prev) => {
      const next = { ...prev }
      const set = new Set(next[conversacionId] || [])
      if (checked) set.add(listaId)
      else set.delete(listaId)
      next[conversacionId] = set
      return next
    })
    try {
      if (checked) {
        await addConversationToList(supabase, conversacionId, listaId)
      } else {
        await removeConversationFromList(supabase, conversacionId, listaId)
      }
    } catch (err) {
      alert(err.message || 'No se pudo actualizar la lista.')
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return conversations.filter((c) => {
      const matchesSearch =
        !q ||
        (c.nombre_cliente || '').toLowerCase().includes(q) ||
        (c.numero_whatsapp || '').toLowerCase().includes(q)
      if (!matchesSearch) return false

      if (activeTab === 'todos') return true
      if (activeTab === 'no_leidos') return isUnread(c)
      if (activeTab === 'humano') return c.modo === 'humano'
      if (activeTab === 'bot') return c.modo !== 'humano'
      return membership[c.id]?.has(activeTab) ?? false
    })
  }, [conversations, search, activeTab, membership, unreadTick])

  return (
    <div className="conversation-list">
      <div className="conversation-list-header">
        <h2>RecellFix Agent</h2>
        <div className="header-menu" ref={menuRef}>
          <button
            type="button"
            className="header-menu-toggle"
            onClick={() => {
              setOpenSwipeId(null)
              setShowMenu((v) => !v)
            }}
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
          onFocus={() => setOpenSwipeId(null)}
        />
      </div>
      <div className="list-tabs">
        {FIXED_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`list-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => {
              setOpenSwipeId(null)
              setActiveTab(tab.id)
            }}
          >
            {tab.nombre}
          </button>
        ))}
        {customLists.map((list) => (
          <button
            key={list.id}
            type="button"
            className={`list-tab ${activeTab === list.id ? 'active' : ''}`}
            onClick={() => {
              setOpenSwipeId(null)
              setActiveTab(list.id)
            }}
          >
            {list.nombre}
          </button>
        ))}
        <button
          type="button"
          className="list-tab list-tab-add"
          onClick={() => {
            setOpenSwipeId(null)
            setManageListsOpen(true)
          }}
          aria-label="Gestionar listas"
          title="Gestionar listas"
        >
          +
        </button>
      </div>
      <div className="conversation-items">
        {loading && <p className="empty-hint">Cargando...</p>}
        {!loading && filtered.length === 0 && (
          <p className="empty-hint">Sin conversaciones en esta lista.</p>
        )}
        {filtered.map((c) => {
          const unread = unreadTick >= 0 && selectedId !== c.id && isUnread(c)
          const preview = buildPreview(c)
          const memberOf = membership[c.id]
          const avatarColor = memberOf
            ? customLists.find((list) => memberOf.has(list.id))?.color
            : undefined
          return (
            <ConversationRow
              key={c.id}
              conversation={c}
              selected={selectedId === c.id}
              unread={unread}
              preview={preview}
              time={formatTime(c.actualizado_en)}
              avatarColor={avatarColor}
              swipeOpen={openSwipeId === c.id}
              onSwipeOpen={setOpenSwipeId}
              onSwipeClose={() => setOpenSwipeId(null)}
              onSelect={onSelect}
              onOpenAddToList={(conv) => {
                setOpenSwipeId(null)
                setAddToListTarget(conv)
              }}
            />
          )
        })}
      </div>

      {addToListTarget && (
        <AddToListModal
          conversation={addToListTarget}
          lists={customLists}
          membership={membership}
          onToggle={handleToggleMembership}
          onClose={() => setAddToListTarget(null)}
          onCreateList={handleCreateList}
        />
      )}

      {manageListsOpen && (
        <ManageListsModal
          lists={customLists}
          onClose={() => setManageListsOpen(false)}
          onCreateList={handleCreateList}
          onDeleteList={handleDeleteList}
          onUpdateColor={handleUpdateListColor}
        />
      )}
    </div>
  )
}
