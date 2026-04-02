import { randomUUID } from 'node:crypto'
import { AppError, ValidationError } from '../../../core/errors'
import {
  createAuthHandler,
  jsonResponse,
  parseJsonBody,
  queryToObject,
} from '../../../core/http'
import { roundMoney } from '../../../core/number'
import { buildPagination, resolvePagination } from '../../../core/pagination'
import { requireModulePermission } from '../../../core/permissions'
import {
  TRANSACTION_SORT_FIELDS,
  transactionCreateSchema,
  transactionListQuerySchema,
  type TransactionCreateInput,
} from '../../../core/schemas'
import { buildTransactionDates } from '../../../core/transactions'

const resolveConversion = (payload: {
  amount: number
  currency: string
  default_currency: string
  exchange_rate?: number | undefined
}): { exchange_rate: number; amount_in_default_currency: number } => {
  if (payload.currency === payload.default_currency) {
    return {
      exchange_rate: 1,
      amount_in_default_currency: roundMoney(payload.amount),
    }
  }

  if (!payload.exchange_rate || payload.exchange_rate <= 0) {
    throw new ValidationError(
      'exchange_rate deve ser informada quando currency difere de default_currency.',
    )
  }

  return {
    exchange_rate: payload.exchange_rate,
    amount_in_default_currency: roundMoney(payload.amount * payload.exchange_rate),
  }
}

const buildRows = (userId: string, payload: TransactionCreateInput) => {
  const conversion = resolveConversion(payload)

  const dates = buildTransactionDates({
    startDate: payload.occurs_on,
    installments: payload.installments,
    recurrenceFrequency: payload.recurrence_frequency,
    recurrenceInterval: payload.recurrence_interval,
    recurrenceEndDate: payload.recurrence_end_date,
  })

  if (dates.length === 0) {
    throw new ValidationError('Nenhuma data válida foi gerada para a transação.')
  }

  const installmentGroupId = payload.installments > 1 ? randomUUID() : null

  return dates.map((date, index) => ({
    user_id: userId,
    account_id: payload.account_id,
    transfer_account_id: payload.type === 'transfer' ? payload.transfer_account_id : null,
    category_id: payload.type === 'transfer' ? null : payload.category_id,
    goal_id: payload.goal_id,
    type: payload.type,
    description: payload.description,
    notes: payload.notes ?? null,
    amount: payload.amount,
    currency: payload.currency,
    amount_in_default_currency: conversion.amount_in_default_currency,
    default_currency: payload.default_currency,
    exchange_rate: conversion.exchange_rate,
    occurs_on: date,
    attachment_path: payload.attachment_path ?? null,
    recurrence_frequency: payload.recurrence_frequency,
    recurrence_interval: payload.recurrence_interval,
    recurrence_end_date:
      payload.recurrence_frequency === 'none'
        ? null
        : (payload.recurrence_end_date ?? null),
    installment_group_id: installmentGroupId,
    installment_number: payload.installments > 1 ? index + 1 : null,
    installment_total: payload.installments > 1 ? payload.installments : null,
  }))
}

const transactionSortColumnMap: Record<(typeof TRANSACTION_SORT_FIELDS)[number], string> =
  {
    occurs_on: 'occurs_on',
    created_at: 'created_at',
    amount_in_default_currency: 'amount_in_default_currency',
    description: 'description',
    type: 'type',
  }

export default createAuthHandler(
  { methods: ['GET', 'POST'] },
  async ({ req, res, supabase, userId, query }) => {
    if (req.method === 'GET') {
      await requireModulePermission(supabase, userId, 'transactions', 'list')

      const filters = transactionListQuerySchema.parse(queryToObject(query))
      const pagination = resolvePagination({
        limit: filters.limit,
        offset: filters.offset,
        cursor: filters.cursor,
        sort: filters.sort,
        order: filters.order,
      })
      const sortColumn =
        transactionSortColumnMap[pagination.sort as keyof typeof transactionSortColumnMap]
      const ascending = pagination.order === 'asc'

      let dbQuery = supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order(sortColumn, { ascending })

      if (sortColumn !== 'created_at') {
        dbQuery = dbQuery.order('created_at', { ascending })
      }

      dbQuery = dbQuery.order('id', { ascending })

      if (filters.from) {
        dbQuery = dbQuery.gte('occurs_on', filters.from)
      }

      if (filters.to) {
        dbQuery = dbQuery.lte('occurs_on', filters.to)
      }

      if (filters.type) {
        dbQuery = dbQuery.eq('type', filters.type)
      }

      if (filters.account_id) {
        dbQuery = dbQuery.eq('account_id', filters.account_id)
      }

      if (filters.category_id) {
        dbQuery = dbQuery.eq('category_id', filters.category_id)
      }

      if (filters.goal_id) {
        dbQuery = dbQuery.eq('goal_id', filters.goal_id)
      }

      if (filters.search) {
        dbQuery = dbQuery.ilike('description', `%${filters.search}%`)
      }

      const from = pagination.offset
      const to = pagination.offset + pagination.limit - 1
      const { data, error, count } = await dbQuery.range(from, to)

      if (error) {
        throw new AppError(
          500,
          `Falha ao carregar transações: ${error.message}`,
          undefined,
          'TRANSACTIONS_LIST_FAILED',
        )
      }

      const rows = data ?? []

      jsonResponse(res, 200, {
        data: rows,
        pagination: buildPagination({
          limit: pagination.limit,
          offset: pagination.offset,
          total: count ?? 0,
          currentCount: rows.length,
          sort: pagination.sort,
          order: pagination.order,
        }),
      })
      return
    }

    await requireModulePermission(supabase, userId, 'transactions', 'create')

    const payload = transactionCreateSchema.parse(await parseJsonBody(req))
    const rows = buildRows(userId, payload)

    const { data, error } = await supabase
      .from('transactions')
      .insert(rows)
      .select('*')

    if (error) {
      throw new AppError(
        400,
        `Falha ao criar transação: ${error.message}`,
        undefined,
        'TRANSACTIONS_CREATE_FAILED',
      )
    }

    const normalized = (data ?? []).slice().sort((a, b) =>
      String(a.occurs_on).localeCompare(String(b.occurs_on)),
    )

    jsonResponse(res, 201, {
      data: normalized,
      meta: {
        created_count: normalized.length,
      },
    })
  },
)
