// Listas de chats (estilo WhatsApp): pestañas fijas calculadas en automático
// (Todos, No leídos, Humano, Bot) + listas manuales guardadas en Supabase
// (tabla `listas_chat`, membresía en `conversacion_listas`).

export const FIXED_TABS = [
  { id: 'todos', nombre: 'Todos' },
  { id: 'no_leidos', nombre: 'No leídos' },
  { id: 'humano', nombre: 'Humano' },
  { id: 'bot', nombre: 'Bot' },
]

function normalizeName(value) {
  return (value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

const RESERVED_NAMES = FIXED_TABS.map((t) => normalizeName(t.nombre))

export function isReservedListName(nombre) {
  return RESERVED_NAMES.includes(normalizeName(nombre))
}

export async function fetchLists(supabase) {
  const { data, error } = await supabase
    .from('listas_chat')
    .select('*')
    .order('creado_en', { ascending: true })
  if (error) throw error
  return data || []
}

export async function fetchMemberships(supabase) {
  const { data, error } = await supabase.from('conversacion_listas').select('conversacion_id, lista_id')
  if (error) throw error
  return data || []
}

export async function createList(supabase, nombreCrudo) {
  const nombre = (nombreCrudo || '').trim()
  if (!nombre) {
    throw new Error('Escribe un nombre para la lista.')
  }
  if (isReservedListName(nombre)) {
    throw new Error('Ese nombre ya lo usa una lista automática.')
  }
  const { data, error } = await supabase.from('listas_chat').insert({ nombre }).select().single()
  if (error) {
    if (error.code === '23505') throw new Error('Ya existe una lista con ese nombre.')
    throw error
  }
  return data
}

export async function deleteList(supabase, listaId) {
  const { error } = await supabase.from('listas_chat').delete().eq('id', listaId)
  if (error) throw error
}

export async function addConversationToList(supabase, conversacionId, listaId) {
  const { error } = await supabase
    .from('conversacion_listas')
    .insert({ conversacion_id: conversacionId, lista_id: listaId })
  if (error && error.code !== '23505') throw error
}

export async function removeConversationFromList(supabase, conversacionId, listaId) {
  const { error } = await supabase
    .from('conversacion_listas')
    .delete()
    .eq('conversacion_id', conversacionId)
    .eq('lista_id', listaId)
  if (error) throw error
}
