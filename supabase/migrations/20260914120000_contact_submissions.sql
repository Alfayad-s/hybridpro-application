-- Contact form leads for coach admin

create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  goal text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create index if not exists contact_submissions_created_idx
  on public.contact_submissions (created_at desc);

create index if not exists contact_submissions_email_idx
  on public.contact_submissions (email);

alter table public.contact_submissions enable row level security;
