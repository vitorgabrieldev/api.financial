'use client'

import { useCallback, useEffect, useState } from 'react'
import { coreRequest, getErrorMessage, isUnauthorized } from '@/lib/client-api'
import { FormSkeleton } from '@/components/skeletons'
import { UnauthorizedBlock } from '@/components/unauthorized-block'

export function PreferencesPanel() {
  const [form, setForm] = useState({
    default_currency: 'BRL',
    locale: 'pt-BR',
    session_max_hours: '4',
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('')

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const payload = await coreRequest({ path: '/v1/preferences' })
      const data = payload?.data ?? {}

      setForm({
        default_currency: data.default_currency ?? 'BRL',
        locale: data.locale ?? 'pt-BR',
        session_max_hours: String(data.session_max_hours ?? 4),
      })
    } catch (nextError) {
      setError(nextError)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const onSubmit = async (event) => {
    event.preventDefault()

    try {
      setSaving(true)
      setStatus('')

      await coreRequest({
        path: '/v1/preferences',
        method: 'PATCH',
        body: {
          default_currency: form.default_currency.trim().toUpperCase(),
          locale: form.locale.trim(),
          session_max_hours: Number(form.session_max_hours || 4),
        },
      })

      setStatus('Preferências atualizadas com sucesso.')
    } catch (nextError) {
      setStatus(getErrorMessage(nextError, 'Falha ao atualizar preferências.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <article className="card">
        <FormSkeleton />
      </article>
    )
  }

  if (error && isUnauthorized(error)) {
    return <UnauthorizedBlock message="Sessão expirada ao carregar preferências." />
  }

  return (
    <article className="card">
      <form className="form-grid" onSubmit={onSubmit}>
        <div>
          <label className="field-label">Moeda Padrão</label>
          <input
            className="input"
            value={form.default_currency}
            maxLength={3}
            onChange={(event) => setForm((prev) => ({ ...prev, default_currency: event.target.value.toUpperCase() }))}
            required
          />
        </div>

        <div>
          <label className="field-label">Locale</label>
          <input
            className="input"
            value={form.locale}
            onChange={(event) => setForm((prev) => ({ ...prev, locale: event.target.value }))}
            required
          />
        </div>

        <div>
          <label className="field-label">Duração da Sessão (horas)</label>
          <input
            className="input"
            type="number"
            min={1}
            max={24}
            value={form.session_max_hours}
            onChange={(event) => setForm((prev) => ({ ...prev, session_max_hours: event.target.value }))}
            required
          />
        </div>

        <div className="full toolbar">
          <button type="submit" className="button primary" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Preferências'}
          </button>
          <button type="button" className="button secondary" onClick={() => void loadData()} disabled={saving}>
            Recarregar
          </button>
        </div>
      </form>

      {error ? <p className="status error" style={{ marginTop: 10 }}>{getErrorMessage(error, 'Falha ao carregar preferências.')}</p> : null}

      {status ? (
        <p className={`status ${status.toLowerCase().includes('falha') ? 'error' : 'success'}`} style={{ marginTop: 10 }}>
          {status}
        </p>
      ) : null}
    </article>
  )
}
