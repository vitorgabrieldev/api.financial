import { describe, expect, it } from 'vitest'
import { isSupportedCurrency, normalizeCurrency } from './currencyOptions'

describe('currencyOptions', () => {
  it('normaliza moeda suportada para ISO em maiúsculo', () => {
    expect(normalizeCurrency('usd')).toBe('USD')
    expect(normalizeCurrency('brl')).toBe('BRL')
  })

  it('retorna fallback para moeda não suportada', () => {
    expect(normalizeCurrency('cad')).toBe('BRL')
    expect(normalizeCurrency('cad', 'EUR')).toBe('EUR')
  })

  it('valida moedas suportadas', () => {
    expect(isSupportedCurrency('JPY')).toBe(true)
    expect(isSupportedCurrency('ARS')).toBe(false)
  })
})

