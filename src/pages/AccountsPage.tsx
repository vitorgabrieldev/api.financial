import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { LuPencilLine, LuPlus, LuTrash2 } from 'react-icons/lu'
import { AccountIdentity } from '../components/AccountIdentity'
import { AccessDenied } from '../components/AccessDenied'
import { AppModal } from '../components/AppModal'
import { PageSkeleton } from '../components/PageSkeleton'
import { Panel } from '../components/Panel'
import { CustomFileUpload } from '../components/fields/CustomFileUpload'
import { CustomSelect } from '../components/fields/CustomSelect'
import { currencyOptions, normalizeCurrency } from '../lib/currencyOptions'
import { fetchAccounts, fetchTransactions } from '../lib/db'
import { formatCurrency } from '../lib/format'
import { accountTypeLabels } from '../lib/labels'
import { maskCurrencyInput, parseCurrencyInput } from '../lib/masks/valueMask'
import { supabase } from '../lib/supabase'
import type {
  Account,
  AccountType,
  Transaction,
  UserPreferences,
} from '../types/finance'

interface AccountsPageProps {
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

const sanitizeFileName = (name: string): string =>
  name.replace(/[^a-zA-Z0-9._-]/g, '_')

const formatMoneyInput = (value: number): string =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)

const accountTypeOptions: { value: AccountType; label: string }[] = [
  { value: 'checking', label: accountTypeLabels.checking },
  { value: 'savings', label: accountTypeLabels.savings },
  { value: 'cash', label: accountTypeLabels.cash },
  { value: 'credit', label: accountTypeLabels.credit },
  { value: 'investment', label: accountTypeLabels.investment },
  { value: 'other', label: accountTypeLabels.other },
]

