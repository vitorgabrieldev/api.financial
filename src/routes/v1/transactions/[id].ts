import { AppError, NotFoundError, ValidationError } from '../../../core/errors'
import {
  createAuthHandler,
  jsonResponse,
  parseJsonBody,
} from '../../../core/http'
import { roundMoney, toNumber } from '../../../core/number'
import { requireModulePermission } from '../../../core/permissions'
import {
  idParamSchema,
  transactionPatchSchema,
  validateMergedTransaction,
  type TransactionPatchInput,
} from '../../../core/schemas'

const readId = (value: string | string[] | undefined, requestUrl?: string): string => {
  const raw = Array.isArray(value) ? value[0] : value
  if (raw) {
    return idParamSchema.parse({ id: raw }).id
  }

  const pathname = requestUrl
    ? new URL(requestUrl, 'http://localhost').pathname
    : ''
  const fallback = pathname.split('/').filter(Boolean).pop()
  return idParamSchema.parse({ id: fallback }).id
}

const ensureExchangeRate = (params: {
  amount: number
  currency: string
  default_currency: string
  exchange_rate?: number | undefined
}): { exchange_rate: number; amount_in_default_currency: number } => {
  if (params.currency === params.default_currency) {
    return {
      exchange_rate: 1,
      amount_in_default_currency: roundMoney(params.amount),
    }
  }

  if (!params.exchange_rate || params.exchange_rate <= 0) {
    throw new ValidationError(
      'exchange_rate deve ser informada quando currency difere de default_currency.',
    )
  }

  return {
    exchange_rate: params.exchange_rate,
    amount_in_default_currency: roundMoney(params.amount * params.exchange_rate),
  }
}

const mergeWithCurrent = (current: Record<string, unknown>, patch: TransactionPatchInput) => {
  const candidate = {
    account_id: patch.account_id ?? String(current.account_id),
    transfer_account_id:
      patch.transfer_account_id === undefined
        ? (current.transfer_account_id as string | null)
        : patch.transfer_account_id,
    category_id:
      patch.category_id === undefined
        ? (current.category_id as string | null)
        : patch.category_id,
    goal_id:
      patch.goal_id === undefined
        ? (current.goal_id as string | null)
        : patch.goal_id,
    type: patch.type ?? String(current.type),
    description: patch.description ?? String(current.description),
    notes: patch.notes === undefined ? (current.notes as string | null) : patch.notes,
    amount: patch.amount ?? toNumber(current.amount),
    currency: patch.currency ?? String(current.currency),
    default_currency: patch.default_currency ?? String(current.default_currency),
    exchange_rate: patch.exchange_rate ?? toNumber(current.exchange_rate),
    occurs_on: patch.occurs_on ?? String(current.occurs_on),
    attachment_path:
      patch.attachment_path === undefined
        ? (current.attachment_path as string | null)
        : patch.attachment_path,
    recurrence_frequency:
      patch.recurrence_frequency ?? String(current.recurrence_frequency),
    recurrence_interval: patch.recurrence_interval ?? toNumber(current.recurrence_interval),
    recurrence_end_date:
      patch.recurrence_end_date === undefined
        ? (current.recurrence_end_date as string | null)
        : patch.recurrence_end_date,
  }

  return validateMergedTransaction(candidate)
}

export default createAuthHandler(
  { methods: ['GET', 'PATCH', 'DELETE'] },
  async ({ req, res, supabase, userId, query }) => {
    const id = readId(req.query.id, req.url)

    const { data: current, error: currentError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle()

    if (currentError) {
      throw new AppError(
        500,
        `Falha ao carregar transação: ${currentError.message}`,
        undefined,
        'TRANSACTIONS_GET_FAILED',
      )
    }

    if (!current) {
      throw new NotFoundError('Transação não encontrada.')
    }

    if (req.method === 'GET') {
      await requireModulePermission(supabase, userId, 'transactions', 'view')
      jsonResponse(res, 200, { data: current })
      return
    }

    if (req.method === 'PATCH') {
      await requireModulePermission(supabase, userId, 'transactions', 'edit')

      const patch = transactionPatchSchema.parse(await parseJsonBody(req))
      const merged = mergeWithCurrent(current as Record<string, unknown>, patch)
      const conversion = ensureExchangeRate(merged)

      const payload = {
        ...merged,
        exchange_rate: conversion.exchange_rate,
        amount_in_default_currency: conversion.amount_in_default_currency,
        recurrence_end_date:
          merged.recurrence_frequency === 'none'
            ? null
            : (merged.recurrence_end_date ?? null),
      }

      const { data, error } = await supabase
        .from('transactions')
        .update(payload)
        .eq('user_id', userId)
        .eq('id', id)
        .select('*')
        .single()

      if (error) {
        throw new AppError(
          400,
          `Falha ao atualizar transação: ${error.message}`,
          undefined,
          'TRANSACTIONS_UPDATE_FAILED',
        )
      }

      jsonResponse(res, 200, { data })
      return
    }

    await requireModulePermission(supabase, userId, 'transactions', 'delete')

    const shouldDeleteGroup =
      query.get('scope') === 'installment_group' &&
      Boolean(current.installment_group_id)

    let dbQuery = supabase.from('transactions').delete().eq('user_id', userId)

    if (shouldDeleteGroup) {
      dbQuery = dbQuery.eq(
        'installment_group_id',
        String(current.installment_group_id),
      )
    } else {
      dbQuery = dbQuery.eq('id', id)
    }

    const { data, error } = await dbQuery.select('id')

    if (error) {
      throw new AppError(
        400,
        `Falha ao excluir transação: ${error.message}`,
        undefined,
        'TRANSACTIONS_DELETE_FAILED',
      )
    }

    jsonResponse(res, 200, {
      deleted: true,
      deleted_count: data?.length ?? 0,
      scope: shouldDeleteGroup ? 'installment_group' : 'single',
    })
  },
)
