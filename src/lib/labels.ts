import type { AccountType, CategoryKind, GoalStatus, TransactionType } from '../types/finance'

export const transactionTypeLabels: Record<TransactionType, string> = {
  income: 'Receita',
  expense: 'Despesa',
  transfer: 'Transferência',
}

export const categoryKindLabels: Record<CategoryKind, string> = {
  income: 'Receita',
  expense: 'Despesa',
}

export const accountTypeLabels: Record<AccountType, string> = {
  checking: 'Conta corrente',
  savings: 'Poupança',
  cash: 'Carteira',
  credit: 'Cartão de crédito',
  investment: 'Investimento',
  other: 'Outro',
}

export const goalStatusLabels: Record<GoalStatus, string> = {
  active: 'Ativa',
  achieved: 'Concluída',
  paused: 'Pausada',
  cancelled: 'Cancelada',
}

export const getTransactionTypeLabel = (type: TransactionType): string =>
  transactionTypeLabels[type]

export const getCategoryKindLabel = (kind: CategoryKind): string =>
  categoryKindLabels[kind]

export const getAccountTypeLabel = (type: AccountType): string => accountTypeLabels[type]

export const getGoalStatusLabel = (status: GoalStatus): string => goalStatusLabels[status]

