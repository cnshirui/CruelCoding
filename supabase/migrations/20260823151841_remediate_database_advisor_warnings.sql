-- Keep extension-owned objects out of the exposed public schema.
create schema if not exists extensions;

alter extension citext set schema extensions;

-- This event-trigger function is invoked by PostgreSQL itself. Client roles do
-- not need RPC access to its SECURITY DEFINER privileges.
revoke execute on function public.rls_auto_enable()
  from public, anon, authenticated;
