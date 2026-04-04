import { AppShell } from '@/components/app-shell'
import { TransactionsPanel } from '@/components/modules/transactions-panel'

export default function TransactionsPage() {
  return (
    <AppShell title="Transações" subtitle="Cadastro, filtros e manutenção completa dos lançamentos financeiros.">
      <TransactionsPanel />
    </AppShell>
  )
}
