import { AppShell } from '@/components/app-shell'
import { PreferencesPanel } from '@/components/modules/preferences-panel'

export default function PreferencesPage() {
  return (
    <AppShell title="Preferências" subtitle="Configurações globais de moeda, locale e sessão do usuário.">
      <PreferencesPanel />
    </AppShell>
  )
}
