'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { coreRequest, getErrorMessage, isUnauthorized } from '@/lib/client-api'
import { goalStatuses } from '@/lib/options'
import { formatDate, formatMoney } from '@/lib/format'
import { FormSkeleton, TableSkeleton } from '@/components/skeletons'
import { UnauthorizedBlock } from '@/components/unauthorized-block'

const defaultCreate = {
  name: '',
  target_amount: '0',
  current_amount: '0',
  currency: 'BRL',
  target_date: '',
  status: 'active',
  notes: '',
}

const normalizeGoal = (row) => ({
  name: row.name ?? '',
  target_amount: String(row.target_amount ?? 0),
  current_amount: String(row.current_amount ?? 0),
  currency: row.currency ?? 'BRL',
  target_date: row.target_date ?? '',
  status: row.status ?? 'active',
  notes: row.notes ?? '',
})

const toPayload = (form) => ({
  name: form.name.trim(),
  target_amount: Number(form.target_amount || 0),
  current_amount: Number(form.current_amount || 0),
  currency: form.currency.trim().toUpperCase() || 'BRL',
  target_date: form.target_date || null,
  status: form.status,
  notes: form.notes.trim() || null,
})

const hasDiff = (current, base) => {
  return (
    current.name !== base.name ||
    Number(current.target_amount) !== Number(base.target_amount) ||
    Number(current.current_amount) !== Number(base.current_amount) ||
    current.currency !== base.currency ||
    current.target_date !== base.target_date ||
    current.status !== base.status ||
    current.notes !== base.notes
  )
}

