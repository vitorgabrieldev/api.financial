'use client'

import { useState } from 'react'

export function PreferencesForm({ initial }) {
  const [currency, setCurrency] = useState(initial?.default_currency ?? 'BRL')
  const [locale, setLocale] = useState(initial?.locale ?? 'pt-BR')
  const [sessionHours, setSessionHours] = useState(String(initial?.session_max_hours ?? 4))
  const [status, setStatus] = useState('')
  const [pending, setPending] = useState(false)

  const onSubmit = async (event) => {
    event.preventDefault()
    setPending(true)
    setStatus('')

    const payload = {
      default_currency: currency,
      locale,
      session_max_hours: Number(sessionHours),
    }

    try {
      const response = await fetch('/api/core/v1/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        setStatus(body?.error ?? 'Falha ao salvar preferências.')
        return
      }

      setStatus('Preferências salvas com sucesso.')
    } catch {
      setStatus('Falha de rede ao salvar preferências.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="form-grid">
      <label>
        <div className="small" style={{ marginBottom: 4 }}>Moeda padrão</div>
        <input className="input" value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} maxLength={3} />
      </label>

      <label>
        <div className="small" style={{ marginBottom: 4 }}>Locale</div>
        <input className="input" value={locale} onChange={(event) => setLocale(event.target.value)} />
      </label>

      <label className="full">
        <div className="small" style={{ marginBottom: 4 }}>Duração de sessão (horas)</div>
        <input className="input" type="number" min={1} max={24} value={sessionHours} onChange={(event) => setSessionHours(event.target.value)} />
      </label>

      <div className="full" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button type="submit" className="button" disabled={pending} style={{ maxWidth: 220 }}>
          {pending ? 'Salvando...' : 'Salvar preferências'}
        </button>
        {status ? <span className="small">{status}</span> : null}
      </div>
    </form>
  )
}
