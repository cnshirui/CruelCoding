create table public.signup_activation_codes (
  email_hash text primary key check (email_hash ~ '^[0-9a-f]{64}$'),
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  sent_at timestamptz not null default now(),
  attempts smallint not null default 0 check (attempts between 0 and 5),
  created_at timestamptz not null default now()
);

alter table public.signup_activation_codes enable row level security;
revoke all on public.signup_activation_codes from anon, authenticated;

create index signup_activation_codes_expires_at_idx
  on public.signup_activation_codes (expires_at);
