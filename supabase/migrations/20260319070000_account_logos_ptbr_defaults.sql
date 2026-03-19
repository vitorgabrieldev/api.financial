alter table public.accounts
  add column if not exists logo_path text;

alter table public.user_preferences
  alter column default_currency set default 'BRL';

alter table public.user_preferences
  alter column locale set default 'pt-BR';

alter table public.accounts
  alter column currency set default 'BRL';

alter table public.goals
  alter column currency set default 'BRL';

alter table public.transactions
  alter column currency set default 'BRL';

alter table public.transactions
  alter column default_currency set default 'BRL';

update public.user_preferences
set default_currency = 'BRL',
    locale = 'pt-BR'
where default_currency = 'USD'
  and locale = 'en-US';

update public.accounts
set name = 'Conta principal'
where lower(trim(name)) = 'main account';

update public.categories
set name = case lower(trim(name))
  when 'salary' then 'Salário'
  when 'freelance' then 'Freelance'
  when 'investments' then 'Investimentos'
  when 'other income' then 'Outras receitas'
  when 'housing' then 'Moradia'
  when 'food' then 'Alimentação'
  when 'transport' then 'Transporte'
  when 'health' then 'Saúde'
  when 'education' then 'Educação'
  when 'leisure' then 'Lazer'
  when 'bills' then 'Contas e boletos'
  when 'other expense' then 'Outras despesas'
  else name
end
where is_system = true
  and lower(trim(name)) in (
    'salary',
    'freelance',
    'investments',
    'other income',
    'housing',
    'food',
    'transport',
    'health',
    'education',
    'leisure',
    'bills',
    'other expense'
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'account-logos',
  'account-logos',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read own account logos" on storage.objects;
create policy "Users can read own account logos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'account-logos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can upload own account logos" on storage.objects;
create policy "Users can upload own account logos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'account-logos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update own account logos" on storage.objects;
create policy "Users can update own account logos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'account-logos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'account-logos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own account logos" on storage.objects;
create policy "Users can delete own account logos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'account-logos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

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

  insert into public.user_profiles (user_id, email, full_name, is_admin)
  values (
    new.id,
    coalesce(new.email, concat(new.id::text, '@local.invalid')),
    coalesce(split_part(new.email, '@', 1), 'Usuário'),
    false
  )
  on conflict (user_id) do nothing;

  insert into public.user_module_permissions (
    user_id, module, can_view, can_list, can_create, can_edit, can_delete
  )
  values
    (new.id, 'dashboard', true, true, false, false, false),
    (new.id, 'transactions', true, true, true, true, true),
    (new.id, 'categories', true, true, true, true, true),
    (new.id, 'accounts', true, true, true, true, true),
    (new.id, 'goals', true, true, true, true, true),
    (new.id, 'reports', true, true, false, false, false),
    (new.id, 'users', false, false, false, false, false)
  on conflict (user_id, module) do nothing;

  return new;
end;
$$;

