import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { LuScale, LuTrendingDown, LuTrendingUp } from 'react-icons/lu'
import { AccountIdentity } from '../components/AccountIdentity'
import { Panel } from '../components/Panel'
import { PageSkeleton } from '../components/PageSkeleton'
import { fetchAccounts, fetchGoals, fetchTransactions } from '../lib/db'
import { formatCurrency, formatShortDate } from '../lib/format'
import { getTransactionTypeLabel } from '../lib/labels'
import type {
  Account,
  Goal,
  Transaction,
  UserPreferences,
} from '../types/finance'

interface DashboardPageProps {
  userId: string
  preferences: UserPreferences
}

const MetricCard = ({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: ReactNode
}) => {
  return (
    <article className="border border-border bg-surface p-4 shadow-soft">
      <div className="mb-3 flex items-center gap-2 text-muted">
        {icon}
        <span className="text-xs uppercase tracking-[0.2em]">{label}</span>
      </div>
      <p className="font-heading text-2xl font-semibold tracking-tight text-ink">
        {value}
      </p>
    </article>
  )
}

export const DashboardPage = ({ userId, preferences }: DashboardPageProps) => {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      setLoading(true)
      setError('')

      try {
        const [accountsData, goalsData, txData] = await Promise.all([
          fetchAccounts(userId),
          fetchGoals(userId),
          fetchTransactions(userId, 150),
        ])

        if (!isMounted) return
        setAccounts(accountsData)
        setGoals(goalsData)
        setTransactions(txData)
      } catch (error) {
        if (!isMounted) return
        setError(
          error instanceof Error ? error.message : 'Erro ao carregar o dashboard.',
        )
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    void load()

    return () => {
      isMounted = false
    }
  }, [userId])

  const currentMonthReference = new Date().toISOString().slice(0, 7)

  const monthTotals = useMemo(() => {
    const monthTransactions = transactions.filter((item) =>
      item.occurs_on.startsWith(currentMonthReference),
    )

    const income = monthTransactions
      .filter((item) => item.type === 'income')
      .reduce((sum, item) => sum + item.amount_in_default_currency, 0)
    const expense = monthTransactions
      .filter((item) => item.type === 'expense')
      .reduce((sum, item) => sum + item.amount_in_default_currency, 0)

    return {
      income,
      expense,
      net: income - expense,
    }
  }, [transactions, currentMonthReference])

  const accountBalances = useMemo(() => {
    const balances: Record<string, number> = {}
    accounts.forEach((account) => {
      balances[account.id] = Number(account.initial_balance || 0)
    })

    transactions.forEach((item) => {
      if (item.type === 'income') {
        balances[item.account_id] = (balances[item.account_id] ?? 0) + item.amount
      }

      if (item.type === 'expense') {
        balances[item.account_id] = (balances[item.account_id] ?? 0) - item.amount
      }

      if (item.type === 'transfer' && item.transfer_account_id) {
        balances[item.account_id] = (balances[item.account_id] ?? 0) - item.amount
        balances[item.transfer_account_id] =
          (balances[item.transfer_account_id] ?? 0) + item.amount
      }
    })

    return balances
  }, [accounts, transactions])

  const overallGoals = useMemo(() => {
    const totalTarget = goals.reduce((sum, goal) => sum + goal.target_amount, 0)
    const totalCurrent = goals.reduce((sum, goal) => sum + goal.current_amount, 0)
    const completion = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0

    return { totalTarget, totalCurrent, completion }
  }, [goals])

  const recentTransactions = transactions.slice(0, 7)

  if (loading) return <PageSkeleton cards={3} lines={6} withTable />
  if (error) {
    return (
      <div className="border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        {error}
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard
          label="Receitas do mês"
          value={formatCurrency(
            monthTotals.income,
            preferences.default_currency,
            preferences.locale,
          )}
          icon={<LuTrendingUp className="h-4 w-4" />}
        />
        <MetricCard
          label="Despesas do mês"
          value={formatCurrency(
            monthTotals.expense,
            preferences.default_currency,
            preferences.locale,
          )}
          icon={<LuTrendingDown className="h-4 w-4" />}
        />
        <MetricCard
          label="Resultado líquido"
          value={formatCurrency(
            monthTotals.net,
            preferences.default_currency,
            preferences.locale,
          )}
          icon={<LuScale className="h-4 w-4" />}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Panel title="Contas" subtitle="Saldo estimado por conta">
          <div className="grid gap-2">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="grid grid-cols-[1fr_auto] items-center border border-border bg-white/70 px-3 py-2 text-sm"
              >
                <AccountIdentity account={account} compact />
                <strong className="font-medium text-ink">
                  {formatCurrency(
                    accountBalances[account.id] ?? 0,
                    account.currency,
                    preferences.locale,
                  )}
                </strong>
              </div>
            ))}
            {accounts.length === 0 ? (
              <p className="text-sm text-muted">Sem contas cadastradas.</p>
            ) : null}
          </div>
        </Panel>

        <Panel title="Metas" subtitle="Progresso consolidado">
          <div className="space-y-3">
            <div className="border border-border bg-white/70 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">
                Acumulado
              </p>
              <p className="mt-1 text-sm text-ink">
                {formatCurrency(
                  overallGoals.totalCurrent,
                  preferences.default_currency,
                  preferences.locale,
                )}{' '}
                de{' '}
                {formatCurrency(
                  overallGoals.totalTarget,
                  preferences.default_currency,
                  preferences.locale,
                )}
              </p>
              <div className="mt-3 h-2 bg-neutral-200">
                <div
                  className="h-2 bg-primary"
                  style={{ width: `${Math.min(overallGoals.completion, 100)}%` }}
                />
              </div>
            </div>

            {goals.slice(0, 4).map((goal) => (
              <div key={goal.id} className="border border-border bg-white/70 p-3">
                <p className="text-sm font-medium text-ink">{goal.name}</p>
                <p className="text-xs text-muted">
                  {formatCurrency(goal.current_amount, goal.currency, preferences.locale)}{' '}
                  /{' '}
                  {formatCurrency(goal.target_amount, goal.currency, preferences.locale)}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <Panel title="Transações recentes" subtitle="Últimos lançamentos">
        <div className="overflow-auto">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-[0.14em] text-muted">
                <th className="pb-2 pr-2">Data</th>
                <th className="pb-2 pr-2">Descrição</th>
                <th className="pb-2 pr-2">Tipo</th>
                <th className="pb-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map((item) => (
                <tr key={item.id} className="border-b border-border/70">
                  <td className="py-3 pr-2 text-muted">
                    {formatShortDate(item.occurs_on, preferences.locale)}
                  </td>
                  <td className="py-3 pr-2 text-ink">{item.description}</td>
                  <td className="py-3 pr-2 text-muted">
                    {getTransactionTypeLabel(item.type)}
                  </td>
                  <td className="py-3 text-right font-medium text-ink">
                    {formatCurrency(item.amount, item.currency, preferences.locale)}
                  </td>
                </tr>
              ))}
              {recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-muted">
                    Nenhuma transação registrada.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
