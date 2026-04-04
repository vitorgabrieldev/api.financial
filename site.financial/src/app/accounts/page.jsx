import { AppShell } from '@/components/app-shell'
import { AccountsPanel } from '@/components/modules/accounts-panel'

export default function AccountsPage() {
  return (
    <AppShell title="Contas" subtitle="Cadastro, edição, remoção e busca de contas financeiras.">
      <AccountsPanel />
    </AppShell>
  )
}
