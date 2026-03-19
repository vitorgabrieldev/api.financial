do $$
begin
  create type public.app_module as enum (
    'dashboard',
    'transactions',
    'categories',
    'accounts',
    'goals',
    'reports',
    'users'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default 'Usuário',
  is_admin boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_module_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module public.app_module not null,
  can_view boolean not null default false,
  can_list boolean not null default false,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_module_permissions_user_module_unique unique (user_id, module)
);

create index if not exists idx_user_profiles_admin on public.user_profiles(is_admin);
create index if not exists idx_user_module_permissions_user on public.user_module_permissions(user_id);
create index if not exists idx_user_module_permissions_module on public.user_module_permissions(module);

drop trigger if exists tr_user_profiles_set_updated_at on public.user_profiles;
create trigger tr_user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

drop trigger if exists tr_user_module_permissions_set_updated_at on public.user_module_permissions;
create trigger tr_user_module_permissions_set_updated_at
before update on public.user_module_permissions
for each row execute function public.set_updated_at();

create or replace function public.is_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles up
    where up.user_id = p_user_id
      and up.is_admin = true
  );
$$;

grant execute on function public.is_admin(uuid) to authenticated;

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

insert into public.user_profiles (user_id, email, full_name, is_admin)
select
  u.id,
  coalesce(u.email, concat(u.id::text, '@local.invalid')),
  coalesce(split_part(u.email, '@', 1), 'Usuário'),
  false
from auth.users u
on conflict (user_id) do update
set email = excluded.email;

insert into public.user_module_permissions (
  user_id, module, can_view, can_list, can_create, can_edit, can_delete
)
select
  up.user_id,
  module_defaults.module,
  module_defaults.can_view,
  module_defaults.can_list,
  module_defaults.can_create,
  module_defaults.can_edit,
  module_defaults.can_delete
from public.user_profiles up
cross join (
  values
    ('dashboard'::public.app_module, true, true, false, false, false),
    ('transactions'::public.app_module, true, true, true, true, true),
    ('categories'::public.app_module, true, true, true, true, true),
    ('accounts'::public.app_module, true, true, true, true, true),
    ('goals'::public.app_module, true, true, true, true, true),
    ('reports'::public.app_module, true, true, false, false, false),
    ('users'::public.app_module, false, false, false, false, false)
) as module_defaults(module, can_view, can_list, can_create, can_edit, can_delete)
on conflict (user_id, module) do nothing;

alter table public.user_profiles enable row level security;
alter table public.user_module_permissions enable row level security;

drop policy if exists "Profiles can be read by self or admin" on public.user_profiles;
create policy "Profiles can be read by self or admin"
on public.user_profiles
for select
to authenticated
using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "Profiles can be inserted by admin" on public.user_profiles;
create policy "Profiles can be inserted by admin"
on public.user_profiles
for insert
to authenticated
with check (public.is_admin(auth.uid()));

drop policy if exists "Profiles can be updated by admin" on public.user_profiles;
create policy "Profiles can be updated by admin"
on public.user_profiles
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "Profiles can be deleted by admin" on public.user_profiles;
create policy "Profiles can be deleted by admin"
on public.user_profiles
for delete
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "Permissions can be read by self or admin" on public.user_module_permissions;
create policy "Permissions can be read by self or admin"
on public.user_module_permissions
for select
to authenticated
using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "Permissions can be inserted by admin" on public.user_module_permissions;
create policy "Permissions can be inserted by admin"
on public.user_module_permissions
for insert
to authenticated
with check (public.is_admin(auth.uid()));

drop policy if exists "Permissions can be updated by admin" on public.user_module_permissions;
create policy "Permissions can be updated by admin"
on public.user_module_permissions
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "Permissions can be deleted by admin" on public.user_module_permissions;
create policy "Permissions can be deleted by admin"
on public.user_module_permissions
for delete
to authenticated
using (public.is_admin(auth.uid()));

