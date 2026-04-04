'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const onSubmit = async (event) => {
    event.preventDefault()
    setError('')

    try {
      setPending(true)
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(data?.error ?? 'Falha ao autenticar. Confira suas credenciais.')
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Falha de rede ao autenticar.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="form-grid">
      <label>
        <div className="field-label">Email</div>
        <input
          className="input"
          type="email"
          placeholder="seu-email@dominio.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
        />
      </label>

      <label>
        <div className="field-label">Senha</div>
        <input
          className="input"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete="current-password"
        />
      </label>

      <div className="full">
        <button type="submit" className="button primary" disabled={pending}>
          {pending ? 'Entrando...' : 'Entrar no sistema'}
        </button>
        {error ? <p className="status error" style={{ marginTop: 8 }}>{error}</p> : null}
      </div>
    </form>
  )
}
