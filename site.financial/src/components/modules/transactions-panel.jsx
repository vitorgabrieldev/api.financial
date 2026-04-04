'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { coreRequest, getErrorMessage, isUnauthorized } from '@/lib/client-api'
import { recurrenceFrequencies, transactionTypes } from '@/lib/options'
import { formatDate, formatMoney } from '@/lib/format'
import { FormSkeleton, TableSkeleton } from '@/components/skeletons'
import { UnauthorizedBlock } from '@/components/unauthorized-block'

const today = new Date().toISOString().slice(0, 10)

const defaultCreate = {
  account_id: '',
  transfer_account_id: '',
  category_id: '',
  goal_id: '',
  type: 'expense',
  description: '',
  notes: '',
  amount: '0',
  currency: 'BRL',
  default_currency: 'BRL',
  exchange_rate: '',
  occurs_on: today,
  recurrence_frequency: 'none',
  recurrence_interval: '1',
  recurrence_end_date: '',
  installments: '1',
}

const normalizeTx = (row) => ({
  account_id: row.account_id ?? '',
  transfer_account_id: row.transfer_account_id ?? '',
  category_id: row.category_id ?? '',
  goal_id: row.goal_id ?? '',
  type: row.type ?? 'expense',
  description: row.description ?? '',
  notes: row.notes ?? '',
  amount: String(row.amount ?? 0),
  currency: row.currency ?? 'BRL',
  default_currency: row.default_currency ?? 'BRL',
  exchange_rate: row.exchange_rate ? String(row.exchange_rate) : '',
  occurs_on: row.occurs_on ?? today,
  recurrence_frequency: row.recurrence_frequency ?? 'none',
  recurrence_interval: String(row.recurrence_interval ?? 1),
  recurrence_end_date: row.recurrence_end_date ?? '',
})

const toCreatePayload = (form) => {
  const payload = {
    account_id: form.account_id,
    transfer_account_id: form.transfer_account_id || null,
    category_id: form.category_id || null,
    goal_id: form.goal_id || null,
    type: form.type,
    description: form.description.trim(),
    notes: form.notes.trim() || null,
    amount: Number(form.amount || 0),
    currency: form.currency.trim().toUpperCase() || 'BRL',
    default_currency: form.default_currency.trim().toUpperCase() || 'BRL',
    exchange_rate: form.exchange_rate ? Number(form.exchange_rate) : undefined,
    occurs_on: form.occurs_on,
    recurrence_frequency: form.recurrence_frequency,
    recurrence_interval: Number(form.recurrence_interval || 1),
    recurrence_end_date: form.recurrence_end_date || null,
    installments: Number(form.installments || 1),
  }

  if (payload.type === 'transfer') {
    payload.category_id = null
  } else {
    payload.transfer_account_id = null
  }

  if (payload.recurrence_frequency === 'none') {
    payload.recurrence_end_date = null
  }

  if (payload.currency === payload.default_currency) {
    delete payload.exchange_rate
  }

  return payload
}

const toPatchPayload = (form) => {
  const payload = {
    account_id: form.account_id,
    transfer_account_id: form.transfer_account_id || null,
    category_id: form.category_id || null,
    goal_id: form.goal_id || null,
    type: form.type,
    description: form.description.trim(),
    notes: form.notes.trim() || null,
    amount: Number(form.amount || 0),
    currency: form.currency.trim().toUpperCase() || 'BRL',
    default_currency: form.default_currency.trim().toUpperCase() || 'BRL',
    exchange_rate: form.exchange_rate ? Number(form.exchange_rate) : undefined,
    occurs_on: form.occurs_on,
    recurrence_frequency: form.recurrence_frequency,
    recurrence_interval: Number(form.recurrence_interval || 1),
    recurrence_end_date: form.recurrence_end_date || null,
  }

  if (payload.type === 'transfer') {
    payload.category_id = null
  } else {
    payload.transfer_account_id = null
  }

  if (payload.recurrence_frequency === 'none') {
    payload.recurrence_end_date = null
  }

  if (payload.currency === payload.default_currency) {
    delete payload.exchange_rate
  }

  return payload
}

const hasDiff = (current, base) => JSON.stringify(current) !== JSON.stringify(base)

