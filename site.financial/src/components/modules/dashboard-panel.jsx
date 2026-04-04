'use client'

import { useCallback, useEffect, useState } from 'react'
import { coreRequest, getErrorMessage, isUnauthorized } from '@/lib/client-api'
import { formatMoney } from '@/lib/format'
import { MetricSkeletons } from '@/components/skeletons'
import { UnauthorizedBlock } from '@/components/unauthorized-block'

export function DashboardPanel() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  const loadData = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true)
      else setLoading(true)

      setError(null)
      const payload = await coreRequest({ path: '/v1/dashboard/summary' })
      setData(payload?.data ?? null)
    } catch (nextError) {
      setError(nextError)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  if (loading) {
    return <MetricSkeletons />
  }

  if (error && isUnauthorized(error)) {
    return <UnauthorizedBlock message="Sessão expirada no dashboard." />
  }

  if (error) {
    return <p className="status error">{getErrorMessage(error, 'Falha ao carregar dashboard.')}</p>
  }

  const totals = data?.totals ?? {}
  const accounts = data?.accounts ?? {}
  const goals = data?.goals ?? {}

  return (
    <>
      <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="button secondary"
          style={{ width: 'auto' }}
          onClick={() => void loadData({ silent: true })}
          disabled={refreshing}
        >
          {refreshing ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      <div className="layout-3">
        <article className="card">
          <p className="metric-label">Saldo Líquido</p>
          <p className="metric-value">R$ {formatMoney(Number(totals.net ?? 0))}</p>
        </article>

        <article className="card">
          <p className="metric-label">Receitas</p>
          <p className="metric-value">R$ {formatMoney(Number(totals.income ?? 0))}</p>
        </article>

        <article className="card">
          <p className="metric-label">Despesas</p>
          <p className="metric-value">R$ {formatMoney(Number(totals.expense ?? 0))}</p>
        </article>
      </div>

      <div className="layout-3">
        <article className="card">
          <p className="metric-label">Contas Ativas</p>
          <p className="metric-value">{accounts.active ?? 0}</p>
        </article>

        <article className="card">
          <p className="metric-label">Metas Ativas</p>
          <p className="metric-value">{goals.active ?? 0}</p>
        </article>

        <article className="card">
          <p className="metric-label">Metas Concluídas</p>
          <p className="metric-value">{goals.achieved ?? 0}</p>
        </article>
      </div>
    </>
  )
}
