'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { coreRequest, getErrorMessage, isUnauthorized } from '@/lib/client-api'
import { accountTypes } from '@/lib/options'
import { formatMoney } from '@/lib/format'
import { FormSkeleton, TableSkeleton } from '@/components/skeletons'
import { UnauthorizedBlock } from '@/components/unauthorized-block'

const defaultCreate = {
  name: '',
  type: 'checking',
  currency: 'BRL',
  initial_balance: '0',
  is_archived: false,
}

const normalizeAccount = (row) => ({
  name: row.name ?? '',
  type: row.type ?? 'checking',
  currency: row.currency ?? 'BRL',
  initial_balance: String(row.initial_balance ?? 0),
  is_archived: Boolean(row.is_archived),
})

const toAccountPayload = (form) => ({
  name: form.name.trim(),
  type: form.type,
  currency: form.currency.trim().toUpperCase() || 'BRL',
  initial_balance: Number(form.initial_balance || 0),
  is_archived: Boolean(form.is_archived),
})

const hasDiff = (current, original) => {
  return (
    current.name !== original.name ||
    current.type !== original.type ||
    current.currency !== original.currency ||
    Number(current.initial_balance) !== Number(original.initial_balance) ||
    Boolean(current.is_archived) !== Boolean(original.is_archived)
  )
}

