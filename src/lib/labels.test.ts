import { describe, expect, it } from 'vitest'
import {
  getAccountTypeLabel,
  getCategoryKindLabel,
  getGoalStatusLabel,
  getTransactionTypeLabel,
} from './labels'

describe('labels', () => {
  it('traduz tipos de transação para PT-BR', () => {
    expect(getTransactionTypeLabel('income')).toBe('Receita')
    expect(getTransactionTypeLabel('expense')).toBe('Despesa')
    expect(getTransactionTypeLabel('transfer')).toBe('Transferência')
  })

  it('traduz tipo de conta e categoria', () => {
    expect(getAccountTypeLabel('checking')).toBe('Conta corrente')
    expect(getCategoryKindLabel('expense')).toBe('Despesa')
  })

  it('traduz status de meta', () => {
    expect(getGoalStatusLabel('active')).toBe('Ativa')
    expect(getGoalStatusLabel('cancelled')).toBe('Cancelada')
  })
})