export const AccountsPage = ({
  userId,
  preferences,
  moduleAccess,
}: AccountsPageProps) => {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('checking')
  const [currency, setCurrency] = useState(
    normalizeCurrency(preferences.default_currency),
  )
  const [initialBalance, setInitialBalance] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState<AccountType>('checking')
  const [editCurrency, setEditCurrency] = useState(
    normalizeCurrency(preferences.default_currency),
  )
  const [editInitialBalance, setEditInitialBalance] = useState('')
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null)
  const [removeCurrentLogo, setRemoveCurrentLogo] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [accountsData, transactionsData] = await Promise.all([
        fetchAccounts(userId),
        fetchTransactions(userId, 500),
      ])
      setAccounts(accountsData)
      setTransactions(transactionsData)
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Erro ao carregar contas.',
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

  const balances = useMemo(() => {
    const accountMap: Record<string, number> = {}

    for (const account of accounts) {
      accountMap[account.id] = Number(account.initial_balance)
    }

    for (const item of transactions) {
      if (item.type === 'income') {
        accountMap[item.account_id] = (accountMap[item.account_id] ?? 0) + item.amount
      } else if (item.type === 'expense') {
        accountMap[item.account_id] = (accountMap[item.account_id] ?? 0) - item.amount
      } else if (item.type === 'transfer' && item.transfer_account_id) {
        accountMap[item.account_id] = (accountMap[item.account_id] ?? 0) - item.amount
        accountMap[item.transfer_account_id] =
          (accountMap[item.transfer_account_id] ?? 0) + item.amount
      }
    }

    return accountMap
  }, [accounts, transactions])

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!moduleAccess.can_create) {
      setError('Seu perfil não possui permissão para criar contas.')
      return
    }
    setSaving(true)
    setError('')

    let logoPath: string | null = null

    if (logoFile) {
      logoPath = `${userId}/${crypto.randomUUID()}-${sanitizeFileName(logoFile.name)}`
      const { error: uploadError } = await supabase.storage
        .from('account-logos')
        .upload(logoPath, logoFile, { upsert: false })

      if (uploadError) {
        setSaving(false)
        setError(uploadError.message)
        return
      }
    }

    const { error: insertError } = await supabase.from('accounts').insert({
      user_id: userId,
      name: name.trim(),
      type,
      currency,
      initial_balance: parseCurrencyInput(initialBalance),
      logo_path: logoPath,
    })

    setSaving(false)

    if (insertError) {
      if (logoPath) {
        await supabase.storage.from('account-logos').remove([logoPath])
      }
      setError(insertError.message)
      return
    }

    setName('')
    setInitialBalance('')
    setLogoFile(null)
    setIsCreateModalOpen(false)
    await load()
  }

  const handleDelete = async (account: Account) => {
    if (!moduleAccess.can_delete) {
      setError('Seu perfil não possui permissão para excluir contas.')
      return
    }
    const { error: deleteError } = await supabase
      .from('accounts')
      .delete()
      .eq('id', account.id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }

    if (account.logo_path) {
      await supabase.storage.from('account-logos').remove([account.logo_path])
    }

    await load()
  }

  const handleStartEdit = (account: Account) => {
    setEditingAccount(account)
    setEditName(account.name)
    setEditType(account.type)
    setEditCurrency(normalizeCurrency(account.currency))
    setEditInitialBalance(formatMoneyInput(Number(account.initial_balance) || 0))
    setEditLogoFile(null)
    setRemoveCurrentLogo(false)
    setIsEditModalOpen(true)
  }

  const handleEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!moduleAccess.can_edit) {
      setError('Seu perfil não possui permissão para editar contas.')
      return
    }
    if (!editingAccount) return

    setSaving(true)
    setError('')

    const oldLogoPath = editingAccount.logo_path
    let nextLogoPath = removeCurrentLogo ? null : oldLogoPath

    if (editLogoFile) {
      const uploadedPath = `${userId}/${crypto.randomUUID()}-${sanitizeFileName(editLogoFile.name)}`
      const { error: uploadError } = await supabase.storage
        .from('account-logos')
        .upload(uploadedPath, editLogoFile, { upsert: false })

      if (uploadError) {
        setSaving(false)
        setError(uploadError.message)
        return
      }

      nextLogoPath = uploadedPath
    }

    const { error: updateError } = await supabase
      .from('accounts')
      .update({
        name: editName.trim(),
        type: editType,
        currency: editCurrency,
        initial_balance: parseCurrencyInput(editInitialBalance),
        logo_path: nextLogoPath,
      })
      .eq('id', editingAccount.id)

    if (updateError) {
      if (editLogoFile && nextLogoPath) {
        await supabase.storage.from('account-logos').remove([nextLogoPath])
      }
      setSaving(false)
      setError(updateError.message)
      return
    }

    if (
      oldLogoPath &&
      (removeCurrentLogo || (editLogoFile && nextLogoPath !== oldLogoPath))
    ) {
      await supabase.storage.from('account-logos').remove([oldLogoPath])
    }

    setSaving(false)
    setIsEditModalOpen(false)
    setEditingAccount(null)
    await load()
  }

  if (!moduleAccess.can_view) return <AccessDenied moduleLabel="Contas" />
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
          title="Contas cadastradas"
          actions={
            moduleAccess.can_create ? (
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-2 border border-primary bg-primary px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-white transition hover:bg-primary-dark"
              >
                <LuPlus className="h-3.5 w-3.5" />
                Nova conta
              </button>
            ) : null
          }
        >
          <div className="grid gap-2">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border border-border bg-white/80 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-ink">
                    <AccountIdentity account={account} compact />
                  </p>
                  <p className="text-xs uppercase tracking-[0.14em] text-muted">
                    {accountTypeLabels[account.type]} - {account.currency}
                  </p>
                </div>
                <strong className="font-medium text-ink">
                  {formatCurrency(
                    balances[account.id] ?? Number(account.initial_balance),
                    account.currency,
                    preferences.locale,
                  )}
                </strong>
                <div className="inline-flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!moduleAccess.can_edit}
                    onClick={() => handleStartEdit(account)}
                    className="inline-flex items-center gap-1 border border-border px-2 py-1 text-xs text-muted transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed"
                  >
                    <LuPencilLine className="h-3.5 w-3.5" />
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={!moduleAccess.can_delete}
                    onClick={() => void handleDelete(account)}
                    className="inline-flex items-center gap-1 border border-border px-2 py-1 text-xs text-muted transition hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed"
                  >
                    <LuTrash2 className="h-3.5 w-3.5" />
                    Remover
                  </button>
                </div>
              </div>
            ))}

            {accounts.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma conta cadastrada.</p>
            ) : null}
          </div>
        </Panel>
      ) : (
        <AccessDenied moduleLabel="Listagem de contas" />
      )}

      {moduleAccess.can_create ? (
        <AppModal
          open={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Nova conta"
          subtitle="Controle por tipo de conta e moeda"
          maxWidthClassName="max-w-2xl"
        >
          <form onSubmit={handleCreate} className="grid gap-3 lg:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-muted">Nome da conta</span>
              <input
                required
                minLength={2}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="input"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Tipo</span>
              <CustomSelect
                value={type}
                onChange={(event) => setType(event.target.value as AccountType)}
              >
                {accountTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </CustomSelect>
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
              <span className="text-muted">Saldo inicial</span>
              <input
                type="text"
                value={initialBalance}
                onChange={(event) =>
                  setInitialBalance(maskCurrencyInput(event.target.value))
                }
                placeholder="0,00"
                className="input"
              />
            </label>

            <label className="grid gap-1 text-sm lg:col-span-2">
              <span className="text-muted">Logo do banco (opcional)</span>
              <CustomFileUpload
                value={logoFile}
                onChange={setLogoFile}
                accept=".png,.jpg,.jpeg,.webp,.svg"
                placeholder="Clique para anexar a logo"
              />
            </label>

            <div className="lg:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="border border-primary bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
              >
                {saving ? 'Salvando...' : 'Criar conta'}
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

      {moduleAccess.can_edit && editingAccount ? (
        <AppModal
          open={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Editar conta"
          subtitle="Atualize os dados da conta"
          maxWidthClassName="max-w-2xl"
        >
          <form onSubmit={handleEdit} className="grid gap-3 lg:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-muted">Nome da conta</span>
              <input
                required
                minLength={2}
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                className="input"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted">Tipo</span>
              <CustomSelect
                value={editType}
                onChange={(event) => setEditType(event.target.value as AccountType)}
              >
                {accountTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </CustomSelect>
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
              <span className="text-muted">Saldo inicial</span>
              <input
                type="text"
                value={editInitialBalance}
                onChange={(event) =>
                  setEditInitialBalance(maskCurrencyInput(event.target.value))
                }
                placeholder="0,00"
                className="input"
              />
            </label>

            {editingAccount.logo_path ? (
              <label className="inline-flex items-center gap-2 text-sm lg:col-span-2">
                <input
                  type="checkbox"
                  checked={removeCurrentLogo}
                  onChange={(event) => setRemoveCurrentLogo(event.target.checked)}
                  className="h-4 w-4 cursor-pointer"
                />
                <span className="text-muted">Remover logo atual</span>
              </label>
            ) : null}

            <label className="grid gap-1 text-sm lg:col-span-2">
              <span className="text-muted">Nova logo (opcional)</span>
              <CustomFileUpload
                value={editLogoFile}
                onChange={setEditLogoFile}
                accept=".png,.jpg,.jpeg,.webp,.svg"
                placeholder="Anexe para substituir a logo"
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
