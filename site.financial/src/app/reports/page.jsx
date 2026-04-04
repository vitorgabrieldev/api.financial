import { AppShell } from '@/components/app-shell'
import { ReportsPanel } from '@/components/modules/reports-panel'

export default function ReportsPage() {
  return (
    <AppShell title="Relatórios" subtitle="Análise mensal e por categoria com intervalo customizável.">
      <ReportsPanel />
    </AppShell>
  )
}
