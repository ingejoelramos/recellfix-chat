const KEY = 'recellfix_last_seen'

function getMap() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}

export function getLastSeen(conversationId) {
  return getMap()[conversationId] || null
}

export function markSeen(conversationId) {
  const map = getMap()
  map[conversationId] = new Date().toISOString()
  localStorage.setItem(KEY, JSON.stringify(map))
}

export function isUnread(conversation) {
  const seen = getLastSeen(conversation.id)
  if (!seen) return true
  return new Date(conversation.actualizado_en) > new Date(seen)
}
