-- Hybrid Pro subscriptions + Pine Labs payments
-- Website activates access through app APIs; clients may only read their own row.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text not null,
  mobile text,
  plan_id text not null,
  next_plan_id text,
  status text not null default 'pending',
  starts_at timestamptz,
  expires_at timestamptz,
  pine_order_id text,
  merchant_order_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists subscriptions_pine_order_uidx
  on public.subscriptions (pine_order_id)
  where pine_order_id is not null;

create unique index if not exists subscriptions_merchant_ref_uidx
  on public.subscriptions (merchant_order_reference)
  where merchant_order_reference is not null;

create index if not exists subscriptions_email_idx on public.subscriptions (email);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions(id) on delete cascade,
  email text not null,
  plan_id text not null,
  amount_paise integer not null,
  currency text not null default 'INR',
  pine_order_id text,
  status text not null default 'paid',
  paid_at timestamptz not null default now()
);

create unique index if not exists payments_pine_order_uidx
  on public.payments (pine_order_id)
  where pine_order_id is not null;

create index if not exists payments_email_idx on public.payments (email);

alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
on public.subscriptions for select
to authenticated
using (
  user_id = (select auth.uid())
  or lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
);

drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own"
on public.payments for select
to authenticated
using (
  lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  or exists (
    select 1
    from public.subscriptions s
    where s.id = payments.subscription_id
      and s.user_id = (select auth.uid())
  )
);
