import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { LuDownload, LuPencilLine, LuPlus, LuTrash2 } from 'react-icons/lu'
import { AccountIdentity } from '../components/AccountIdentity'
import { AccessDenied } from '../components/AccessDenied'
import { AppModal } from '../components/AppModal'
import { PageSkeleton } from '../components/PageSkeleton'
import { Panel } from '../components/Panel'
import { CustomDateInput } from '../components/fields/CustomDateInput'
import { CustomFileUpload } from '../components/fields/CustomFileUpload'
import { CustomSelect } from '../components/fields/CustomSelect'
import { currencyOptions, normalizeCurrency } from '../lib/currencyOptions'
import {
  fetchAccounts,
  fetchCategories,
  fetchGoals,
  fetchTransactions,
} from '../lib/db'
import { formatCurrency, formatShortDate, toInputDate } from '../lib/format'
import { getExchangeRate } from '../lib/currency'
import { getTransactionTypeLabel } from '../lib/labels'
import { maskCurrencyInput, parseCurrencyInput } from '../lib/masks/valueMask'
import { supabase } from '../lib/supabase'
import { buildTransactionDates } from '../lib/transactions'
import type {
  Account,
  Category,
  Goal,
  RecurrenceFrequency,
  Transaction,
  TransactionType,
  UserPreferences,
} from '../types/finance'

interface TransactionsPageProps {
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

const recurrenceOptions: {
  value: RecurrenceFrequency
  label: string
}[] = [
  { value: 'none', label: 'Sem recorrência' },
  { value: 'daily', label: 'Diária' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'yearly', label: 'Anual' },
]

const sanitizeFileName = (name: string): string =>
  name.replace(/[^a-zA-Z0-9._-]/g, '_')

const formatMoneyInput = (value: number): string =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)

