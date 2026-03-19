create extension if not exists pgcrypto with schema extensions;

do $$
begin
  create type public.account_type as enum ('checking', 'savings', 'cash', 'credit', 'investment', 'other');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.transaction_type as enum ('income', 'expense', 'transfer');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.category_kind as enum ('income', 'expense');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.goal_status as enum ('active', 'achieved', 'paused', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.recurrence_frequency as enum ('none', 'daily', 'weekly', 'monthly', 'yearly');
exception
  when duplicate_object then null;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_currency char(3) not null default 'BRL',
  locale text not null default 'pt-BR',
  session_max_hours integer not null default 4 check (session_max_hours between 1 and 24),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_preferences_default_currency_format check (default_currency ~ '^[A-Z]{3}$')
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) >= 2),
  normalized_name text generated always as (lower(trim(name))) stored,
  type public.account_type not null default 'checking',
  currency char(3) not null default 'BRL',
  initial_balance numeric(14,2) not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint accounts_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint accounts_user_name_unique unique (user_id, normalized_name),
  constraint accounts_id_user_unique unique (id, user_id)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) >= 2),
  normalized_name text generated always as (lower(trim(name))) stored,
  kind public.category_kind not null,
  color text not null default '#9f2f2f',
  icon text not null default 'LuTag',
  is_system boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint categories_user_name_kind_unique unique (user_id, normalized_name, kind),
  constraint categories_id_user_unique unique (id, user_id)
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) >= 3),
  normalized_name text generated always as (lower(trim(name))) stored,
  target_amount numeric(14,2) not null check (target_amount > 0),
  current_amount numeric(14,2) not null default 0 check (current_amount >= 0),
  currency char(3) not null default 'BRL',
  target_date date,
  status public.goal_status not null default 'active',
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint goals_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint goals_user_name_unique unique (user_id, normalized_name),
  constraint goals_id_user_unique unique (id, user_id)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  transfer_account_id uuid,
  category_id uuid,
  goal_id uuid,
  type public.transaction_type not null,
  description text not null check (length(trim(description)) >= 2),
  notes text,
  amount numeric(14,2) not null check (amount > 0),
  currency char(3) not null default 'BRL',
  amount_in_default_currency numeric(14,2) not null check (amount_in_default_currency >= 0),
  default_currency char(3) not null default 'BRL',
  exchange_rate numeric(18,8) not null default 1 check (exchange_rate > 0),
  occurs_on date not null default current_date,
  attachment_path text,
  recurrence_frequency public.recurrence_frequency not null default 'none',
  recurrence_interval integer not null default 1 check (recurrence_interval > 0),
  recurrence_end_date date,
  recurrence_template_id uuid references public.transactions(id) on delete set null,
  installment_group_id uuid,
  installment_number integer,
  installment_total integer,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint transactions_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint transactions_default_currency_format check (default_currency ~ '^[A-Z]{3}$'),
  constraint transactions_account_fk
    foreign key (account_id, user_id) references public.accounts(id, user_id) on delete cascade,
  constraint transactions_transfer_account_fk
    foreign key (transfer_account_id, user_id) references public.accounts(id, user_id) on delete set null,
  constraint transactions_category_fk
    foreign key (category_id, user_id) references public.categories(id, user_id) on delete set null,
  constraint transactions_goal_fk
    foreign key (goal_id, user_id) references public.goals(id, user_id) on delete set null,
  constraint transactions_transfer_logic check (
    (type = 'transfer' and transfer_account_id is not null and transfer_account_id <> account_id and category_id is null)
    or
    (type <> 'transfer' and transfer_account_id is null)
  ),
  constraint transactions_category_logic check (
    (type in ('income', 'expense') and category_id is not null)
    or
    (type = 'transfer' and category_id is null)
  ),
  constraint transactions_recurrence_logic check (
    (recurrence_frequency = 'none' and recurrence_end_date is null)
    or
    (recurrence_frequency <> 'none')
  ),
  constraint transactions_installment_logic check (
    (
      installment_group_id is null
      and installment_number is null
      and installment_total is null
    )
    or
    (
      installment_group_id is not null
      and installment_number is not null
      and installment_total is not null
      and installment_number > 0
      and installment_total >= installment_number
    )
  )
);

