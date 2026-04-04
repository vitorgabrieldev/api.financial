import { AppShell } from '@/components/app-shell'
import { CategoriesPanel } from '@/components/modules/categories-panel'

export default function CategoriesPage() {
  return (
    <AppShell title="Categorias" subtitle="Gerencie categorias de receita e despesa com CRUD completo.">
      <CategoriesPanel />
    </AppShell>
  )
}