export function AccountsPanel() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('')
  const [actionBusy, setActionBusy] = useState('')
  const [search, setSearch] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)

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
        path: '/v1/accounts',
        query: {
          limit: 200,
          offset: 0,
          include_archived: includeArchived,
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
  }, [includeArchived, search])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const beginEdit = useCallback((row) => {
    const normalized = normalizeAccount(row)
    setEditId(row.id)
    setEditForm(normalized)
    setEditBase(normalized)
    setStatus('')
  }, [])

  const cancelEdit = useCallback(() => {
    setEditId('')
    setEditForm(null)
    setEditBase(null)
  }, [])

  const selectedAccount = useMemo(() => {
    if (!editId) return null
    return rows.find((row) => row.id === editId) ?? null
  }, [editId, rows])

  const onCreate = async (event) => {
    event.preventDefault()

    try {
      setActionBusy('create')
      setStatus('')

      const payload = toAccountPayload(createForm)
      await coreRequest({ path: '/v1/accounts', method: 'POST', body: payload })

      setCreateForm(defaultCreate)
      setStatus('Conta cadastrada com sucesso.')
      await loadData({ silent: true })
    } catch (nextError) {
      setStatus(getErrorMessage(nextError, 'Falha ao cadastrar conta.'))
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
        path: `/v1/accounts/${editId}`,
        method: 'PATCH',
        body: toAccountPayload(editForm),
      })

      setStatus('Conta atualizada com sucesso.')
      cancelEdit()
      await loadData({ silent: true })
    } catch (nextError) {
      setStatus(getErrorMessage(nextError, 'Falha ao atualizar conta.'))
    } finally {
      setActionBusy('')
    }
  }

  const onDelete = async (row) => {
    const confirmed = window.confirm(`Excluir a conta "${row.name}"?`)
    if (!confirmed) return

    try {
      setActionBusy(`delete:${row.id}`)
      setStatus('')

      await coreRequest({ path: `/v1/accounts/${row.id}`, method: 'DELETE' })
      if (editId === row.id) cancelEdit()

      setStatus('Conta excluída com sucesso.')
      await loadData({ silent: true })
    } catch (nextError) {
      setStatus(getErrorMessage(nextError, 'Falha ao excluir conta.'))
    } finally {
      setActionBusy('')
    }
  }

  if (loading) {
    return (
      <div className="layout-2">
        <article className="card">
          <FormSkeleton />
        </article>
        <TableSkeleton rows={9} columns={6} />
      </div>
    )
  }

  if (error && isUnauthorized(error)) {
    return <UnauthorizedBlock message="Sessão expirada ao listar contas." />
  }

  return (
    <div className="layout-2">
      <article className="card">
        <h3 style={{ margin: '0 0 10px' }}>Cadastro / Edição</h3>

        <form className="form-grid" onSubmit={onCreate}>
          <div className="full">
            <label className="field-label">Nome da Conta</label>
            <input
              className="input"
              value={createForm.name}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Conta principal"
              required
            />
          </div>

          <div>
            <label className="field-label">Tipo</label>
            <select
              className="select"
              value={createForm.type}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, type: event.target.value }))}
            >
              {accountTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
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
            <label className="field-label">Saldo Inicial</label>
            <input
              className="input"
              type="number"
              step="0.01"
              value={createForm.initial_balance}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, initial_balance: event.target.value }))}
            />
          </div>

          <div>
            <label className="field-label">Arquivada</label>
            <select
              className="select"
              value={String(createForm.is_archived)}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, is_archived: event.target.value === 'true' }))}
            >
              <option value="false">Não</option>
              <option value="true">Sim</option>
            </select>
          </div>

          <div className="full toolbar">
            <button type="submit" className="button primary" disabled={actionBusy === 'create'}>
              {actionBusy === 'create' ? 'Salvando...' : 'Cadastrar Conta'}
            </button>

            <button
              type="button"
              className="button secondary"
              onClick={() => setCreateForm(defaultCreate)}
              disabled={actionBusy === 'create'}
            >
              Limpar
            </button>
          </div>
        </form>

        <hr style={{ margin: '14px 0', border: 0, borderTop: '1px solid var(--border)' }} />

        <h3 style={{ margin: '0 0 10px' }}>Editar Selecionada</h3>
        {!selectedAccount || !editForm ? (
          <p className="muted">Selecione uma conta na tabela para editar.</p>
        ) : (
          <form className="form-grid" onSubmit={onUpdate}>
            <div className="full">
              <label className="field-label">Nome da Conta</label>
              <input
                className="input"
                value={editForm.name}
                onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>

            <div>
              <label className="field-label">Tipo</label>
              <select
                className="select"
                value={editForm.type}
                onChange={(event) => setEditForm((prev) => ({ ...prev, type: event.target.value }))}
              >
                {accountTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
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
              <label className="field-label">Saldo Inicial</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={editForm.initial_balance}
                onChange={(event) => setEditForm((prev) => ({ ...prev, initial_balance: event.target.value }))}
              />
            </div>

            <div>
              <label className="field-label">Arquivada</label>
              <select
                className="select"
                value={String(editForm.is_archived)}
                onChange={(event) => setEditForm((prev) => ({ ...prev, is_archived: event.target.value === 'true' }))}
              >
                <option value="false">Não</option>
                <option value="true">Sim</option>
              </select>
            </div>

            <div className="full toolbar">
              <button type="submit" className="button primary" disabled={actionBusy === `update:${editId}`}>
                {actionBusy === `update:${editId}` ? 'Salvando...' : 'Salvar Alterações'}
              </button>

              <button type="button" className="button secondary" onClick={cancelEdit}>
                Cancelar
              </button>
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
            style={{ maxWidth: 260 }}
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
            style={{ width: 160 }}
            value={String(includeArchived)}
            onChange={(event) => setIncludeArchived(event.target.value === 'true')}
          >
            <option value="false">Só ativas</option>
            <option value="true">Incluir arquivadas</option>
          </select>

          <button type="button" className="button secondary" style={{ width: 'auto' }} onClick={() => void loadData({ silent: true })}>
            {refreshing ? 'Carregando...' : 'Buscar'}
          </button>
        </div>

        {error ? <p className="status error">{getErrorMessage(error, 'Falha ao listar contas.')}</p> : null}

        {refreshing ? <TableSkeleton rows={6} columns={6} /> : null}

        {!refreshing && rows.length === 0 ? (
          <div className="empty">Nenhuma conta encontrada para os filtros selecionados.</div>
        ) : null}

        {!refreshing && rows.length > 0 ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Moeda</th>
                  <th>Saldo Inicial</th>
                  <th>Arquivada</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.type}</td>
                    <td>{row.currency}</td>
                    <td>R$ {formatMoney(Number(row.initial_balance ?? 0))}</td>
                    <td>{row.is_archived ? 'sim' : 'não'}</td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="button secondary" onClick={() => beginEdit(row)}>
                          Editar
                        </button>
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
