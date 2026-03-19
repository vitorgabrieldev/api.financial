import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { LuPencilLine, LuPlus, LuTrash2 } from 'react-icons/lu'
import { AccessDenied } from '../components/AccessDenied'
import { AppModal } from '../components/AppModal'
import { PageSkeleton } from '../components/PageSkeleton'
import { Panel } from '../components/Panel'
import { CustomDateInput } from '../components/fields/CustomDateInput'
import { CustomSelect } from '../components/fields/CustomSelect'
import { currencyOptions, normalizeCurrency } from '../lib/currencyOptions'
import { fetchGoals } from '../lib/db'
import { formatCurrency } from '../lib/format'
import { getGoalStatusLabel } from '../lib/labels'
import { maskCurrencyInput, parseCurrencyInput } from '../lib/masks/valueMask'
import { supabase } from '../lib/supabase'
import type { Goal, GoalStatus, UserPreferences } from '../types/finance'

interface GoalsPageProps {
  userId: string
  preferences: UserPreferences
  moduleAccess: {
    can_view: boolean
    can_list: boolean
    can_create: boolean
    can_edit: boolean
    can_delete: boolean
  }
}

const statusOptions: GoalStatus[] = ['active', 'achieved', 'paused', 'cancelled']

const formatMoneyInput = (value: number): string =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)

