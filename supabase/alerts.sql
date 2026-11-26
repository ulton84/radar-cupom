create table if not exists public.user_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  keyword text not null,
  store_id uuid references public.stores(id) on delete set null,
  max_price_cents integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.user_alerts enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "own alerts" on public.user_alerts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own subscriptions" on public.push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