export const TransactionsPage = ({
  userId,
  preferences,
  moduleAccess,
}: TransactionsPageProps) => {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [type, setType] = useState<TransactionType>('expense')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(
    normalizeCurrency(preferences.default_currency),
  )
  const [accountId, setAccountId] = useState('')
  const [transferAccountId, setTransferAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [goalId, setGoalId] = useState('')
  const [occursOn, setOccursOn] = useState(toInputDate(new Date()))
  const [notes, setNotes] = useState('')
  const [recurrenceFrequency, setRecurrenceFrequency] =
    useState<RecurrenceFrequency>('none')
  const [recurrenceInterval, setRecurrenceInterval] = useState('1')
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('')
  const [installments, setInstallments] = useState('1')
  const [file, setFile] = useState<File | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [editType, setEditType] = useState<TransactionType>('expense')
  const [editDescription, setEditDescription] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editCurrency, setEditCurrency] = useState(
    normalizeCurrency(preferences.default_currency),
  )
  const [editAccountId, setEditAccountId] = useState('')
  const [editTransferAccountId, setEditTransferAccountId] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editGoalId, setEditGoalId] = useState('')
  const [editOccursOn, setEditOccursOn] = useState(toInputDate(new Date()))
  const [editNotes, setEditNotes] = useState('')
  const [editFile, setEditFile] = useState<File | null>(null)
  const [removeCurrentReceipt, setRemoveCurrentReceipt] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [accountsData, categoriesData, goalsData, transactionsData] =
        await Promise.all([
          fetchAccounts(userId),
          fetchCategories(userId),
          fetchGoals(userId),
          fetchTransactions(userId, 400),
        ])

      setAccounts(accountsData)
      setCategories(categoriesData)
      setGoals(goalsData)
      setTransactions(transactionsData)

      setAccountId((current) => current || accountsData[0]?.id || '')
      setCategoryId((current) => {
        if (current) return current
        const fallbackCategory =
          categoriesData.find((item) => item.kind === 'expense') ?? categoriesData[0]
        return fallbackCategory?.id || ''
      })
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Erro ao carregar transações.',
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

  const availableCategories = useMemo(() => {
    if (type === 'transfer') return []
    const kind = type === 'income' ? 'income' : 'expense'
    return categories.filter((item) => item.kind === kind)
  }, [categories, type])

  const availableEditCategories = useMemo(() => {
    if (editType === 'transfer') return []
    const kind = editType === 'income' ? 'income' : 'expense'
    return categories.filter((item) => item.kind === kind)
  }, [categories, editType])

  useEffect(() => {
    if (availableCategories.length > 0) {
      setCategoryId(availableCategories[0].id)
    } else {
      setCategoryId('')
    }
  }, [availableCategories])

  useEffect(() => {
    if (!isEditModalOpen) return
    if (editType === 'transfer') {
      setEditCategoryId('')
      return
    }
    if (
      editCategoryId &&
      availableEditCategories.some((category) => category.id === editCategoryId)
    ) {
      return
    }
    setEditCategoryId(availableEditCategories[0]?.id ?? '')
  }, [availableEditCategories, editCategoryId, editType, isEditModalOpen])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!moduleAccess.can_create) {
      setError('Seu perfil não possui permissão para criar transações.')
      return
    }
    setSaving(true)
    setError('')

    const parsedAmount = parseCurrencyInput(amount)
    const parsedInstallments = Math.max(1, Number(installments))
    const parsedRecurrenceInterval = Math.max(1, Number(recurrenceInterval))

    if (!accountId) {
      setError('Selecione uma conta.')
      setSaving(false)
      return
    }

    if (type === 'transfer' && (!transferAccountId || transferAccountId === accountId)) {
      setError('Selecione uma conta de destino diferente para a transferência.')
      setSaving(false)
      return
    }

    if (type !== 'transfer' && !categoryId) {
      setError('Selecione uma categoria.')
      setSaving(false)
      return
    }

    if (recurrenceFrequency !== 'none' && !recurrenceEndDate && parsedInstallments <= 1) {
      setError('Informe a data final para recorrência.')
      setSaving(false)
      return
    }

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Valor inválido.')
      setSaving(false)
      return
    }

    let attachmentPath: string | null = null

    if (file) {
      const path = `${userId}/${Date.now()}-${sanitizeFileName(file.name)}`
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(path, file)

      if (uploadError) {
        setError(uploadError.message)
        setSaving(false)
        return
      }

      attachmentPath = path
    }

    try {
      const rate = await getExchangeRate(currency, preferences.default_currency)
      const transactionDates = buildTransactionDates({
        startDate: occursOn,
        installments: parsedInstallments,
        recurrenceFrequency,
        recurrenceInterval: parsedRecurrenceInterval,
        recurrenceEndDate,
      })

      const installmentGroupId = parsedInstallments > 1 ? crypto.randomUUID() : null

      const payload = transactionDates.map((date, index) => ({
        user_id: userId,
        account_id: accountId,
        transfer_account_id: type === 'transfer' ? transferAccountId : null,
        category_id: type === 'transfer' ? null : categoryId,
        goal_id: goalId || null,
        type,
        description: description.trim(),
        notes: notes || null,
        amount: parsedAmount,
        currency: currency.toUpperCase(),
        amount_in_default_currency: Number((parsedAmount * rate).toFixed(2)),
        default_currency: preferences.default_currency,
        exchange_rate: rate,
        occurs_on: date,
        attachment_path: attachmentPath,
        recurrence_frequency: parsedInstallments > 1 ? 'none' : recurrenceFrequency,
        recurrence_interval:
          parsedInstallments > 1
            ? 1
            : recurrenceFrequency === 'none'
              ? 1
              : parsedRecurrenceInterval,
        recurrence_end_date:
          parsedInstallments > 1 || recurrenceFrequency === 'none'
            ? null
            : recurrenceEndDate,
        installment_group_id: installmentGroupId,
        installment_number: parsedInstallments > 1 ? index + 1 : null,
        installment_total: parsedInstallments > 1 ? parsedInstallments : null,
      }))

      const { error: insertError } = await supabase.from('transactions').insert(payload)
      if (insertError) {
        setError(insertError.message)
        return
      }

      setDescription('')
      setAmount('')
      setTransferAccountId('')
      setGoalId('')
      setNotes('')
      setRecurrenceFrequency('none')
      setRecurrenceInterval('1')
      setRecurrenceEndDate('')
      setInstallments('1')
      setFile(null)
      setIsCreateModalOpen(false)

      await load()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Falha ao salvar transação.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (item: Transaction) => {
    if (!moduleAccess.can_delete) {
      setError('Seu perfil não possui permissão para excluir transações.')
      return
    }
    const { error: deleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('id', item.id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }

    if (item.attachment_path) {
      await supabase.storage.from('receipts').remove([item.attachment_path])
    }

    await load()
  }

  const handleStartEdit = (item: Transaction) => {
    setEditingTransaction(item)
    setEditType(item.type)
    setEditDescription(item.description)
    setEditAmount(formatMoneyInput(Number(item.amount) || 0))
    setEditCurrency(normalizeCurrency(item.currency))
    setEditAccountId(item.account_id)
    setEditTransferAccountId(item.transfer_account_id || '')
    setEditCategoryId(item.category_id || '')
    setEditGoalId(item.goal_id || '')
    setEditOccursOn(item.occurs_on)
    setEditNotes(item.notes || '')
    setEditFile(null)
    setRemoveCurrentReceipt(false)
    setIsEditModalOpen(true)
  }

  const handleEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!moduleAccess.can_edit) {
      setError('Seu perfil não possui permissão para editar transações.')
      return
    }
    if (!editingTransaction) return

    setSaving(true)
    setError('')

    const parsedAmount = parseCurrencyInput(editAmount)

    if (!editAccountId) {
      setError('Selecione uma conta.')
      setSaving(false)
      return
    }

    if (
      editType === 'transfer' &&
      (!editTransferAccountId || editTransferAccountId === editAccountId)
    ) {
      setError('Selecione uma conta de destino diferente para a transferência.')
      setSaving(false)
      return
    }

    if (editType !== 'transfer' && !editCategoryId) {
      setError('Selecione uma categoria.')
      setSaving(false)
      return
    }

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Valor inválido.')
      setSaving(false)
      return
    }

    const oldAttachmentPath = editingTransaction.attachment_path
    let nextAttachmentPath = removeCurrentReceipt ? null : oldAttachmentPath

    if (editFile) {
      const path = `${userId}/${Date.now()}-${sanitizeFileName(editFile.name)}`
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(path, editFile)

      if (uploadError) {
        setError(uploadError.message)
        setSaving(false)
        return
      }

      nextAttachmentPath = path
    }

    try {
      const rate = await getExchangeRate(editCurrency, preferences.default_currency)

      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          account_id: editAccountId,
          transfer_account_id: editType === 'transfer' ? editTransferAccountId : null,
          category_id: editType === 'transfer' ? null : editCategoryId,
          goal_id: editGoalId || null,
          type: editType,
          description: editDescription.trim(),
          notes: editNotes || null,
          amount: parsedAmount,
          currency: editCurrency,
          amount_in_default_currency: Number((parsedAmount * rate).toFixed(2)),
          default_currency: preferences.default_currency,
          exchange_rate: rate,
          occurs_on: editOccursOn,
          attachment_path: nextAttachmentPath,
        })
        .eq('id', editingTransaction.id)

      if (updateError) {
        if (editFile && nextAttachmentPath) {
          await supabase.storage.from('receipts').remove([nextAttachmentPath])
        }
        setError(updateError.message)
        return
      }

      if (
        oldAttachmentPath &&
        (removeCurrentReceipt || (editFile && nextAttachmentPath !== oldAttachmentPath))
      ) {
        await supabase.storage.from('receipts').remove([oldAttachmentPath])
      }

      setIsEditModalOpen(false)
      setEditingTransaction(null)
      await load()
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Falha ao atualizar transação.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleOpenReceipt = async (path: string) => {
    const { data, error: signedUrlError } = await supabase.storage
      .from('receipts')
      .createSignedUrl(path, 60)

    if (signedUrlError || !data?.signedUrl) {
      setError(signedUrlError?.message || 'Não foi possível abrir o comprovante.')
      return
    }

    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  if (!moduleAccess.can_view) return <AccessDenied moduleLabel="Transações" />
  if (loading) return <PageSkeleton cards={1} lines={8} withForm withTable />

  const accountMap = new Map(accounts.map((account) => [account.id, account]))
  const categoryMap = new Map(categories.map((category) => [category.id, category]))

  return (
    <div className="grid gap-4">
      {error ? (
        <p className="border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {moduleAccess.can_list ? (
        <Panel
          title="Histórico"
          subtitle="Lançamentos mais recentes"
          actions={
            moduleAccess.can_create ? (
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-2 border border-primary bg-primary px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-white transition hover:bg-primary-dark"
              >
                <LuPlus className="h-3.5 w-3.5" />
                Nova transação
              </button>
            ) : null
          }
        >
          <div className="overflow-auto">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-[0.14em] text-muted">
                  <th className="pb-2 pr-2">Data</th>
                  <th className="pb-2 pr-2">Descrição</th>
                  <th className="pb-2 pr-2">Conta</th>
                  <th className="pb-2 pr-2">Categoria</th>
                  <th className="pb-2 pr-2">Tipo</th>
                  <th className="pb-2 pr-2 text-right">Valor</th>
                  <th className="pb-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((item) => (
                  <tr key={item.id} className="border-b border-border/60">
                    <td className="py-3 pr-2 text-muted">
                      {formatShortDate(item.occurs_on, preferences.locale)}
                    </td>
                    <td className="py-3 pr-2 text-ink">{item.description}</td>
                    <td className="py-3 pr-2 text-ink">
                      <AccountIdentity account={accountMap.get(item.account_id) ?? null} compact />
                    </td>
                    <td className="py-3 pr-2 text-muted">
                      {item.type === 'transfer'
                        ? 'Transferência'
                        : (categoryMap.get(item.category_id ?? '')?.name ?? '-')}
                    </td>
                    <td className="py-3 pr-2 text-muted">
                      {getTransactionTypeLabel(item.type)}
                    </td>
                    <td className="py-3 pr-2 text-right font-medium text-ink">
                      {formatCurrency(item.amount, item.currency, preferences.locale)}
                    </td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!moduleAccess.can_edit}
                          onClick={() => handleStartEdit(item)}
                          className="inline-flex items-center gap-1 border border-border px-2 py-1 text-xs text-muted transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed"
                        >
                          <LuPencilLine className="h-3.5 w-3.5" />
                          Editar
                        </button>
                        {item.attachment_path ? (
                          <button
                            type="button"
                            onClick={() => void handleOpenReceipt(item.attachment_path!)}
                            className="inline-flex items-center gap-1 border border-border px-2 py-1 text-xs text-muted transition hover:border-primary/50 hover:text-primary"
                          >
                            <LuDownload className="h-3.5 w-3.5" />
                            Comprovante
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={!moduleAccess.can_delete}
                          onClick={() => void handleDelete(item)}
                          className="inline-flex items-center gap-1 border border-border px-2 py-1 text-xs text-muted transition hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed"
                        >
                          <LuTrash2 className="h-3.5 w-3.5" />
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-muted">
                      Nenhuma transação cadastrada.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : (
        <AccessDenied moduleLabel="Histórico de transações" />
      )}

      {moduleAccess.can_create ? (
        <AppModal
          open={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Nova transação"
          subtitle="Com recorrência, parcelamento e conversão de moeda"
          maxWidthClassName="max-w-5xl"
        >
          <form onSubmit={handleSubmit} className="grid gap-3 lg:grid-cols-3">
            <label className="grid gap-1 text-sm">
              <span className="text-muted">Tipo</span>
              <CustomSelect
                value={type}
                onChange={(event) => setType(event.target.value as TransactionType)}
              >
                <option value="expense">Despesa</option>
                <option value="income">Receita</option>
                <option value="transfer">Transferência</option>
              </CustomSelect>
            </label>

            <label className="grid gap-1 text-sm lg:col-span-2">
              <span className="text-muted">Descrição</span>
              <input
                required
                minLength={2}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="input"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Valor</span>
              <input
                required
                value={amount}
                onChange={(event) => setAmount(maskCurrencyInput(event.target.value))}
                placeholder="0,00"
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
              <span className="text-muted">Data</span>
              <CustomDateInput
                value={occursOn}
                onChange={(event) => setOccursOn(event.target.value)}
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Conta de origem</span>
              <CustomSelect
                required
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
              >
                <option value="">Selecione</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </CustomSelect>
              {accountId ? (
                <span className="text-xs text-muted">
                  <AccountIdentity account={accountMap.get(accountId) ?? null} compact />
                </span>
              ) : null}
            </label>

            {type === 'transfer' ? (
              <label className="grid gap-1 text-sm">
                <span className="text-muted">Conta de destino</span>
                <CustomSelect
                  required
                  value={transferAccountId}
                  onChange={(event) => setTransferAccountId(event.target.value)}
                >
                  <option value="">Selecione</option>
                  {accounts
                    .filter((account) => account.id !== accountId)
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                </CustomSelect>
                {transferAccountId ? (
                  <span className="text-xs text-muted">
                    <AccountIdentity
                      account={accountMap.get(transferAccountId) ?? null}
                      compact
                    />
                  </span>
                ) : null}
              </label>
            ) : (
              <label className="grid gap-1 text-sm">
                <span className="text-muted">Categoria</span>
                <CustomSelect
                  required
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  {availableCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </CustomSelect>
              </label>
            )}

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Meta (opcional)</span>
              <CustomSelect value={goalId} onChange={(event) => setGoalId(event.target.value)}>
                <option value="">Nenhuma</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.name}
                  </option>
                ))}
              </CustomSelect>
            </label>

            <label className="grid gap-1 text-sm lg:col-span-3">
              <span className="text-muted">Observações</span>
              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="input"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Parcelas</span>
              <input
                type="text"
                value={installments}
                onChange={(event) =>
                  setInstallments(event.target.value.replace(/\D/g, '').slice(0, 3))
                }
                placeholder="1"
                className="input"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Recorrência</span>
              <CustomSelect
                value={recurrenceFrequency}
                onChange={(event) =>
                  setRecurrenceFrequency(event.target.value as RecurrenceFrequency)
                }
                disabled={Number(installments || '1') > 1}
              >
                {recurrenceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </CustomSelect>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Intervalo</span>
              <input
                type="text"
                value={recurrenceInterval}
                onChange={(event) =>
                  setRecurrenceInterval(event.target.value.replace(/\D/g, '').slice(0, 3))
                }
                disabled={recurrenceFrequency === 'none' || Number(installments || '1') > 1}
                className="input"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Recorrência até</span>
              <CustomDateInput
                value={recurrenceEndDate}
                onChange={(event) => setRecurrenceEndDate(event.target.value)}
                disabled={recurrenceFrequency === 'none' || Number(installments || '1') > 1}
              />
            </label>

            <label className="grid gap-1 text-sm lg:col-span-2">
              <span className="text-muted">Comprovante (opcional)</span>
              <CustomFileUpload
                value={file}
                onChange={setFile}
                accept=".png,.jpg,.jpeg,.webp,.pdf"
                placeholder="Clique para anexar arquivo"
              />
            </label>

            <div className="lg:col-span-3">
              <button
                type="submit"
                disabled={saving}
                className="border border-primary bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
              >
                {saving ? 'Salvando...' : 'Registrar transação'}
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

      {moduleAccess.can_edit && editingTransaction ? (
        <AppModal
          open={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Editar transação"
          subtitle="Atualize os dados do lançamento"
          maxWidthClassName="max-w-5xl"
        >
          <form onSubmit={handleEdit} className="grid gap-3 lg:grid-cols-3">
            <label className="grid gap-1 text-sm">
              <span className="text-muted">Tipo</span>
              <CustomSelect
                value={editType}
                onChange={(event) => setEditType(event.target.value as TransactionType)}
              >
                <option value="expense">Despesa</option>
                <option value="income">Receita</option>
                <option value="transfer">Transferência</option>
              </CustomSelect>
            </label>

            <label className="grid gap-1 text-sm lg:col-span-2">
              <span className="text-muted">Descrição</span>
              <input
                required
                minLength={2}
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                className="input"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Valor</span>
              <input
                required
                value={editAmount}
                onChange={(event) => setEditAmount(maskCurrencyInput(event.target.value))}
                placeholder="0,00"
                className="input"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Moeda</span>
              <CustomSelect
                value={editCurrency}
                onChange={(event) => setEditCurrency(normalizeCurrency(event.target.value))}
              >
                {currencyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </CustomSelect>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Data</span>
              <CustomDateInput
                value={editOccursOn}
                onChange={(event) => setEditOccursOn(event.target.value)}
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Conta de origem</span>
              <CustomSelect
                required
                value={editAccountId}
                onChange={(event) => setEditAccountId(event.target.value)}
              >
                <option value="">Selecione</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </CustomSelect>
              {editAccountId ? (
                <span className="text-xs text-muted">
                  <AccountIdentity account={accountMap.get(editAccountId) ?? null} compact />
                </span>
              ) : null}
            </label>

            {editType === 'transfer' ? (
              <label className="grid gap-1 text-sm">
                <span className="text-muted">Conta de destino</span>
                <CustomSelect
                  required
                  value={editTransferAccountId}
                  onChange={(event) => setEditTransferAccountId(event.target.value)}
                >
                  <option value="">Selecione</option>
                  {accounts
                    .filter((account) => account.id !== editAccountId)
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                </CustomSelect>
              </label>
            ) : (
              <label className="grid gap-1 text-sm">
                <span className="text-muted">Categoria</span>
                <CustomSelect
                  required
                  value={editCategoryId}
                  onChange={(event) => setEditCategoryId(event.target.value)}
                >
                  {availableEditCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </CustomSelect>
              </label>
            )}

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Meta (opcional)</span>
              <CustomSelect
                value={editGoalId}
                onChange={(event) => setEditGoalId(event.target.value)}
              >
                <option value="">Nenhuma</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.name}
                  </option>
                ))}
              </CustomSelect>
            </label>

            <label className="grid gap-1 text-sm lg:col-span-3">
              <span className="text-muted">Observações</span>
              <input
                value={editNotes}
                onChange={(event) => setEditNotes(event.target.value)}
                className="input"
              />
            </label>

            {editingTransaction.attachment_path ? (
              <label className="inline-flex items-center gap-2 text-sm lg:col-span-3">
                <input
                  type="checkbox"
                  checked={removeCurrentReceipt}
                  onChange={(event) => setRemoveCurrentReceipt(event.target.checked)}
                  className="h-4 w-4 cursor-pointer"
                />
                <span className="text-muted">Remover comprovante atual</span>
              </label>
            ) : null}

            <label className="grid gap-1 text-sm lg:col-span-2">
              <span className="text-muted">Novo comprovante (opcional)</span>
              <CustomFileUpload
                value={editFile}
                onChange={setEditFile}
                accept=".png,.jpg,.jpeg,.webp,.pdf"
                placeholder="Anexe para substituir o comprovante"
              />
            </label>

            <div className="lg:col-span-3">
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
