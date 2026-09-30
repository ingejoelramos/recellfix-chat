import { useEffect, useState } from 'react'
import { getEffectiveConfig, shouldForceSetup, getSupabaseClient } from './lib/supabaseClient'
import SetupScreen from './components/SetupScreen'
import LoginScreen from './components/LoginScreen'
import ConversationList from './components/ConversationList'
import ChatView from './components/ChatView'
import './index.css'

function App() {
  const [configReady, setConfigReady] = useState(!shouldForceSetup() && !!getEffectiveConfig())
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [selectedConversation, setSelectedConversation] = useState(null)

  useEffect(() => {
    if (!configReady) {
      setCheckingSession(false)
      return
    }
    const supabase = getSupabaseClient()
    if (!supabase) {
      setCheckingSession(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCheckingSession(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [configReady])

  if (!configReady) {
    return <SetupScreen onReady={() => setConfigReady(true)} />
  }

  if (checkingSession) {
    return (
      <div className="setup-screen">
        <p className="empty-hint">Cargando...</p>
      </div>
    )
  }

  if (!session) {
    return <LoginScreen onLoggedIn={setSession} />
  }

  return (
    <div className="app-shell">
      <ConversationList
        selectedId={selectedConversation?.id}
        onSelect={setSelectedConversation}
      />
      <ChatView
        conversation={selectedConversation}
        onClose={() => setSelectedConversation(null)}
      />
    </div>
  )
}

export default App
