import { AppError } from '../../../core/errors'
import {
  createAuthHandler,
  jsonResponse,
  queryToObject,
} from '../../../core/http'
import { roundMoney, toNumber } from '../../../core/number'
import { requireModulePermission } from '../../../core/permissions'
import { reportQuerySchema } from '../../../core/schemas'

const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10)

const firstDayOfCurrentMonth = (): string => {
  const now = new Date()
  return toIsoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)))
}

const todayIso = (): string => toIsoDate(new Date())

export default createAuthHandler(
  { methods: ['GET'] },
  async ({ res, supabase, userId, query }) => {
    await requireModulePermission(supabase, userId, 'dashboard', 'list')

    const filters = reportQuerySchema.parse(queryToObject(query))
    const from = filters.from ?? firstDayOfCurrentMonth()
    const to = filters.to ?? todayIso()

    const transactionsQuery = supabase
      .from('transactions')
      .select(
        'id,type,description,amount,amount_in_default_currency,default_currency,occurs_on,created_at',
      )
      .eq('user_id', userId)
      .gte('occurs_on', from)
      .lte('occurs_on', to)
      .order('occurs_on', { ascending: false })
      .order('created_at', { ascending: false })

    const { data: transactions, error: transactionsError } = await transactionsQuery

    if (transactionsError) {
      throw new AppError(
        500,
        `Falha ao carregar transações para dashboard: ${transactionsError.message}`,
        undefined,
        'DASHBOARD_TRANSACTIONS_LOAD_FAILED',
      )
    }

    const txRows = transactions ?? []
    let income = 0
    let expense = 0
    let transfers = 0
    let largestIncome: Record<string, unknown> | null = null
    let largestExpense: Record<string, unknown> | null = null

    for (const row of txRows) {
      const amountDefault = toNumber(row.amount_in_default_currency)
      const amount = Number.isFinite(amountDefault)
        ? amountDefault
        : toNumber(row.amount)

      if (!Number.isFinite(amount)) continue

      if (row.type === 'income') {
        income += amount
        if (!largestIncome || amount > toNumber(largestIncome.amount_in_default_currency)) {
          largestIncome = row
        }
      } else if (row.type === 'expense') {
        expense += amount
        if (!largestExpense || amount > toNumber(largestExpense.amount_in_default_currency)) {
          largestExpense = row
        }
      } else if (row.type === 'transfer') {
        transfers += amount
      }
    }

    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id,is_archived,initial_balance')
      .eq('user_id', userId)

    if (accountsError) {
      throw new AppError(
        500,
        `Falha ao carregar contas para dashboard: ${accountsError.message}`,
        undefined,
        'DASHBOARD_ACCOUNTS_LOAD_FAILED',
      )
    }

    const accountRows = accounts ?? []
    const archivedAccounts = accountRows.filter((row) => row.is_archived).length
    const activeAccounts = accountRows.length - archivedAccounts
    const initialBalance = roundMoney(
      accountRows.reduce((acc, row) => acc + (toNumber(row.initial_balance) || 0), 0),
    )

    const { data: goals, error: goalsError } = await supabase
      .from('goals')
      .select('id,status,target_amount,current_amount')
      .eq('user_id', userId)

    if (goalsError) {
      throw new AppError(
        500,
        `Falha ao carregar metas para dashboard: ${goalsError.message}`,
        undefined,
        'DASHBOARD_GOALS_LOAD_FAILED',
      )
    }

    const goalRows = goals ?? []
    const goalsActive = goalRows.filter((goal) => goal.status === 'active').length
    const goalsAchieved = goalRows.filter((goal) => goal.status === 'achieved').length
    const targetTotal = roundMoney(
      goalRows.reduce((acc, goal) => acc + (toNumber(goal.target_amount) || 0), 0),
    )
    const currentTotal = roundMoney(
      goalRows.reduce((acc, goal) => acc + (toNumber(goal.current_amount) || 0), 0),
    )

    jsonResponse(res, 200, {
      data: {
        period: {
          from,
          to,
        },
        totals: {
          income: roundMoney(income),
          expense: roundMoney(expense),
          transfer_volume: roundMoney(transfers),
          net: roundMoney(income - expense),
        },
        accounts: {
          total: accountRows.length,
          active: activeAccounts,
          archived: archivedAccounts,
          initial_balance_total: initialBalance,
        },
        goals: {
          total: goalRows.length,
          active: goalsActive,
          achieved: goalsAchieved,
          target_total: targetTotal,
          current_total: currentTotal,
        },
        transactions: {
          total_in_period: txRows.length,
          latest: txRows.slice(0, 8),
          largest_income: largestIncome,
          largest_expense: largestExpense,
        },
      },
    })
  },
)
