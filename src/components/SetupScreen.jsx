import { useState } from 'react'
import { saveConfig } from '../lib/supabaseClient'

export default function SetupScreen({ onReady }) {
  const [url, setUrl] = useState('')
  const [anonKey, setAnonKey] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!url.trim() || !anonKey.trim()) {
      setError('Completa ambos campos.')
      return
    }
    if (!/^https?:\/\//.test(url.trim())) {
      setError('La URL debe empezar con https://')
      return
    }
    saveConfig(url.trim(), anonKey.trim())
    onReady()
  }

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <h1>RecellFix Chat</h1>
        <p className="setup-subtitle">
          Conecta este panel con tu proyecto de Supabase existente.
        </p>
        <form onSubmit={handleSubmit}>
          <label>
            URL del proyecto Supabase
            <input
              type="text"
              placeholder="https://xxxxx.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label>
            Anon / public key
            <input
              type="password"
              placeholder="eyJhbGciOi..."
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              autoComplete="off"
            />
          </label>
          {error && <p className="setup-error">{error}</p>}
          <button type="submit">Conectar</button>
        </form>
        <p className="setup-hint">
          Estos datos se guardan solo en este navegador (localStorage), nunca se envían a
          ningún servidor propio.
        </p>
      </div>
    </div>
  )
}
