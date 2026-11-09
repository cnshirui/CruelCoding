-- Email + password login next to Google. scrypt hash from lib/auth.ts; null = no password set.
alter table public.app_users add column password_hash text;