export const GoalsPage = ({
  userId,
  preferences,
  moduleAccess,
}: GoalsPageProps) => {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [currentAmount, setCurrentAmount] = useState('')
  const [currency, setCurrency] = useState(
    normalizeCurrency(preferences.default_currency),
  )
  const [targetDate, setTargetDate] = useState('')
  const [notes, setNotes] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [editName, setEditName] = useState('')
  const [editTargetAmount, setEditTargetAmount] = useState('')
  const [editCurrentAmount, setEditCurrentAmount] = useState('')
  const [editCurrency, setEditCurrency] = useState(
    normalizeCurrency(preferences.default_currency),
  )
  const [editTargetDate, setEditTargetDate] = useState('')
  const [editStatus, setEditStatus] = useState<GoalStatus>('active')
  const [editNotes, setEditNotes] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const data = await fetchGoals(userId)
      setGoals(data)
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Erro ao carregar metas.',
      )
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setCurrency(normalizeCurrency(preferences.default_currency))
  }, [preferences.default_currency])

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!moduleAccess.can_create) {
      setError('Seu perfil não possui permissão para criar metas.')
      return
    }
    setSaving(true)
    setError('')

    const { error: insertError } = await supabase.from('goals').insert({
      user_id: userId,
      name: name.trim(),
      target_amount: parseCurrencyInput(targetAmount),
      current_amount: parseCurrencyInput(currentAmount),
      currency: currency.toUpperCase(),
      target_date: targetDate || null,
      notes: notes || null,
    })

    setSaving(false)
    if (insertError) {
      setError(insertError.message)
      return
    }

    setName('')
    setTargetAmount('')
    setCurrentAmount('')
    setTargetDate('')
    setNotes('')
    setIsCreateModalOpen(false)
    await load()
  }

  const handleStatusChange = async (goalId: string, status: GoalStatus) => {
    if (!moduleAccess.can_edit) {
      setError('Seu perfil não possui permissão para editar metas.')
      return
    }
    const { error: updateError } = await supabase
      .from('goals')
      .update({ status })
      .eq('id', goalId)

    if (updateError) {
      setError(updateError.message)
      return
    }

    await load()
  }

  const handleContribution = async (goal: Goal, delta: number) => {
    if (!moduleAccess.can_edit) {
      setError('Seu perfil não possui permissão para editar metas.')
      return
    }
    const nextCurrentAmount = Math.max(0, Number(goal.current_amount) + delta)
    const { error: updateError } = await supabase
      .from('goals')
      .update({ current_amount: nextCurrentAmount })
      .eq('id', goal.id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    await load()
  }

  const handleDelete = async (goalId: string) => {
    if (!moduleAccess.can_delete) {
      setError('Seu perfil não possui permissão para excluir metas.')
      return
    }
    const { error: deleteError } = await supabase.from('goals').delete().eq('id', goalId)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    await load()
  }

  const handleStartEdit = (goal: Goal) => {
    setEditingGoal(goal)
    setEditName(goal.name)
    setEditTargetAmount(formatMoneyInput(Number(goal.target_amount) || 0))
    setEditCurrentAmount(formatMoneyInput(Number(goal.current_amount) || 0))
    setEditCurrency(normalizeCurrency(goal.currency))
    setEditTargetDate(goal.target_date || '')
    setEditStatus(goal.status)
    setEditNotes(goal.notes || '')
    setIsEditModalOpen(true)
  }

  const handleEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!moduleAccess.can_edit) {
      setError('Seu perfil não possui permissão para editar metas.')
      return
    }
    if (!editingGoal) return

    setSaving(true)
    setError('')

    const { error: updateError } = await supabase
      .from('goals')
      .update({
        name: editName.trim(),
        target_amount: parseCurrencyInput(editTargetAmount),
        current_amount: parseCurrencyInput(editCurrentAmount),
        currency: editCurrency,
        target_date: editTargetDate || null,
        status: editStatus,
        notes: editNotes || null,
      })
      .eq('id', editingGoal.id)

    setSaving(false)
    if (updateError) {
      setError(updateError.message)
      return
    }

    setIsEditModalOpen(false)
    setEditingGoal(null)
    await load()
  }

  if (!moduleAccess.can_view) return <AccessDenied moduleLabel="Metas" />
  if (loading) return <PageSkeleton cards={1} lines={6} withForm withTable />

  return (
    <div className="grid gap-4">
      {error ? (
        <p className="border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {moduleAccess.can_list ? (
        <Panel
          title="Metas cadastradas"
          actions={
            moduleAccess.can_create ? (
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-2 border border-primary bg-primary px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-white transition hover:bg-primary-dark"
              >
                <LuPlus className="h-3.5 w-3.5" />
                Nova meta
              </button>
            ) : null
          }
        >
          <div className="grid gap-3">
            {goals.map((goal) => {
              const progress =
                Number(goal.target_amount) > 0
                  ? Math.min(
                      100,
                      (Number(goal.current_amount) / Number(goal.target_amount)) * 100,
                    )
                  : 0

              return (
                <article key={goal.id} className="border border-border bg-white/80 p-3">
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-ink">{goal.name}</h3>
                      <p className="text-sm text-muted">
                        {formatCurrency(
                          Number(goal.current_amount),
                          goal.currency,
                          preferences.locale,
                        )}{' '}
                        /{' '}
                        {formatCurrency(
                          Number(goal.target_amount),
                          goal.currency,
                          preferences.locale,
                        )}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={!moduleAccess.can_edit}
                        onClick={() => handleStartEdit(goal)}
                        className="inline-flex items-center gap-1 border border-border px-2 py-1 text-xs text-muted transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed"
                      >
                        <LuPencilLine className="h-3.5 w-3.5" />
                        Editar
                      </button>
                      <CustomSelect
                        value={goal.status}
                        onChange={(event) =>
                          void handleStatusChange(
                            goal.id,
                            event.target.value as GoalStatus,
                          )
                        }
                        className="!h-9 !py-0"
                        disabled={!moduleAccess.can_edit}
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {getGoalStatusLabel(status)}
                          </option>
                        ))}
                      </CustomSelect>
                      <button
                        type="button"
                        disabled={!moduleAccess.can_delete}
                        onClick={() => void handleDelete(goal.id)}
                        className="inline-flex items-center gap-1 border border-border px-2 py-1 text-xs text-muted transition hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed"
                      >
                        <LuTrash2 className="h-3.5 w-3.5" />
                        Remover
                      </button>
                    </div>
                  </div>

                  <div className="mb-2 h-2 bg-neutral-200">
                    <div className="h-2 bg-primary" style={{ width: `${progress}%` }} />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={!moduleAccess.can_edit}
                      onClick={() => void handleContribution(goal, 100)}
                      className="inline-flex items-center gap-1 border border-border px-2 py-1 text-xs text-muted transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed"
                    >
                      <LuPencilLine className="h-3.5 w-3.5" />
                      +100
                    </button>
                    <button
                      type="button"
                      disabled={!moduleAccess.can_edit}
                      onClick={() => void handleContribution(goal, -100)}
                      className="inline-flex items-center gap-1 border border-border px-2 py-1 text-xs text-muted transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed"
                    >
                      <LuPencilLine className="h-3.5 w-3.5" />
                      -100
                    </button>
                  </div>
                </article>
              )
            })}

            {goals.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma meta cadastrada.</p>
            ) : null}
          </div>
        </Panel>
      ) : (
        <AccessDenied moduleLabel="Listagem de metas" />
      )}

      {moduleAccess.can_create ? (
        <AppModal
          open={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Nova meta"
          subtitle="Planejamento de objetivos financeiros"
          maxWidthClassName="max-w-2xl"
        >
          <form onSubmit={handleCreate} className="grid gap-3 lg:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-muted">Nome</span>
              <input
                required
                minLength={3}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="input"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Moeda</span>
              <CustomSelect
                value={currency}
                onChange={(event) => setCurrency(normalizeCurrency(event.target.value))}
              >
                {currencyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </CustomSelect>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Valor-alvo</span>
              <input
                required
                value={targetAmount}
                onChange={(event) =>
                  setTargetAmount(maskCurrencyInput(event.target.value))
                }
                placeholder="0,00"
                className="input"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Valor atual</span>
              <input
                value={currentAmount}
                onChange={(event) =>
                  setCurrentAmount(maskCurrencyInput(event.target.value))
                }
                placeholder="0,00"
                className="input"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Data-alvo</span>
              <CustomDateInput
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Observações</span>
              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="input"
              />
            </label>

            <div className="lg:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="border border-primary bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
              >
                {saving ? 'Salvando...' : 'Criar meta'}
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

      {moduleAccess.can_edit && editingGoal ? (
        <AppModal
          open={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Editar meta"
          subtitle="Atualize os dados da meta financeira"
          maxWidthClassName="max-w-2xl"
        >
          <form onSubmit={handleEdit} className="grid gap-3 lg:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-muted">Nome</span>
              <input
                required
                minLength={3}
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                className="input"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Moeda</span>
              <CustomSelect
                value={editCurrency}
                onChange={(event) =>
                  setEditCurrency(normalizeCurrency(event.target.value))
                }
              >
                {currencyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </CustomSelect>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Valor-alvo</span>
              <input
                required
                value={editTargetAmount}
                onChange={(event) =>
                  setEditTargetAmount(maskCurrencyInput(event.target.value))
                }
                placeholder="0,00"
                className="input"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Valor atual</span>
              <input
                value={editCurrentAmount}
                onChange={(event) =>
                  setEditCurrentAmount(maskCurrencyInput(event.target.value))
                }
                placeholder="0,00"
                className="input"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Data-alvo</span>
              <CustomDateInput
                value={editTargetDate}
                onChange={(event) => setEditTargetDate(event.target.value)}
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Status</span>
              <CustomSelect
                value={editStatus}
                onChange={(event) => setEditStatus(event.target.value as GoalStatus)}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {getGoalStatusLabel(status)}
                  </option>
                ))}
              </CustomSelect>
            </label>

            <label className="grid gap-1 text-sm lg:col-span-2">
              <span className="text-muted">Observações</span>
              <input
                value={editNotes}
                onChange={(event) => setEditNotes(event.target.value)}
                className="input"
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