create or replace function public.admin_create_user(
  p_email text,
  p_password text,
  p_full_name text default null,
  p_is_admin boolean default false,
  p_permissions jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  requester_id uuid := auth.uid();
  normalized_email text := lower(trim(p_email));
  new_user_id uuid := gen_random_uuid();
  permission_item jsonb;
  provider_payload jsonb;
begin
  if requester_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if not public.is_admin(requester_id) then
    raise exception 'Apenas administradores podem criar usuários.';
  end if;

  if normalized_email is null or normalized_email = '' then
    raise exception 'Email obrigatório.';
  end if;

  if p_password is null or length(p_password) < 8 then
    raise exception 'Senha deve ter no mínimo 8 caracteres.';
  end if;

  if exists (
    select 1
    from auth.users u
    where lower(u.email) = normalized_email
  ) then
    raise exception 'Email já cadastrado.';
  end if;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token,
    is_sso_user,
    is_anonymous
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    normalized_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    timezone('utc', now()),
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now()),
    '',
    '',
    '',
    '',
    false,
    false
  );

  provider_payload := jsonb_build_object(
    'sub', new_user_id::text,
    'email', normalized_email,
    'email_verified', true
  );

  insert into auth.identities (
    id,
    user_id,
    provider_id,
    provider,
    identity_data,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    new_user_id,
    new_user_id::text,
    'email',
    provider_payload,
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (provider_id, provider) do nothing;

  update public.user_profiles
    set email = normalized_email,
        full_name = coalesce(nullif(trim(p_full_name), ''), split_part(normalized_email, '@', 1)),
        is_admin = p_is_admin,
        created_by = requester_id
  where user_id = new_user_id;

  if jsonb_typeof(p_permissions) = 'array' and jsonb_array_length(p_permissions) > 0 then
    delete from public.user_module_permissions
    where user_id = new_user_id;

    for permission_item in
      select value from jsonb_array_elements(p_permissions)
    loop
      insert into public.user_module_permissions (
        user_id,
        module,
        can_view,
        can_list,
        can_create,
        can_edit,
        can_delete
      )
      values (
        new_user_id,
        (permission_item->>'module')::public.app_module,
        coalesce((permission_item->>'can_view')::boolean, false),
        coalesce((permission_item->>'can_list')::boolean, false),
        coalesce((permission_item->>'can_create')::boolean, false),
        coalesce((permission_item->>'can_edit')::boolean, false),
        coalesce((permission_item->>'can_delete')::boolean, false)
      )
      on conflict (user_id, module) do update
      set can_view = excluded.can_view,
          can_list = excluded.can_list,
          can_create = excluded.can_create,
          can_edit = excluded.can_edit,
          can_delete = excluded.can_delete;
    end loop;
  end if;

  if p_is_admin then
    update public.user_module_permissions
      set can_view = true,
          can_list = true,
          can_create = true,
          can_edit = true,
          can_delete = true
    where user_id = new_user_id;
  end if;

  return new_user_id;
end;
$$;

create or replace function public.admin_update_user_access(
  p_target_user_id uuid,
  p_full_name text,
  p_is_admin boolean,
  p_permissions jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_id uuid := auth.uid();
  permission_item jsonb;
begin
  if requester_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if not public.is_admin(requester_id) then
    raise exception 'Apenas administradores podem editar acessos.';
  end if;

  if not exists (
    select 1
    from public.user_profiles up
    where up.user_id = p_target_user_id
  ) then
    raise exception 'Usuário alvo não encontrado.';
  end if;

  update public.user_profiles
    set full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
        is_admin = p_is_admin
  where user_id = p_target_user_id;

  if jsonb_typeof(p_permissions) = 'array' then
    delete from public.user_module_permissions
    where user_id = p_target_user_id;

    for permission_item in
      select value from jsonb_array_elements(p_permissions)
    loop
      insert into public.user_module_permissions (
        user_id,
        module,
        can_view,
        can_list,
        can_create,
        can_edit,
        can_delete
      )
      values (
        p_target_user_id,
        (permission_item->>'module')::public.app_module,
        coalesce((permission_item->>'can_view')::boolean, false),
        coalesce((permission_item->>'can_list')::boolean, false),
        coalesce((permission_item->>'can_create')::boolean, false),
        coalesce((permission_item->>'can_edit')::boolean, false),
        coalesce((permission_item->>'can_delete')::boolean, false)
      )
      on conflict (user_id, module) do update
      set can_view = excluded.can_view,
          can_list = excluded.can_list,
          can_create = excluded.can_create,
          can_edit = excluded.can_edit,
          can_delete = excluded.can_delete;
    end loop;
  end if;

  if p_is_admin then
    update public.user_module_permissions
      set can_view = true,
          can_list = true,
          can_create = true,
          can_edit = true,
          can_delete = true
    where user_id = p_target_user_id;
  end if;
end;
$$;

create or replace function public.admin_delete_user(
  p_target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  requester_id uuid := auth.uid();
begin
  if requester_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if not public.is_admin(requester_id) then
    raise exception 'Apenas administradores podem excluir usuários.';
  end if;

  if requester_id = p_target_user_id then
    raise exception 'Não é permitido excluir o próprio usuário.';
  end if;

  delete from auth.users where id = p_target_user_id;
end;
$$;

grant execute on function public.admin_create_user(text, text, text, boolean, jsonb) to authenticated;
grant execute on function public.admin_update_user_access(uuid, text, boolean, jsonb) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;

grant select, insert, update, delete on public.user_profiles to authenticated;
grant select, insert, update, delete on public.user_module_permissions to authenticated;

update public.user_profiles
  set is_admin = true
where user_id in (
  select id
  from auth.users
  where lower(email) = 'vitorgabrieldeoliveiradev@gmail.com'
);

update public.user_module_permissions
  set can_view = true,
      can_list = true,
      can_create = true,
      can_edit = true,
      can_delete = true
where user_id in (
  select id
  from auth.users
  where lower(email) = 'vitorgabrieldeoliveiradev@gmail.com'
);
