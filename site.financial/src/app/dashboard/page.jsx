import { AppShell } from '@/components/app-shell'
import { DashboardPanel } from '@/components/modules/dashboard-panel'

export default function DashboardPage() {
  return (
    <AppShell title="Dashboard" subtitle="Visão consolidada para acompanhamento rápido.">
      <DashboardPanel />
    </AppShell>
  )
}