export function TransactionsPanel() {
  const [rows, setRows] = useState([])
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [goals, setGoals] = useState([])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('')
  const [actionBusy, setActionBusy] = useState('')

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const [createForm, setCreateForm] = useState(defaultCreate)
  const [editId, setEditId] = useState('')
  const [editForm, setEditForm] = useState(null)
  const [editBase, setEditBase] = useState(null)

  const loadReferences = useCallback(async () => {
    const [accountsPayload, categoriesPayload, goalsPayload] = await Promise.all([
      coreRequest({
        path: '/v1/accounts',
        query: { limit: 500, offset: 0, include_archived: true, sort: 'name', order: 'asc' },
      }),
      coreRequest({
        path: '/v1/categories',
        query: { limit: 500, offset: 0, sort: 'name', order: 'asc' },
      }),
      coreRequest({
        path: '/v1/goals',
        query: { limit: 500, offset: 0, sort: 'name', order: 'asc' },
      }),
    ])

    const accountsData = Array.isArray(accountsPayload?.data) ? accountsPayload.data : []
    const categoriesData = Array.isArray(categoriesPayload?.data) ? categoriesPayload.data : []
    const goalsData = Array.isArray(goalsPayload?.data) ? goalsPayload.data : []

    setAccounts(accountsData)
    setCategories(categoriesData)
    setGoals(goalsData)

    if (accountsData[0]?.id) {
      setCreateForm((prev) => ({
        ...prev,
        account_id: prev.account_id || accountsData[0].id,
      }))
    }
  }, [])

  const loadRows = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true)
      else setLoading(true)

      setError(null)
      const payload = await coreRequest({
        path: '/v1/transactions',
        query: {
          limit: 200,
          offset: 0,
          search,
          type: typeFilter,
          from,
          to,
          sort: 'occurs_on',
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
  }, [from, search, to, typeFilter])

  const bootstrap = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      await loadReferences()
      await loadRows({ silent: true })
    } catch (nextError) {
      setError(nextError)
      setLoading(false)
    }
  }, [loadReferences, loadRows])

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  const accountNameById = useMemo(() => {
    const map = new Map()
    for (const account of accounts) {
      map.set(account.id, account.name)
    }
    return map
  }, [accounts])

  const categoryNameById = useMemo(() => {
    const map = new Map()
    for (const category of categories) {
      map.set(category.id, category.name)
    }
    return map
  }, [categories])

  const beginEdit = (row) => {
    const normalized = normalizeTx(row)
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

      await coreRequest({ path: '/v1/transactions', method: 'POST', body: toCreatePayload(createForm) })
      setCreateForm((prev) => ({ ...defaultCreate, account_id: prev.account_id }))
      setStatus('Transação cadastrada com sucesso.')
      await loadRows({ silent: true })
    } catch (nextError) {
      setStatus(getErrorMessage(nextError, 'Falha ao cadastrar transação.'))
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
        path: `/v1/transactions/${editId}`,
        method: 'PATCH',
        body: toPatchPayload(editForm),
      })

      setStatus('Transação atualizada com sucesso.')
      cancelEdit()
      await loadRows({ silent: true })
    } catch (nextError) {
      setStatus(getErrorMessage(nextError, 'Falha ao atualizar transação.'))
    } finally {
      setActionBusy('')
    }
  }

  const onDelete = async (row, scope = 'single') => {
    const confirmed = window.confirm(
      scope === 'installment_group'
        ? 'Excluir todas as parcelas deste grupo?'
        : `Excluir transação "${row.description}"?`,
    )

    if (!confirmed) return

    try {
      setActionBusy(`delete:${row.id}:${scope}`)
      setStatus('')

      await coreRequest({
        path: `/v1/transactions/${row.id}`,
        method: 'DELETE',
        query: scope === 'installment_group' ? { scope } : undefined,
      })

      if (editId === row.id) cancelEdit()
      setStatus('Transação excluída com sucesso.')
      await loadRows({ silent: true })
    } catch (nextError) {
      setStatus(getErrorMessage(nextError, 'Falha ao excluir transação.'))
    } finally {
      setActionBusy('')
    }
  }

  if (loading) {
    return (
      <div className="layout-2">
        <article className="card"><FormSkeleton /></article>
        <TableSkeleton rows={10} columns={8} />
      </div>
    )
  }

  if (error && isUnauthorized(error)) {
    return <UnauthorizedBlock message="Sessão expirada ao listar transações." />
  }

  return (
    <div className="layout-2">
      <article className="card">
        <h3 style={{ margin: '0 0 10px' }}>Cadastro / Edição</h3>

        <form className="form-grid" onSubmit={onCreate}>
          <div>
            <label className="field-label">Conta Origem</label>
            <select
              className="select"
              value={createForm.account_id}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, account_id: event.target.value }))}
              required
            >
              <option value="">Selecione</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Tipo</label>
            <select
              className="select"
              value={createForm.type}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, type: event.target.value }))}
            >
              {transactionTypes.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Conta Destino</label>
            <select
              className="select"
              value={createForm.transfer_account_id}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, transfer_account_id: event.target.value }))}
              disabled={createForm.type !== 'transfer'}
            >
              <option value="">(não aplicável)</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Categoria</label>
            <select
              className="select"
              value={createForm.category_id}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, category_id: event.target.value }))}
              disabled={createForm.type === 'transfer'}
            >
              <option value="">(não aplicável)</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Meta (Opcional)</label>
            <select
              className="select"
              value={createForm.goal_id}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, goal_id: event.target.value }))}
            >
              <option value="">Sem meta</option>
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>{goal.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Descrição</label>
            <input
              className="input"
              value={createForm.description}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
              required
            />
          </div>

          <div>
            <label className="field-label">Valor</label>
            <input
              className="input"
              type="number"
              step="0.01"
              value={createForm.amount}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, amount: event.target.value }))}
              required
            />
          </div>

          <div>
            <label className="field-label">Data</label>
            <input
              className="input"
              type="date"
              value={createForm.occurs_on}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, occurs_on: event.target.value }))}
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
            <label className="field-label">Moeda Base</label>
            <input
              className="input"
              value={createForm.default_currency}
              maxLength={3}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, default_currency: event.target.value.toUpperCase() }))}
            />
          </div>

          <div>
            <label className="field-label">Exchange Rate</label>
            <input
              className="input"
              type="number"
              step="0.0001"
              value={createForm.exchange_rate}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, exchange_rate: event.target.value }))}
            />
          </div>

          <div>
            <label className="field-label">Recorrência</label>
            <select
              className="select"
              value={createForm.recurrence_frequency}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, recurrence_frequency: event.target.value }))}
            >
              {recurrenceFrequencies.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Intervalo</label>
            <input
              className="input"
              type="number"
              min={1}
              value={createForm.recurrence_interval}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, recurrence_interval: event.target.value }))}
            />
          </div>

          <div>
            <label className="field-label">Fim Recorrência</label>
            <input
              className="input"
              type="date"
              value={createForm.recurrence_end_date}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, recurrence_end_date: event.target.value }))}
            />
          </div>

          <div>
            <label className="field-label">Parcelas</label>
            <input
              className="input"
              type="number"
              min={1}
              max={120}
              value={createForm.installments}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, installments: event.target.value }))}
            />
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
              {actionBusy === 'create' ? 'Salvando...' : 'Cadastrar Transação'}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setCreateForm((prev) => ({ ...defaultCreate, account_id: prev.account_id || accounts[0]?.id || '' }))}
            >
              Limpar
            </button>
          </div>
        </form>

        <hr style={{ margin: '14px 0', border: 0, borderTop: '1px solid var(--border)' }} />

        <h3 style={{ margin: '0 0 10px' }}>Editar Selecionada</h3>
        {!editForm ? (
          <p className="muted">Selecione uma transação na tabela para editar.</p>
        ) : (
          <form className="form-grid" onSubmit={onUpdate}>
            <div>
              <label className="field-label">Conta Origem</label>
              <select
                className="select"
                value={editForm.account_id}
                onChange={(event) => setEditForm((prev) => ({ ...prev, account_id: event.target.value }))}
                required
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label">Tipo</label>
              <select
                className="select"
                value={editForm.type}
                onChange={(event) => setEditForm((prev) => ({ ...prev, type: event.target.value }))}
              >
                {transactionTypes.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label">Conta Destino</label>
              <select
                className="select"
                value={editForm.transfer_account_id}
                onChange={(event) => setEditForm((prev) => ({ ...prev, transfer_account_id: event.target.value }))}
                disabled={editForm.type !== 'transfer'}
              >
                <option value="">(não aplicável)</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label">Categoria</label>
              <select
                className="select"
                value={editForm.category_id}
                onChange={(event) => setEditForm((prev) => ({ ...prev, category_id: event.target.value }))}
                disabled={editForm.type === 'transfer'}
              >
                <option value="">(não aplicável)</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label">Meta (Opcional)</label>
              <select
                className="select"
                value={editForm.goal_id}
                onChange={(event) => setEditForm((prev) => ({ ...prev, goal_id: event.target.value }))}
              >
                <option value="">Sem meta</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>{goal.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label">Descrição</label>
              <input
                className="input"
                value={editForm.description}
                onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
                required
              />
            </div>

            <div>
              <label className="field-label">Valor</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={editForm.amount}
                onChange={(event) => setEditForm((prev) => ({ ...prev, amount: event.target.value }))}
              />
            </div>

            <div>
              <label className="field-label">Data</label>
              <input
                className="input"
                type="date"
                value={editForm.occurs_on}
                onChange={(event) => setEditForm((prev) => ({ ...prev, occurs_on: event.target.value }))}
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
              <label className="field-label">Moeda Base</label>
              <input
                className="input"
                value={editForm.default_currency}
                maxLength={3}
                onChange={(event) => setEditForm((prev) => ({ ...prev, default_currency: event.target.value.toUpperCase() }))}
              />
            </div>

            <div>
              <label className="field-label">Exchange Rate</label>
              <input
                className="input"
                type="number"
                step="0.0001"
                value={editForm.exchange_rate}
                onChange={(event) => setEditForm((prev) => ({ ...prev, exchange_rate: event.target.value }))}
              />
            </div>

            <div>
              <label className="field-label">Recorrência</label>
              <select
                className="select"
                value={editForm.recurrence_frequency}
                onChange={(event) => setEditForm((prev) => ({ ...prev, recurrence_frequency: event.target.value }))}
              >
                {recurrenceFrequencies.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label">Intervalo</label>
              <input
                className="input"
                type="number"
                min={1}
                value={editForm.recurrence_interval}
                onChange={(event) => setEditForm((prev) => ({ ...prev, recurrence_interval: event.target.value }))}
              />
            </div>

            <div>
              <label className="field-label">Fim Recorrência</label>
              <input
                className="input"
                type="date"
                value={editForm.recurrence_end_date}
                onChange={(event) => setEditForm((prev) => ({ ...prev, recurrence_end_date: event.target.value }))}
              />
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
            style={{ maxWidth: 240 }}
            placeholder="Buscar por descrição"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void loadRows({ silent: true })
              }
            }}
          />

          <select className="select" style={{ width: 160 }} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="">Todos os tipos</option>
            {transactionTypes.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>

          <input className="input" type="date" style={{ width: 150 }} value={from} onChange={(event) => setFrom(event.target.value)} />
          <input className="input" type="date" style={{ width: 150 }} value={to} onChange={(event) => setTo(event.target.value)} />

          <button type="button" className="button secondary" style={{ width: 'auto' }} onClick={() => void loadRows({ silent: true })}>
            {refreshing ? 'Carregando...' : 'Buscar'}
          </button>
        </div>

        {error ? <p className="status error">{getErrorMessage(error, 'Falha ao listar transações.')}</p> : null}

        {refreshing ? <TableSkeleton rows={7} columns={8} /> : null}

        {!refreshing && rows.length === 0 ? (
          <div className="empty">Nenhuma transação encontrada para os filtros selecionados.</div>
        ) : null}

        {!refreshing && rows.length > 0 ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Tipo</th>
                  <th>Conta</th>
                  <th>Categoria</th>
                  <th>Valor</th>
                  <th>Parcela</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.occurs_on)}</td>
                    <td>{row.description}</td>
                    <td>{row.type}</td>
                    <td>{accountNameById.get(row.account_id) ?? row.account_id}</td>
                    <td>{categoryNameById.get(row.category_id) ?? '-'}</td>
                    <td>R$ {formatMoney(Number(row.amount_in_default_currency ?? 0))}</td>
                    <td>
                      {row.installment_number && row.installment_total
                        ? `${row.installment_number}/${row.installment_total}`
                        : '-'}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="button secondary" onClick={() => beginEdit(row)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="button danger"
                          onClick={() => void onDelete(row, 'single')}
                          disabled={actionBusy === `delete:${row.id}:single`}
                        >
                          {actionBusy === `delete:${row.id}:single` ? 'Excluindo...' : 'Excluir'}
                        </button>
                        {row.installment_group_id ? (
                          <button
                            type="button"
                            className="button danger"
                            onClick={() => void onDelete(row, 'installment_group')}
                            disabled={actionBusy === `delete:${row.id}:installment_group`}
                          >
                            Grupo
                          </button>
                        ) : null}
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
