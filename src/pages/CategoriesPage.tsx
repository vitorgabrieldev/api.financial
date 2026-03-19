import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { LuPencilLine, LuPlus, LuTrash2 } from 'react-icons/lu'
import { AccessDenied } from '../components/AccessDenied'
import { AppModal } from '../components/AppModal'
import { PageSkeleton } from '../components/PageSkeleton'
import { Panel } from '../components/Panel'
import { CustomIconPicker } from '../components/fields/CustomIconPicker'
import { CustomSelect } from '../components/fields/CustomSelect'
import { fetchCategories } from '../lib/db'
import { categoryIconOptions, getCategoryIcon } from '../lib/icons'
import { supabase } from '../lib/supabase'
import type { Category, CategoryKind } from '../types/finance'

interface CategoriesPageProps {
  userId: string
  moduleAccess: {
    can_view: boolean
    can_list: boolean
    can_create: boolean
    can_edit: boolean
    can_delete: boolean
  }
}

export const CategoriesPage = ({ userId, moduleAccess }: CategoriesPageProps) => {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [kind, setKind] = useState<CategoryKind>('expense')
  const [color, setColor] = useState('#9f2f2f')
  const [icon, setIcon] = useState(categoryIconOptions[0]?.value ?? 'LuTag')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [editName, setEditName] = useState('')
  const [editKind, setEditKind] = useState<CategoryKind>('expense')
  const [editColor, setEditColor] = useState('#9f2f2f')
  const [editIcon, setEditIcon] = useState(categoryIconOptions[0]?.value ?? 'LuTag')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const data = await fetchCategories(userId)
      setCategories(data)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Erro ao carregar categorias.',
      )
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!moduleAccess.can_create) {
      setError('Seu perfil não possui permissão para criar categorias.')
      return
    }
    setSaving(true)
    setError('')

    const { error: insertError } = await supabase.from('categories').insert({
      user_id: userId,
      name: name.trim(),
      kind,
      color,
      icon,
    })

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setName('')
    setIsCreateModalOpen(false)
    await load()
  }

  const handleDelete = async (categoryId: string) => {
    if (!moduleAccess.can_delete) {
      setError('Seu perfil não possui permissão para excluir categorias.')
      return
    }
    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    await load()
  }

  const handleStartEdit = (category: Category) => {
    setEditingCategory(category)
    setEditName(category.name)
    setEditKind(category.kind)
    setEditColor(category.color || '#9f2f2f')
    setEditIcon(category.icon || 'LuTag')
    setIsEditModalOpen(true)
  }

  const handleEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!moduleAccess.can_edit) {
      setError('Seu perfil não possui permissão para editar categorias.')
      return
    }
    if (!editingCategory) return

    setSaving(true)
    setError('')
    const { error: updateError } = await supabase
      .from('categories')
      .update({
        name: editName.trim(),
        kind: editKind,
        color: editColor,
        icon: editIcon,
      })
      .eq('id', editingCategory.id)

    setSaving(false)
    if (updateError) {
      setError(updateError.message)
      return
    }

    setIsEditModalOpen(false)
    setEditingCategory(null)
    await load()
  }

  if (!moduleAccess.can_view) return <AccessDenied moduleLabel="Categorias" />
  if (loading) return <PageSkeleton cards={1} lines={6} withForm withTable />

  const incomeCategories = categories.filter((item) => item.kind === 'income')
  const expenseCategories = categories.filter((item) => item.kind === 'expense')

  return (
    <div className="grid gap-4">
      {error ? (
        <p className="border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {moduleAccess.can_create ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 border border-primary bg-primary px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-white transition hover:bg-primary-dark"
          >
            <LuPlus className="h-3.5 w-3.5" />
            Nova categoria
          </button>
        </div>
      ) : null}

      {moduleAccess.can_list ? (
        <section className="grid gap-4 xl:grid-cols-2">
          <Panel title="Receitas">
            <div className="grid gap-2">
              {incomeCategories.map((category) => {
                const Icon = getCategoryIcon(category.icon)
                return (
                  <div
                    key={category.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border border-border bg-white/80 px-3 py-2"
                  >
                    <Icon
                      className="h-4 w-4"
                      style={{ color: category.color || '#9f2f2f' }}
                    />
                    <p className="text-sm text-ink">{category.name}</p>
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!moduleAccess.can_edit}
                        onClick={() => handleStartEdit(category)}
                        className="inline-flex items-center gap-1 border border-border px-2 py-1 text-xs text-muted transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <LuPencilLine className="h-3.5 w-3.5" />
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={category.is_system || !moduleAccess.can_delete}
                        onClick={() => void handleDelete(category.id)}
                        className="inline-flex items-center gap-1 border border-border px-2 py-1 text-xs text-muted transition hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <LuTrash2 className="h-3.5 w-3.5" />
                        Remover
                      </button>
                    </div>
                  </div>
                )
              })}
              {incomeCategories.length === 0 ? (
                <p className="text-sm text-muted">Sem categorias de receita.</p>
              ) : null}
            </div>
          </Panel>

          <Panel title="Despesas">
            <div className="grid gap-2">
              {expenseCategories.map((category) => {
                const Icon = getCategoryIcon(category.icon)
                return (
                  <div
                    key={category.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border border-border bg-white/80 px-3 py-2"
                  >
                    <Icon
                      className="h-4 w-4"
                      style={{ color: category.color || '#9f2f2f' }}
                    />
                    <p className="text-sm text-ink">{category.name}</p>
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!moduleAccess.can_edit}
                        onClick={() => handleStartEdit(category)}
                        className="inline-flex items-center gap-1 border border-border px-2 py-1 text-xs text-muted transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <LuPencilLine className="h-3.5 w-3.5" />
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={category.is_system || !moduleAccess.can_delete}
                        onClick={() => void handleDelete(category.id)}
                        className="inline-flex items-center gap-1 border border-border px-2 py-1 text-xs text-muted transition hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <LuTrash2 className="h-3.5 w-3.5" />
                        Remover
                      </button>
                    </div>
                  </div>
                )
              })}
              {expenseCategories.length === 0 ? (
                <p className="text-sm text-muted">Sem categorias de despesa.</p>
              ) : null}
            </div>
          </Panel>
        </section>
      ) : (
        <AccessDenied moduleLabel="Listagem de categorias" />
      )}

      {moduleAccess.can_create ? (
        <AppModal
          open={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Nova categoria"
          subtitle="Categorias editáveis para entradas e saídas"
          maxWidthClassName="max-w-2xl"
        >
          <form onSubmit={handleSubmit} className="grid gap-3 lg:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-muted">Nome</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={2}
                className="input"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Tipo</span>
              <CustomSelect
                value={kind}
                onChange={(event) => setKind(event.target.value as CategoryKind)}
              >
                <option value="expense">Despesa</option>
                <option value="income">Receita</option>
              </CustomSelect>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Cor</span>
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="h-11 w-full cursor-pointer border border-border bg-white p-1"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Ícone</span>
              <CustomIconPicker
                value={icon}
                options={categoryIconOptions}
                onChange={setIcon}
              />
            </label>

            <div className="lg:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="border border-primary bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
              >
                {saving ? 'Salvando...' : 'Criar categoria'}
              </button>
            </div>
          </form>

          {error ? (
            <p className="mt-3 border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}
        </AppModal>
      ) : null}

      {moduleAccess.can_edit && editingCategory ? (
        <AppModal
          open={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Editar categoria"
          subtitle="Atualize o nome, tipo, cor e ícone"
          maxWidthClassName="max-w-2xl"
        >
          <form onSubmit={handleEdit} className="grid gap-3 lg:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-muted">Nome</span>
              <input
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                required
                minLength={2}
                className="input"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Tipo</span>
              <CustomSelect
                value={editKind}
                onChange={(event) => setEditKind(event.target.value as CategoryKind)}
              >
                <option value="expense">Despesa</option>
                <option value="income">Receita</option>
              </CustomSelect>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Cor</span>
              <input
                type="color"
                value={editColor}
                onChange={(event) => setEditColor(event.target.value)}
                className="h-11 w-full cursor-pointer border border-border bg-white p-1"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Ícone</span>
              <CustomIconPicker
                value={editIcon}
                options={categoryIconOptions}
                onChange={setEditIcon}
              />
            </label>

            <div className="lg:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="border border-primary bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
              >
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </form>
        </AppModal>
      ) : null}
    </div>
  )
}
