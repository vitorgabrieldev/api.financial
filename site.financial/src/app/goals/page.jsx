import { AppShell } from '@/components/app-shell'
import { GoalsPanel } from '@/components/modules/goals-panel'

export default function GoalsPage() {
  return (
    <AppShell title="Metas" subtitle="Defina metas, acompanhe progresso e ajuste status.">
      <GoalsPanel />
    </AppShell>
  )
}
