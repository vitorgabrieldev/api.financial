'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { coreRequest, getErrorMessage, isUnauthorized } from '@/lib/client-api'
import { categoryKinds } from '@/lib/options'
import { FormSkeleton, TableSkeleton } from '@/components/skeletons'
import { UnauthorizedBlock } from '@/components/unauthorized-block'

const defaultCreate = {
  name: '',
  kind: 'expense',
  color: '#9f2f2f',
  icon: 'LuTag',
  is_system: false,
}

const normalizeCategory = (row) => ({
  name: row.name ?? '',
  kind: row.kind ?? 'expense',
  color: row.color ?? '#9f2f2f',
  icon: row.icon ?? 'LuTag',
  is_system: Boolean(row.is_system),
})

const toPayload = (form) => ({
  name: form.name.trim(),
  kind: form.kind,
  color: form.color.trim(),
  icon: form.icon.trim(),
  is_system: Boolean(form.is_system),
})

const hasDiff = (current, base) => {
  return (
    current.name !== base.name ||
    current.kind !== base.kind ||
    current.color !== base.color ||
    current.icon !== base.icon ||
    Boolean(current.is_system) !== Boolean(base.is_system)
  )
}

export function CategoriesPanel() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('')
  const [actionBusy, setActionBusy] = useState('')

  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState('')

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
        path: '/v1/categories',
        query: {
          limit: 250,
          offset: 0,
          kind: kindFilter,
          search,
          sort: 'name',
          order: 'asc',
        },
      })

      setRows(Array.isArray(payload?.data) ? payload.data : [])
    } catch (nextError) {
      setError(nextError)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [kindFilter, search])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const selected = useMemo(() => {
    if (!editId) return null
    return rows.find((row) => row.id === editId) ?? null
  }, [editId, rows])

  const beginEdit = (row) => {
    const normalized = normalizeCategory(row)
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

      await coreRequest({ path: '/v1/categories', method: 'POST', body: toPayload(createForm) })
      setCreateForm(defaultCreate)
      setStatus('Categoria cadastrada com sucesso.')
      await loadData({ silent: true })
    } catch (nextError) {
      setStatus(getErrorMessage(nextError, 'Falha ao cadastrar categoria.'))
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
        path: `/v1/categories/${editId}`,
        method: 'PATCH',
        body: toPayload(editForm),
      })

      setStatus('Categoria atualizada com sucesso.')
      cancelEdit()
      await loadData({ silent: true })
    } catch (nextError) {
      setStatus(getErrorMessage(nextError, 'Falha ao atualizar categoria.'))
    } finally {
      setActionBusy('')
    }
  }

  const onDelete = async (row) => {
    const confirmed = window.confirm(`Excluir categoria "${row.name}"?`)
    if (!confirmed) return

    try {
      setActionBusy(`delete:${row.id}`)
      setStatus('')

      await coreRequest({ path: `/v1/categories/${row.id}`, method: 'DELETE' })
      if (editId === row.id) cancelEdit()

      setStatus('Categoria excluída com sucesso.')
      await loadData({ silent: true })
    } catch (nextError) {
      setStatus(getErrorMessage(nextError, 'Falha ao excluir categoria.'))
    } finally {
      setActionBusy('')
    }
  }

  if (loading) {
    return (
      <div className="layout-2">
        <article className="card"><FormSkeleton /></article>
        <TableSkeleton rows={10} columns={6} />
      </div>
    )
  }

  if (error && isUnauthorized(error)) {
    return <UnauthorizedBlock message="Sessão expirada ao listar categorias." />
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
            <label className="field-label">Tipo</label>
            <select
              className="select"
              value={createForm.kind}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, kind: event.target.value }))}
            >
              {categoryKinds.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Cor</label>
            <input
              className="input"
              value={createForm.color}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, color: event.target.value }))}
            />
          </div>

          <div>
            <label className="field-label">Ícone</label>
            <input
              className="input"
              value={createForm.icon}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, icon: event.target.value }))}
            />
          </div>

          <div>
            <label className="field-label">Sistema</label>
            <select
              className="select"
              value={String(createForm.is_system)}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, is_system: event.target.value === 'true' }))}
            >
              <option value="false">Não</option>
              <option value="true">Sim</option>
            </select>
          </div>

          <div className="full toolbar">
            <button type="submit" className="button primary" disabled={actionBusy === 'create'}>
              {actionBusy === 'create' ? 'Salvando...' : 'Cadastrar Categoria'}
            </button>
            <button type="button" className="button secondary" onClick={() => setCreateForm(defaultCreate)}>
              Limpar
            </button>
          </div>
        </form>

        <hr style={{ margin: '14px 0', border: 0, borderTop: '1px solid var(--border)' }} />

        <h3 style={{ margin: '0 0 10px' }}>Editar Selecionada</h3>
        {!selected || !editForm ? (
          <p className="muted">Selecione uma categoria na tabela para editar.</p>
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
              <label className="field-label">Tipo</label>
              <select
                className="select"
                value={editForm.kind}
                onChange={(event) => setEditForm((prev) => ({ ...prev, kind: event.target.value }))}
              >
                {categoryKinds.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label">Cor</label>
              <input
                className="input"
                value={editForm.color}
                onChange={(event) => setEditForm((prev) => ({ ...prev, color: event.target.value }))}
              />
            </div>

            <div>
              <label className="field-label">Ícone</label>
              <input
                className="input"
                value={editForm.icon}
                onChange={(event) => setEditForm((prev) => ({ ...prev, icon: event.target.value }))}
              />
            </div>

            <div>
              <label className="field-label">Sistema</label>
              <select
                className="select"
                value={String(editForm.is_system)}
                onChange={(event) => setEditForm((prev) => ({ ...prev, is_system: event.target.value === 'true' }))}
              >
                <option value="false">Não</option>
                <option value="true">Sim</option>
              </select>
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
            value={kindFilter}
            onChange={(event) => setKindFilter(event.target.value)}
          >
            <option value="">Todos os tipos</option>
            {categoryKinds.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>

          <button type="button" className="button secondary" style={{ width: 'auto' }} onClick={() => void loadData({ silent: true })}>
            {refreshing ? 'Carregando...' : 'Buscar'}
          </button>
        </div>

        {error ? <p className="status error">{getErrorMessage(error, 'Falha ao listar categorias.')}</p> : null}

        {refreshing ? <TableSkeleton rows={6} columns={6} /> : null}

        {!refreshing && rows.length === 0 ? (
          <div className="empty">Nenhuma categoria encontrada.</div>
        ) : null}

        {!refreshing && rows.length > 0 ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Cor</th>
                  <th>Ícone</th>
                  <th>Sistema</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.kind}</td>
                    <td>{row.color}</td>
                    <td>{row.icon}</td>
                    <td>{row.is_system ? 'sim' : 'não'}</td>
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
