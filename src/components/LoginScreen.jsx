import { useState } from 'react'
import { getSupabaseClient, clearConfig } from '../lib/supabaseClient'

export default function LoginScreen({ onLoggedIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = getSupabaseClient()
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setLoading(false)
    if (signInError) {
      setError(signInError.message)
      return
    }
    onLoggedIn(data.session)
  }

  function handleReset() {
    clearConfig()
    window.location.reload()
  }

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <h1>RecellFix Agent</h1>
        <p className="setup-subtitle">Inicia sesión para ver las conversaciones.</p>
        <form onSubmit={handleSubmit}>
          <label>
            Correo
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error && <p className="setup-error">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <button type="button" className="link-button" onClick={handleReset}>
          Cambiar proyecto de Supabase
        </button>
      </div>
    </div>
  )
}
