export type TransactionType = 'income' | 'expense' | 'transfer'
export type CategoryKind = 'income' | 'expense'
export type AccountType =
  | 'checking'
  | 'savings'
  | 'cash'
  | 'credit'
  | 'investment'
  | 'other'
export type GoalStatus = 'active' | 'achieved' | 'paused' | 'cancelled'
export type RecurrenceFrequency =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
export type AppModule =
  | 'dashboard'
  | 'transactions'
  | 'categories'
  | 'accounts'
  | 'goals'
  | 'reports'
  | 'users'
export type PermissionAction = 'view' | 'list' | 'create' | 'edit' | 'delete'

export interface UserPreferences {
  user_id: string
  default_currency: string
  locale: string
  session_max_hours: number
}

export interface UserProfile {
  user_id: string
  email: string
  phone: string | null
  full_name: string
  is_admin: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ModulePermission {
  id: string
  user_id: string
  module: AppModule
  can_view: boolean
  can_list: boolean
  can_create: boolean
  can_edit: boolean
  can_delete: boolean
  created_at: string
  updated_at: string
}

export interface Account {
  id: string
  user_id: string
  name: string
  type: AccountType
  currency: string
  initial_balance: number
  logo_path: string | null
  logo_url: string | null
  is_archived: boolean
  created_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  kind: CategoryKind
  color: string
  icon: string
  is_system: boolean
}

export interface Goal {
  id: string
  user_id: string
  name: string
  target_amount: number
  current_amount: number
  currency: string
  target_date: string | null
  status: GoalStatus
  notes: string | null
}

export interface Transaction {
  id: string
  user_id: string
  account_id: string
  transfer_account_id: string | null
  category_id: string | null
  goal_id: string | null
  type: TransactionType
  description: string
  notes: string | null
  amount: number
  currency: string
  amount_in_default_currency: number
  default_currency: string
  exchange_rate: number
  occurs_on: string
  attachment_path: string | null
  recurrence_frequency: RecurrenceFrequency
  recurrence_interval: number
  recurrence_end_date: string | null
  installment_group_id: string | null
  installment_number: number | null
  installment_total: number | null
  created_at: string
}

export interface MonthlyReportRow {
  user_id: string
  month_start: string
  currency: string
  total_income: number
  total_expense: number
  net_result: number
}

export interface CategoryReportRow {
  user_id: string
  month_start: string
  category_id: string
  category_name: string
  kind: CategoryKind
  currency: string
  total_amount: number
}
