import type { IconType } from 'react-icons'
import {
  LuBookOpen,
  LuBriefcaseBusiness,
  LuBus,
  LuCircleEllipsis,
  LuGamepad2,
  LuHeartPulse,
  LuHouse,
  LuLaptop,
  LuPlus,
  LuReceiptText,
  LuTag,
  LuTrendingUp,
  LuUtensilsCrossed,
  LuWallet,
} from 'react-icons/lu'

export const categoryIconMap: Record<string, IconType> = {
  LuTag,
  LuWallet,
  LuBriefcaseBusiness,
  LuLaptop,
  LuTrendingUp,
  LuPlus,
  LuHouse,
  LuUtensilsCrossed,
  LuBus,
  LuHeartPulse,
  LuBookOpen,
  LuGamepad2,
  LuReceiptText,
  LuCircleEllipsis,
}

export const categoryIconOptions: Array<{ value: string; label: string }> = [
  { value: 'LuTag', label: 'Tag' },
  { value: 'LuWallet', label: 'Carteira' },
  { value: 'LuBriefcaseBusiness', label: 'Trabalho' },
  { value: 'LuLaptop', label: 'Freelance' },
  { value: 'LuTrendingUp', label: 'Investimentos' },
  { value: 'LuPlus', label: 'Outros ganhos' },
  { value: 'LuHouse', label: 'Moradia' },
  { value: 'LuUtensilsCrossed', label: 'Alimentação' },
  { value: 'LuBus', label: 'Transporte' },
  { value: 'LuHeartPulse', label: 'Saúde' },
  { value: 'LuBookOpen', label: 'Educação' },
  { value: 'LuGamepad2', label: 'Lazer' },
  { value: 'LuReceiptText', label: 'Contas e boletos' },
  { value: 'LuCircleEllipsis', label: 'Outros gastos' },
]

export const getCategoryIcon = (iconName?: string): IconType => {
  if (!iconName) return LuTag
  return categoryIconMap[iconName] ?? LuTag
}