create index if not exists idx_accounts_user_id on public.accounts(user_id);
create index if not exists idx_categories_user_id on public.categories(user_id);
create index if not exists idx_goals_user_id on public.goals(user_id);
create index if not exists idx_transactions_user_occurs_on on public.transactions(user_id, occurs_on desc);
create index if not exists idx_transactions_user_type_occurs_on on public.transactions(user_id, type, occurs_on desc);
create index if not exists idx_transactions_installment_group on public.transactions(installment_group_id);
create index if not exists idx_transactions_recurrence_template on public.transactions(recurrence_template_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_preferences (user_id, default_currency, locale, session_max_hours)
  values (new.id, 'BRL', 'pt-BR', 4)
  on conflict (user_id) do nothing;

  insert into public.accounts (user_id, name, type, currency, initial_balance)
  values (new.id, 'Conta principal', 'checking', 'BRL', 0)
  on conflict (user_id, normalized_name) do nothing;

  insert into public.categories (user_id, name, kind, color, icon, is_system)
  values
    (new.id, 'Salário', 'income', '#884545', 'LuBriefcaseBusiness', true),
    (new.id, 'Freelance', 'income', '#a65454', 'LuLaptop', true),
    (new.id, 'Investimentos', 'income', '#7b3a3a', 'LuTrendingUp', true),
    (new.id, 'Outras receitas', 'income', '#b06767', 'LuPlus', true),
    (new.id, 'Moradia', 'expense', '#8a2d2d', 'LuHouse', true),
    (new.id, 'Alimentação', 'expense', '#994040', 'LuUtensilsCrossed', true),
    (new.id, 'Transporte', 'expense', '#b25050', 'LuBus', true),
    (new.id, 'Saúde', 'expense', '#aa4a4a', 'LuHeartPulse', true),
    (new.id, 'Educação', 'expense', '#7f3f3f', 'LuBookOpen', true),
    (new.id, 'Lazer', 'expense', '#b45e5e', 'LuGamepad2', true),
    (new.id, 'Contas e boletos', 'expense', '#893737', 'LuReceiptText', true),
    (new.id, 'Outras despesas', 'expense', '#bf7272', 'LuCircleEllipsis', true)
  on conflict (user_id, normalized_name, kind) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

drop trigger if exists tr_user_preferences_set_updated_at on public.user_preferences;
create trigger tr_user_preferences_set_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

drop trigger if exists tr_accounts_set_updated_at on public.accounts;
create trigger tr_accounts_set_updated_at
before update on public.accounts
for each row execute function public.set_updated_at();

drop trigger if exists tr_categories_set_updated_at on public.categories;
create trigger tr_categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists tr_goals_set_updated_at on public.goals;
create trigger tr_goals_set_updated_at
before update on public.goals
for each row execute function public.set_updated_at();

drop trigger if exists tr_transactions_set_updated_at on public.transactions;
create trigger tr_transactions_set_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

alter table public.user_preferences enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.goals enable row level security;
alter table public.transactions enable row level security;

drop policy if exists "Users can read own preferences" on public.user_preferences;
create policy "Users can read own preferences"
on public.user_preferences
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own preferences" on public.user_preferences;
create policy "Users can insert own preferences"
on public.user_preferences
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own preferences" on public.user_preferences;
create policy "Users can update own preferences"
on public.user_preferences
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can read own accounts" on public.accounts;
create policy "Users can read own accounts"
on public.accounts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own accounts" on public.accounts;
create policy "Users can insert own accounts"
on public.accounts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own accounts" on public.accounts;
create policy "Users can update own accounts"
on public.accounts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own accounts" on public.accounts;
create policy "Users can delete own accounts"
on public.accounts
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own categories" on public.categories;
create policy "Users can read own categories"
on public.categories
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own categories" on public.categories;
create policy "Users can insert own categories"
on public.categories
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own categories" on public.categories;
create policy "Users can update own categories"
on public.categories
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own categories" on public.categories;
create policy "Users can delete own categories"
on public.categories
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own goals" on public.goals;
create policy "Users can read own goals"
on public.goals
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own goals" on public.goals;
create policy "Users can insert own goals"
on public.goals
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own goals" on public.goals;
create policy "Users can update own goals"
on public.goals
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own goals" on public.goals;
create policy "Users can delete own goals"
on public.goals
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own transactions" on public.transactions;
create policy "Users can read own transactions"
on public.transactions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own transactions" on public.transactions;
create policy "Users can insert own transactions"
on public.transactions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own transactions" on public.transactions;
create policy "Users can update own transactions"
on public.transactions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own transactions" on public.transactions;
create policy "Users can delete own transactions"
on public.transactions
for delete
to authenticated
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read own receipts" on storage.objects;
create policy "Users can read own receipts"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can upload own receipts" on storage.objects;
create policy "Users can upload own receipts"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update own receipts" on storage.objects;
create policy "Users can update own receipts"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own receipts" on storage.objects;
create policy "Users can delete own receipts"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create or replace view public.monthly_report
with (security_invoker = true)
as
select
  t.user_id,
  date_trunc('month', t.occurs_on)::date as month_start,
  t.default_currency as currency,
  coalesce(sum(case when t.type = 'income' then t.amount_in_default_currency else 0 end), 0)::numeric(14,2) as total_income,
  coalesce(sum(case when t.type = 'expense' then t.amount_in_default_currency else 0 end), 0)::numeric(14,2) as total_expense,
  coalesce(sum(case when t.type = 'income' then t.amount_in_default_currency when t.type = 'expense' then -t.amount_in_default_currency else 0 end), 0)::numeric(14,2) as net_result
from public.transactions t
group by t.user_id, date_trunc('month', t.occurs_on), t.default_currency;

create or replace view public.category_report
with (security_invoker = true)
as
select
  t.user_id,
  date_trunc('month', t.occurs_on)::date as month_start,
  c.id as category_id,
  c.name as category_name,
  c.kind,
  t.default_currency as currency,
  coalesce(sum(t.amount_in_default_currency), 0)::numeric(14,2) as total_amount
from public.transactions t
join public.categories c on c.id = t.category_id and c.user_id = t.user_id
where t.type in ('income', 'expense')
group by t.user_id, date_trunc('month', t.occurs_on), c.id, c.name, c.kind, t.default_currency;

grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.monthly_report to authenticated;
grant select on public.category_report to authenticated;
