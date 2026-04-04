const number = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export const formatMoney = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '0,00'
  return number.format(value)
}

export const formatDate = (value) => {
  if (!value) return '-'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)

  return parsed.toLocaleDateString('pt-BR')
}
