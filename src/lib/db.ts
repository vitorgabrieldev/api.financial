import { supabase } from './supabase'
import type {
  Account,
  AppModule,
  Category,
  CategoryReportRow,
  Goal,
  ModulePermission,
  MonthlyReportRow,
  Transaction,
  UserProfile,
  UserPreferences,
} from '../types/finance'
import type { PermissionDraft } from './permissions'

export const getOrCreatePreferences = async (
  userId: string,
): Promise<UserPreferences> => {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!error && data) return data as UserPreferences

  const fallback = {
    user_id: userId,
    default_currency: 'BRL',
    locale: 'pt-BR',
    session_max_hours: 4,
  }

  const { data: inserted, error: insertError } = await supabase
    .from('user_preferences')
    .upsert(fallback)
    .select('*')
    .single()

  if (insertError || !inserted) {
    throw new Error(insertError?.message || 'Falha ao preparar preferências.')
  }

  return inserted as UserPreferences
}

export const fetchAccounts = async (userId: string): Promise<Account[]> => {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  return ((data ?? []) as Partial<Account>[]).map((account) => {
    const logoPath = account.logo_path ?? null
    const logoUrl = logoPath
      ? supabase.storage.from('account-logos').getPublicUrl(logoPath).data
          .publicUrl
      : null

    return {
      ...account,
      logo_path: logoPath,
      logo_url: logoUrl,
    } as Account
  })
}

export const fetchCategories = async (userId: string): Promise<Category[]> => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('kind', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as Category[]
}

export const fetchGoals = async (userId: string): Promise<Goal[]> => {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Goal[]
}

export const fetchTransactions = async (
  userId: string,
  limit = 100,
): Promise<Transaction[]> => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('occurs_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []) as Transaction[]
}

export const fetchMonthlyReport = async (
  userId: string,
): Promise<MonthlyReportRow[]> => {
  const { data, error } = await supabase
    .from('monthly_report')
    .select('*')
    .eq('user_id', userId)
    .order('month_start', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as MonthlyReportRow[]
}

export const fetchCategoryReport = async (
  userId: string,
): Promise<CategoryReportRow[]> => {
  const { data, error } = await supabase
    .from('category_report')
    .select('*')
    .eq('user_id', userId)
    .order('month_start', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as CategoryReportRow[]
}

export const fetchUserProfile = async (userId: string): Promise<UserProfile> => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Falha ao carregar perfil do usuário.')
  }

  return data as UserProfile
}

export const fetchUserPermissions = async (
  userId: string,
): Promise<ModulePermission[]> => {
  const { data, error } = await supabase
    .from('user_module_permissions')
    .select('*')
    .eq('user_id', userId)
    .order('module', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as ModulePermission[]
}

export const fetchAllUserProfiles = async (): Promise<UserProfile[]> => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as UserProfile[]
}

export const fetchAllUserPermissions = async (): Promise<ModulePermission[]> => {
  const { data, error } = await supabase
    .from('user_module_permissions')
    .select('*')
    .order('user_id', { ascending: true })
    .order('module', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as ModulePermission[]
}

export const adminCreateUser = async (params: {
  email: string
  password: string
  fullName: string
  phone: string
  isAdmin: boolean
  permissions: PermissionDraft[]
}): Promise<string> => {
  const { data, error } = await supabase.rpc('admin_create_user', {
    p_email: params.email,
    p_password: params.password,
    p_full_name: params.fullName,
    p_phone: params.phone || null,
    p_is_admin: params.isAdmin,
    p_permissions: params.permissions,
  })

  if (error || !data) throw new Error(error?.message || 'Falha ao criar usuário.')
  return data as string
}

export const adminUpdateUserAccess = async (params: {
  targetUserId: string
  fullName: string
  phone: string
  isAdmin: boolean
  permissions: PermissionDraft[]
}): Promise<void> => {
  const { error } = await supabase.rpc('admin_update_user_access', {
    p_target_user_id: params.targetUserId,
    p_full_name: params.fullName,
    p_phone: params.phone || null,
    p_is_admin: params.isAdmin,
    p_permissions: params.permissions,
  })

  if (error) throw new Error(error.message)
}

export const adminDeleteUser = async (targetUserId: string): Promise<void> => {
  const { error } = await supabase.rpc('admin_delete_user', {
    p_target_user_id: targetUserId,
  })

  if (error) throw new Error(error.message)
}

export const ensurePermissionRows = async (
  userId: string,
  modules: AppModule[],
): Promise<void> => {
  const rows = modules.map((module) => ({
    user_id: userId,
    module,
    can_view: false,
    can_list: false,
    can_create: false,
    can_edit: false,
    can_delete: false,
  }))

  const { error } = await supabase
    .from('user_module_permissions')
    .upsert(rows, { onConflict: 'user_id,module', ignoreDuplicates: true })

  if (error) throw new Error(error.message)
}
