create or replace function public.fill_contest_catalog_fields()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.contest_number is not null then
    new.title := coalesce(new.title, 'Weekly Contest ' || new.contest_number);
    new.title_slug := coalesce(new.title_slug, 'weekly-contest-' || new.contest_number);
  end if;
  return new;
end;
$$;

revoke all on function public.fill_contest_catalog_fields() from public, anon, authenticated;

create trigger contests_fill_catalog_fields
before insert or update on public.contests
for each row execute function public.fill_contest_catalog_fields();
