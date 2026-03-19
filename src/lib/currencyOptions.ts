export const supportedCurrencies = ['BRL', 'USD', 'EUR', 'JPY'] as const

export type SupportedCurrency = (typeof supportedCurrencies)[number]

export const currencyOptions: Array<{ value: SupportedCurrency; label: string }> = [
  { value: 'BRL', label: 'Real brasileiro (BRL)' },
  { value: 'USD', label: 'Dólar americano (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'JPY', label: 'Iene japonês (JPY)' },
]

export const isSupportedCurrency = (value: string): value is SupportedCurrency =>
  supportedCurrencies.includes(value.toUpperCase() as SupportedCurrency)

export const normalizeCurrency = (
  value: string,
  fallback: SupportedCurrency = 'BRL',
): SupportedCurrency => {
  const normalized = value.toUpperCase()
  if (isSupportedCurrency(normalized)) return normalized
  return fallback
}

