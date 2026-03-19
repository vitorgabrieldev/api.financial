import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { LuPencilLine, LuSave, LuTrash2, LuUserPlus } from 'react-icons/lu'
import { AccessDenied } from '../components/AccessDenied'
import { AppModal } from '../components/AppModal'
import { PageSkeleton } from '../components/PageSkeleton'
import { Panel } from '../components/Panel'
import { CustomCheckbox } from '../components/fields/CustomCheckbox'
import { CustomSelect } from '../components/fields/CustomSelect'
import {
  adminCreateUser,
  adminDeleteUser,
  adminUpdateUserAccess,
  fetchAllUserPermissions,
  fetchAllUserProfiles,
} from '../lib/db'
import { maskPhoneBR, sanitizePhoneBR } from '../lib/masks/phoneMask'
import {
  actionLabels,
  makeDefaultPermissionDrafts,
  moduleDefinitions,
  serializePermissionDrafts,
  type PermissionDraft,
} from '../lib/permissions'
import type { ModulePermission, UserProfile } from '../types/finance'

interface UsersPageProps {
  currentUserId: string
  moduleAccess: {
    can_view: boolean
    can_list: boolean
    can_create: boolean
    can_edit: boolean
    can_delete: boolean
  }
}

interface UserDraft {
  fullName: string
  phone: string
  isAdmin: boolean
  permissions: PermissionDraft[]
}

const buildPermissionsByUser = (
  rows: ModulePermission[],
): Record<string, PermissionDraft[]> => {
  const grouped = rows.reduce<Record<string, PermissionDraft[]>>((acc, row) => {
    if (!acc[row.user_id]) acc[row.user_id] = []
    acc[row.user_id].push({
      module: row.module,
      can_view: row.can_view,
      can_list: row.can_list,
      can_create: row.can_create,
      can_edit: row.can_edit,
      can_delete: row.can_delete,
    })
    return acc
  }, {})

  for (const userId of Object.keys(grouped)) {
    const existing = new Map(grouped[userId].map((item) => [item.module, item]))
    grouped[userId] = moduleDefinitions.map(({ module }) => {
      const current = existing.get(module)
      return (
        current || {
          module,
          can_view: false,
          can_list: false,
          can_create: false,
          can_edit: false,
          can_delete: false,
        }
      )
    })
  }

  return grouped
}

