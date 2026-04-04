'use client'

import { useCallback, useEffect, useState } from 'react'
import { coreRequest, getErrorMessage, isUnauthorized } from '@/lib/client-api'
import { categoryKinds } from '@/lib/options'
import { formatMoney } from '@/lib/format'
import { TableSkeleton } from '@/components/skeletons'
import { UnauthorizedBlock } from '@/components/unauthorized-block'

const year = new Date().getUTCFullYear()
const initialFrom = String(year) + '-01-01'
const initialTo = String(year) + '-12-31'

export function ReportsPanel() {
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)
  const [kind, setKind] = useState('')

  const [monthly, setMonthly] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  const loadData = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true)
      else setLoading(true)

      setError(null)

      const [monthlyPayload, categoriesPayload] = await Promise.all([
        coreRequest({ path: '/v1/reports/monthly', query: { from, to } }),
        coreRequest({ path: '/v1/reports/categories', query: { from, to, kind } }),
      ])

      setMonthly(Array.isArray(monthlyPayload?.data) ? monthlyPayload.data : [])
      setCategories(Array.isArray(categoriesPayload?.data) ? categoriesPayload.data : [])
    } catch (nextError) {
      setError(nextError)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [from, to, kind])

  useEffect(() => {
    void loadData()
  }, [loadData])

  if (loading) {
    return (
      <>
        <TableSkeleton rows={7} columns={4} />
        <TableSkeleton rows={7} columns={4} />
      </>
    )
  }

  if (error && isUnauthorized(error)) {
    return <UnauthorizedBlock message="Sessão expirada ao carregar relatórios." />
  }

  return (
    <>
      <div className="toolbar">
        <input className="input" type="date" style={{ width: 170 }} value={from} onChange={(event) => setFrom(event.target.value)} />
        <input className="input" type="date" style={{ width: 170 }} value={to} onChange={(event) => setTo(event.target.value)} />
        <select className="select" style={{ width: 170 }} value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="">Todas categorias</option>
          {categoryKinds.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>

        <button type="button" className="button secondary" style={{ width: 'auto' }} onClick={() => void loadData({ silent: true })}>
          {refreshing ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {error ? <p className="status error">{getErrorMessage(error, 'Falha ao carregar relatórios.')}</p> : null}

      {refreshing ? (
        <>
          <TableSkeleton rows={6} columns={4} />
          <TableSkeleton rows={6} columns={4} />
        </>
      ) : null}

      {!refreshing ? (
        <>
          <article className="card">
            <h3 style={{ margin: '0 0 8px' }}>Consolidado Mensal</h3>

            {monthly.length === 0 ? (
              <div className="empty">Sem dados no período selecionado.</div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Mês</th>
                      <th>Receitas</th>
                      <th>Despesas</th>
                      <th>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.map((row, index) => (
                      <tr key={String(row.month_start) + '-' + String(index)}>
                        <td>{row.month_start}</td>
                        <td>R$ {formatMoney(Number(row.total_income ?? 0))}</td>
                        <td>R$ {formatMoney(Number(row.total_expense ?? 0))}</td>
                        <td>R$ {formatMoney(Number(row.net_total ?? 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className="card">
            <h3 style={{ margin: '0 0 8px' }}>Consolidado por Categoria</h3>

            {categories.length === 0 ? (
              <div className="empty">Sem dados no período selecionado.</div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Mês</th>
                      <th>Categoria</th>
                      <th>Tipo</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((row, index) => (
                      <tr key={String(row.category_id) + '-' + String(row.month_start) + '-' + String(index)}>
                        <td>{row.month_start}</td>
                        <td>{row.category_name ?? row.category_id}</td>
                        <td>{row.kind}</td>
                        <td>R$ {formatMoney(Number(row.total_amount ?? 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </>
      ) : null}
    </>
  )
}
