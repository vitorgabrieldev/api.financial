do $$
declare
  admin_email constant text := 'vitorgabrieldeoliveiradev@gmail.com';
  admin_password constant text := 'Vitorgabrieldev100.';
  admin_user_id uuid;
begin
  select u.id
  into admin_user_id
  from auth.users u
  where u.email = admin_email
  limit 1;

  if admin_user_id is null then
    admin_user_id := gen_random_uuid();

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
      admin_user_id,
      'authenticated',
      'authenticated',
      admin_email,
      extensions.crypt(admin_password, extensions.gen_salt('bf')),
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
  else
    update auth.users
      set encrypted_password = extensions.crypt(admin_password, extensions.gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, timezone('utc', now())),
          updated_at = timezone('utc', now())
    where id = admin_user_id;
  end if;

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
    admin_user_id,
    admin_user_id::text,
    'email',
    jsonb_build_object(
      'sub', admin_user_id::text,
      'email', admin_email,
      'email_verified', true
    ),
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (provider_id, provider) do nothing;

  insert into public.user_preferences (user_id, default_currency, locale, session_max_hours)
  values (admin_user_id, 'BRL', 'pt-BR', 4)
  on conflict (user_id) do nothing;

  insert into public.accounts (user_id, name, type, currency, initial_balance)
  values (admin_user_id, 'Conta principal', 'checking', 'BRL', 0)
  on conflict (user_id, normalized_name) do nothing;

  insert into public.categories (user_id, name, kind, color, icon, is_system)
  values
    (admin_user_id, 'Salário', 'income', '#884545', 'LuBriefcaseBusiness', true),
    (admin_user_id, 'Freelance', 'income', '#a65454', 'LuLaptop', true),
    (admin_user_id, 'Investimentos', 'income', '#7b3a3a', 'LuTrendingUp', true),
    (admin_user_id, 'Outras receitas', 'income', '#b06767', 'LuPlus', true),
    (admin_user_id, 'Moradia', 'expense', '#8a2d2d', 'LuHouse', true),
    (admin_user_id, 'Alimentação', 'expense', '#994040', 'LuUtensilsCrossed', true),
    (admin_user_id, 'Transporte', 'expense', '#b25050', 'LuBus', true),
    (admin_user_id, 'Saúde', 'expense', '#aa4a4a', 'LuHeartPulse', true),
    (admin_user_id, 'Educação', 'expense', '#7f3f3f', 'LuBookOpen', true),
    (admin_user_id, 'Lazer', 'expense', '#b45e5e', 'LuGamepad2', true),
    (admin_user_id, 'Contas e boletos', 'expense', '#893737', 'LuReceiptText', true),
    (admin_user_id, 'Outras despesas', 'expense', '#bf7272', 'LuCircleEllipsis', true)
  on conflict (user_id, normalized_name, kind) do nothing;

  insert into public.user_profiles (user_id, email, full_name, is_admin)
  values (
    admin_user_id,
    admin_email,
    'Vitor Gabriel',
    true
  )
  on conflict (user_id) do update
  set email = excluded.email,
      full_name = excluded.full_name,
      is_admin = true;

  insert into public.user_module_permissions (
    user_id, module, can_view, can_list, can_create, can_edit, can_delete
  )
  values
    (admin_user_id, 'dashboard', true, true, true, true, true),
    (admin_user_id, 'transactions', true, true, true, true, true),
    (admin_user_id, 'categories', true, true, true, true, true),
    (admin_user_id, 'accounts', true, true, true, true, true),
    (admin_user_id, 'goals', true, true, true, true, true),
    (admin_user_id, 'reports', true, true, true, true, true),
    (admin_user_id, 'users', true, true, true, true, true)
  on conflict (user_id, module) do update
  set can_view = excluded.can_view,
      can_list = excluded.can_list,
      can_create = excluded.can_create,
      can_edit = excluded.can_edit,
      can_delete = excluded.can_delete;
end
$$;