const PermissionMatrix = ({
  permissions,
  disabled,
  onToggle,
}: {
  permissions: PermissionDraft[]
  disabled?: boolean
  onToggle: (
    module: PermissionDraft['module'],
    action: 'view' | 'list' | 'create' | 'edit' | 'delete',
    checked: boolean,
  ) => void
}) => {
  return (
    <div className="overflow-auto border border-border bg-white/70">
      <table className="w-full min-w-[820px] border-collapse text-xs">
        <thead>
          <tr className="border-b border-border text-left uppercase tracking-[0.12em] text-muted">
            <th className="px-3 py-2">Módulo</th>
            <th className="px-3 py-2">Visualizar</th>
            <th className="px-3 py-2">Listar</th>
            <th className="px-3 py-2">Criar</th>
            <th className="px-3 py-2">Editar</th>
            <th className="px-3 py-2">Excluir</th>
          </tr>
        </thead>
        <tbody>
          {moduleDefinitions.map((definition) => {
            const current = permissions.find(
              (permission) => permission.module === definition.module,
            )

            if (!current) return null

            return (
              <tr key={definition.module} className="border-b border-border/70">
                <td className="px-3 py-2">
                  <p className="font-medium text-ink">{definition.label}</p>
                  <p className="text-[11px] text-muted">{definition.description}</p>
                </td>
                {(['view', 'list', 'create', 'edit', 'delete'] as const).map(
                  (action) => (
                    <td key={action} className="px-3 py-2 text-center">
                      <CustomCheckbox
                        checked={current[`can_${action}`]}
                        disabled={disabled}
                        onChange={(checked) =>
                          onToggle(definition.module, action, checked)
                        }
                        className="justify-center"
                        aria-label={`${actionLabels[action]} em ${definition.label}`}
                      />
                    </td>
                  ),
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export const UsersPage = ({ currentUserId, moduleAccess }: UsersPageProps) => {
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [drafts, setDrafts] = useState<Record<string, UserDraft>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newFullName, setNewFullName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newIsAdmin, setNewIsAdmin] = useState(false)
  const [newPermissions, setNewPermissions] = useState<PermissionDraft[]>(
    makeDefaultPermissionDrafts(),
  )
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!moduleAccess.can_list) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const [profilesData, permissionsData] = await Promise.all([
        fetchAllUserProfiles(),
        fetchAllUserPermissions(),
      ])

      const groupedPermissions = buildPermissionsByUser(permissionsData)
      const nextDrafts = profilesData.reduce<Record<string, UserDraft>>(
        (acc, profile) => {
          const permissionSet =
            groupedPermissions[profile.user_id] ?? makeDefaultPermissionDrafts()
          acc[profile.user_id] = {
            fullName: profile.full_name,
            phone: maskPhoneBR(profile.phone ?? ''),
            isAdmin: profile.is_admin,
            permissions: permissionSet,
          }
          return acc
        },
        {},
      )

      setProfiles(profilesData)
      setDrafts(nextDrafts)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Falha ao carregar os dados de usuários.',
      )
    } finally {
      setLoading(false)
    }
  }, [moduleAccess.can_list])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!newIsAdmin) return

    setNewPermissions((current) =>
      current.map((item) => ({
        ...item,
        can_view: true,
        can_list: true,
        can_create: true,
        can_edit: true,
        can_delete: true,
      })),
    )
  }, [newIsAdmin])

  const updateDraftPermission = (
    userId: string,
    module: PermissionDraft['module'],
    action: 'view' | 'list' | 'create' | 'edit' | 'delete',
    checked: boolean,
  ) => {
    setDrafts((current) => {
      const draft = current[userId]
      if (!draft) return current

      return {
        ...current,
        [userId]: {
          ...draft,
          permissions: draft.permissions.map((item) =>
            item.module === module
              ? { ...item, [`can_${action}`]: checked }
              : item,
          ),
        },
      }
    })
  }

  const updateNewPermission = (
    module: PermissionDraft['module'],
    action: 'view' | 'list' | 'create' | 'edit' | 'delete',
    checked: boolean,
  ) => {
    setNewPermissions((current) =>
      current.map((item) =>
        item.module === module ? { ...item, [`can_${action}`]: checked } : item,
      ),
    )
  }

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!moduleAccess.can_create) {
      setError('Seu perfil não possui permissão para criar usuários.')
      return
    }

    if (newPassword.length < 8) {
      setError('A senha deve ter no mínimo 8 caracteres.')
      return
    }

    setSubmitting(true)
    try {
      await adminCreateUser({
        email: newEmail.trim(),
        password: newPassword,
        fullName: newFullName.trim(),
        phone: sanitizePhoneBR(newPhone),
        isAdmin: newIsAdmin,
        permissions: serializePermissionDrafts(newPermissions),
      })

      setNewEmail('')
      setNewPassword('')
      setNewFullName('')
      setNewPhone('')
      setNewIsAdmin(false)
      setNewPermissions(makeDefaultPermissionDrafts())
      setIsCreateModalOpen(false)
      setMessage('Usuário criado com sucesso.')
      await load()
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Falha ao criar usuário.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveAccess = async (userId: string) => {
    if (!moduleAccess.can_edit) {
      setError('Seu perfil não possui permissão para editar acessos.')
      return false
    }

    const draft = drafts[userId]
    if (!draft) return false

    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      await adminUpdateUserAccess({
        targetUserId: userId,
        fullName: draft.fullName,
        phone: sanitizePhoneBR(draft.phone),
        isAdmin: draft.isAdmin,
        permissions: serializePermissionDrafts(draft.permissions),
      })
      setMessage('Acessos atualizados com sucesso.')
      await load()
      return true
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Falha ao atualizar acessos.',
      )
      return false
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!moduleAccess.can_delete) {
      setError('Seu perfil não possui permissão para excluir usuários.')
      return
    }

    const shouldDelete = window.confirm(
      'Tem certeza de que deseja excluir este usuário?',
    )
    if (!shouldDelete) return

    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      await adminDeleteUser(userId)
      setMessage('Usuário excluído com sucesso.')
      await load()
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Falha ao excluir usuário.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const sortedProfiles = useMemo(
    () =>
      [...profiles].sort((a, b) =>
        a.full_name.localeCompare(b.full_name, 'pt-BR', { sensitivity: 'base' }),
      ),
    [profiles],
  )

  const startEdit = (userId: string) => {
    setEditingUserId(userId)
    setIsEditModalOpen(true)
  }

  const closeEdit = () => {
    setIsEditModalOpen(false)
    setEditingUserId(null)
  }

  const editingProfile =
    editingUserId != null
      ? sortedProfiles.find((profile) => profile.user_id === editingUserId) ?? null
      : null

  const editingDraft =
    editingUserId != null && drafts[editingUserId] ? drafts[editingUserId] : null

  if (!moduleAccess.can_view) return <AccessDenied moduleLabel="Usuários" />
  if (loading) return <PageSkeleton cards={1} lines={5} withForm withTable />

  return (
    <div className="grid gap-4">
      {error ? (
        <p className="border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}

      {moduleAccess.can_list ? (
        <Panel
          title="Usuários cadastrados"
          subtitle="Edição de acessos por perfil"
          actions={
            moduleAccess.can_create ? (
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-2 border border-primary bg-primary px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-white transition hover:bg-primary-dark"
              >
                <LuUserPlus className="h-3.5 w-3.5" />
                Novo usuário
              </button>
            ) : null
          }
        >
          <div className="grid gap-4">
            {sortedProfiles.map((profile) => {
              const draft = drafts[profile.user_id]
              if (!draft) return null

              return (
                <article
                  key={profile.user_id}
                  className="grid gap-3 border border-border bg-white/80 p-3 lg:grid-cols-[1fr_auto]"
                >
                  <div className="grid gap-2 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-[0.1em] text-muted">
                        Nome
                      </p>
                      <p className="font-medium text-ink">{draft.fullName}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.1em] text-muted">
                      Email
                    </p>
                    <p className="break-all text-ink">{profile.email}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.1em] text-muted">
                      Telefone
                    </p>
                    <p className="text-ink">{draft.phone || 'Não informado'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.1em] text-muted">
                      Perfil
                    </p>
                    <p className="text-ink">
                      {draft.isAdmin ? 'Administrador' : 'Usuário padrão'}
                    </p>
                  </div>
                  {profile.user_id === currentUserId ? (
                    <p className="text-xs text-muted">Este é o seu usuário atual.</p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    {moduleAccess.can_edit ? (
                      <button
                        type="button"
                        onClick={() => startEdit(profile.user_id)}
                        disabled={submitting}
                        className="inline-flex items-center gap-2 border border-primary bg-primary px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-white transition hover:bg-primary-dark disabled:opacity-60"
                      >
                        <LuPencilLine className="h-3.5 w-3.5" />
                        Editar
                      </button>
                    ) : null}

                    {moduleAccess.can_delete && profile.user_id !== currentUserId ? (
                      <button
                        type="button"
                        onClick={() => void handleDeleteUser(profile.user_id)}
                        disabled={submitting}
                        className="inline-flex items-center gap-2 border border-rose-300 bg-white px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
                      >
                        <LuTrash2 className="h-3.5 w-3.5" />
                        Excluir usuário
                      </button>
                    ) : null}
                  </div>
                </article>
              )
            })}

            {sortedProfiles.length === 0 ? (
              <p className="text-sm text-muted">Nenhum usuário encontrado.</p>
            ) : null}
          </div>
        </Panel>
      ) : (
        <AccessDenied moduleLabel="Lista de usuários" />
      )}

      {moduleAccess.can_create ? (
        <AppModal
          open={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Novo usuário"
          subtitle="Cadastro com permissão por módulo e ação (pt-BR)"
          maxWidthClassName="max-w-6xl"
        >
          <form onSubmit={handleCreateUser} className="grid gap-3">
            <div className="grid gap-3 lg:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="text-muted">Nome completo</span>
                <input
                  required
                  value={newFullName}
                  onChange={(event) => setNewFullName(event.target.value)}
                  className="input"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-muted">Telefone</span>
                <input
                  value={newPhone}
                  onChange={(event) => setNewPhone(maskPhoneBR(event.target.value))}
                  placeholder="(11) 99999-9999"
                  className="input"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-muted">Email</span>
                <input
                  required
                  type="email"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  className="input"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-muted">Senha inicial</span>
                <input
                  required
                  type="password"
                  minLength={8}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="input"
                />
              </label>
            </div>

            <CustomCheckbox
              checked={newIsAdmin}
              onChange={setNewIsAdmin}
              label="Usuário administrador (acesso total)"
            />

            <PermissionMatrix
              permissions={newPermissions}
              disabled={newIsAdmin}
              onToggle={updateNewPermission}
            />

            <div>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 border border-primary bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
              >
                <LuUserPlus className="h-4 w-4" />
                Criar usuário
              </button>
            </div>
          </form>
        </AppModal>
      ) : null}

      {moduleAccess.can_edit && editingProfile && editingDraft ? (
        <AppModal
          open={isEditModalOpen}
          onClose={closeEdit}
          title="Editar usuário"
          subtitle="Atualize dados e permissões por módulo"
          maxWidthClassName="max-w-6xl"
        >
          <form
            onSubmit={async (event) => {
              event.preventDefault()
              const saved = await handleSaveAccess(editingProfile.user_id)
              if (saved) closeEdit()
            }}
            className="grid gap-3"
          >
            <div className="grid gap-3 lg:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="text-muted">Nome completo</span>
                <input
                  value={editingDraft.fullName}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [editingProfile.user_id]: {
                        ...current[editingProfile.user_id],
                        fullName: event.target.value,
                      },
                    }))
                  }
                  disabled={!moduleAccess.can_edit}
                  className="input"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-muted">Telefone</span>
                <input
                  value={editingDraft.phone}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [editingProfile.user_id]: {
                        ...current[editingProfile.user_id],
                        phone: maskPhoneBR(event.target.value),
                      },
                    }))
                  }
                  disabled={!moduleAccess.can_edit}
                  placeholder="(11) 99999-9999"
                  className="input"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-muted">Email</span>
                <input
                  value={editingProfile.email}
                  disabled
                  className="input bg-neutral-50 text-xs text-muted"
                />
              </label>
              <div className="grid gap-1 text-sm">
                <span className="text-muted">Perfil</span>
                <CustomSelect
                  value={editingDraft.isAdmin ? 'admin' : 'user'}
                  disabled={!moduleAccess.can_edit}
                  onChange={(event) =>
                    setDrafts((current) => {
                      const nextAdmin = event.target.value === 'admin'
                      const nextPermissions = nextAdmin
                        ? current[editingProfile.user_id].permissions.map((item) => ({
                            ...item,
                            can_view: true,
                            can_list: true,
                            can_create: true,
                            can_edit: true,
                            can_delete: true,
                          }))
                        : current[editingProfile.user_id].permissions

                      return {
                        ...current,
                        [editingProfile.user_id]: {
                          ...current[editingProfile.user_id],
                          isAdmin: nextAdmin,
                          permissions: nextPermissions,
                        },
                      }
                    })
                  }
                >
                  <option value="user">Usuário padrão</option>
                  <option value="admin">Administrador</option>
                </CustomSelect>
              </div>
            </div>

            {editingProfile.user_id === currentUserId ? (
              <p className="text-xs text-muted">Este é o seu usuário atual.</p>
            ) : null}

            <PermissionMatrix
              permissions={editingDraft.permissions}
              disabled={!moduleAccess.can_edit || editingDraft.isAdmin}
              onToggle={(module, action, checked) =>
                updateDraftPermission(editingProfile.user_id, module, action, checked)
              }
            />

            <div>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 border border-primary bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
              >
                <LuSave className="h-4 w-4" />
                Salvar alterações
              </button>
            </div>
          </form>
        </AppModal>
      ) : null}
    </div>
  )
}