export function GoalsPanel() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('')
  const [actionBusy, setActionBusy] = useState('')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [createForm, setCreateForm] = useState(defaultCreate)
  const [editId, setEditId] = useState('')
  const [editForm, setEditForm] = useState(null)
  const [editBase, setEditBase] = useState(null)

  const loadData = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true)
      else setLoading(true)

      setError(null)

      const payload = await coreRequest({
        path: '/v1/goals',
        query: {
          limit: 200,
          offset: 0,
          status: statusFilter,
          search,
          sort: 'created_at',
          order: 'desc',
        },
      })

      setRows(Array.isArray(payload?.data) ? payload.data : [])
    } catch (nextError) {
      setError(nextError)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const selected = useMemo(() => {
    if (!editId) return null
    return rows.find((row) => row.id === editId) ?? null
  }, [editId, rows])

  const beginEdit = (row) => {
    const normalized = normalizeGoal(row)
    setEditId(row.id)
    setEditForm(normalized)
    setEditBase(normalized)
    setStatus('')
  }

  const cancelEdit = () => {
    setEditId('')
    setEditForm(null)
    setEditBase(null)
  }

  const onCreate = async (event) => {
    event.preventDefault()

    try {
      setActionBusy('create')
      setStatus('')

      await coreRequest({ path: '/v1/goals', method: 'POST', body: toPayload(createForm) })
      setCreateForm(defaultCreate)
      setStatus('Meta cadastrada com sucesso.')
      await loadData({ silent: true })
    } catch (nextError) {
      setStatus(getErrorMessage(nextError, 'Falha ao cadastrar meta.'))
    } finally {
      setActionBusy('')
    }
  }

  const onUpdate = async (event) => {
    event.preventDefault()

    if (!editId || !editForm || !editBase) return

    if (!hasDiff(editForm, editBase)) {
      setStatus('Nenhuma alteração para salvar.')
      return
    }

    try {
      setActionBusy(`update:${editId}`)
      setStatus('')

      await coreRequest({
        path: `/v1/goals/${editId}`,
        method: 'PATCH',
        body: toPayload(editForm),
      })

      setStatus('Meta atualizada com sucesso.')
      cancelEdit()
      await loadData({ silent: true })
    } catch (nextError) {
      setStatus(getErrorMessage(nextError, 'Falha ao atualizar meta.'))
    } finally {
      setActionBusy('')
    }
  }

  const onDelete = async (row) => {
    const confirmed = window.confirm(`Excluir meta "${row.name}"?`)
    if (!confirmed) return

    try {
      setActionBusy(`delete:${row.id}`)
      setStatus('')

      await coreRequest({ path: `/v1/goals/${row.id}`, method: 'DELETE' })
      if (editId === row.id) cancelEdit()

      setStatus('Meta excluída com sucesso.')
      await loadData({ silent: true })
    } catch (nextError) {
      setStatus(getErrorMessage(nextError, 'Falha ao excluir meta.'))
    } finally {
      setActionBusy('')
    }
  }

  if (loading) {
    return (
      <div className="layout-2">
        <article className="card"><FormSkeleton /></article>
        <TableSkeleton rows={10} columns={7} />
      </div>
    )
  }

  if (error && isUnauthorized(error)) {
    return <UnauthorizedBlock message="Sessão expirada ao listar metas." />
  }

  return (
    <div className="layout-2">
      <article className="card">
        <h3 style={{ margin: '0 0 10px' }}>Cadastro / Edição</h3>

        <form className="form-grid" onSubmit={onCreate}>
          <div className="full">
            <label className="field-label">Nome</label>
            <input
              className="input"
              value={createForm.name}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </div>

          <div>
            <label className="field-label">Target</label>
            <input
              className="input"
              type="number"
              step="0.01"
              value={createForm.target_amount}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, target_amount: event.target.value }))}
            />
          </div>

          <div>
            <label className="field-label">Atual</label>
            <input
              className="input"
              type="number"
              step="0.01"
              value={createForm.current_amount}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, current_amount: event.target.value }))}
            />
          </div>

          <div>
            <label className="field-label">Moeda</label>
            <input
              className="input"
              value={createForm.currency}
              maxLength={3}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))}
            />
          </div>

          <div>
            <label className="field-label">Data Alvo</label>
            <input
              className="input"
              type="date"
              value={createForm.target_date}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, target_date: event.target.value }))}
            />
          </div>

          <div>
            <label className="field-label">Status</label>
            <select
              className="select"
              value={createForm.status}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, status: event.target.value }))}
            >
              {goalStatuses.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="full">
            <label className="field-label">Notas</label>
            <textarea
              className="textarea"
              value={createForm.notes}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </div>

          <div className="full toolbar">
            <button type="submit" className="button primary" disabled={actionBusy === 'create'}>
              {actionBusy === 'create' ? 'Salvando...' : 'Cadastrar Meta'}
            </button>
            <button type="button" className="button secondary" onClick={() => setCreateForm(defaultCreate)}>Limpar</button>
          </div>
        </form>

        <hr style={{ margin: '14px 0', border: 0, borderTop: '1px solid var(--border)' }} />

        <h3 style={{ margin: '0 0 10px' }}>Editar Selecionada</h3>
        {!selected || !editForm ? (
          <p className="muted">Selecione uma meta na tabela para editar.</p>
        ) : (
          <form className="form-grid" onSubmit={onUpdate}>
            <div className="full">
              <label className="field-label">Nome</label>
              <input
                className="input"
                value={editForm.name}
                onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>

            <div>
              <label className="field-label">Target</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={editForm.target_amount}
                onChange={(event) => setEditForm((prev) => ({ ...prev, target_amount: event.target.value }))}
              />
            </div>

            <div>
              <label className="field-label">Atual</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={editForm.current_amount}
                onChange={(event) => setEditForm((prev) => ({ ...prev, current_amount: event.target.value }))}
              />
            </div>

            <div>
              <label className="field-label">Moeda</label>
              <input
                className="input"
                value={editForm.currency}
                maxLength={3}
                onChange={(event) => setEditForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))}
              />
            </div>

            <div>
              <label className="field-label">Data Alvo</label>
              <input
                className="input"
                type="date"
                value={editForm.target_date}
                onChange={(event) => setEditForm((prev) => ({ ...prev, target_date: event.target.value }))}
              />
            </div>

            <div>
              <label className="field-label">Status</label>
              <select
                className="select"
                value={editForm.status}
                onChange={(event) => setEditForm((prev) => ({ ...prev, status: event.target.value }))}
              >
                {goalStatuses.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div className="full">
              <label className="field-label">Notas</label>
              <textarea
                className="textarea"
                value={editForm.notes}
                onChange={(event) => setEditForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </div>

            <div className="full toolbar">
              <button type="submit" className="button primary" disabled={actionBusy === `update:${editId}`}>
                {actionBusy === `update:${editId}` ? 'Salvando...' : 'Salvar Alterações'}
              </button>
              <button type="button" className="button secondary" onClick={cancelEdit}>Cancelar</button>
            </div>
          </form>
        )}

        {status ? (
          <p className={`status ${status.toLowerCase().includes('falha') ? 'error' : 'success'}`} style={{ marginTop: 12 }}>
            {status}
          </p>
        ) : null}
      </article>

      <article className="card" style={{ minWidth: 0 }}>
        <div className="toolbar" style={{ marginBottom: 10 }}>
          <input
            className="input"
            style={{ maxWidth: 250 }}
            placeholder="Buscar por nome"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void loadData({ silent: true })
              }
            }}
          />

          <select
            className="select"
            style={{ width: 170 }}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">Todos os status</option>
            {goalStatuses.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>

          <button type="button" className="button secondary" style={{ width: 'auto' }} onClick={() => void loadData({ silent: true })}>
            {refreshing ? 'Carregando...' : 'Buscar'}
          </button>
        </div>

        {error ? <p className="status error">{getErrorMessage(error, 'Falha ao listar metas.')}</p> : null}

        {refreshing ? <TableSkeleton rows={6} columns={7} /> : null}

        {!refreshing && rows.length === 0 ? <div className="empty">Nenhuma meta encontrada.</div> : null}

        {!refreshing && rows.length > 0 ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Status</th>
                  <th>Target</th>
                  <th>Atual</th>
                  <th>Data Alvo</th>
                  <th>Moeda</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.status}</td>
                    <td>R$ {formatMoney(Number(row.target_amount ?? 0))}</td>
                    <td>R$ {formatMoney(Number(row.current_amount ?? 0))}</td>
                    <td>{formatDate(row.target_date)}</td>
                    <td>{row.currency}</td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="button secondary" onClick={() => beginEdit(row)}>Editar</button>
                        <button
                          type="button"
                          className="button danger"
                          onClick={() => void onDelete(row)}
                          disabled={actionBusy === `delete:${row.id}`}
                        >
                          {actionBusy === `delete:${row.id}` ? 'Excluindo...' : 'Excluir'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </article>
    </div>
  )
}
