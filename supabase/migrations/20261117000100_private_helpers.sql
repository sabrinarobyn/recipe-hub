-- Keep the role helpers out of the public API; RLS policies still use them.
create schema if not exists private;
grant usage on schema private to authenticated;
alter function public.my_role() set schema private;
alter function public.can_edit_book() set schema private;
alter function public.check_invited() set schema private;
create or replace function private.can_edit_book() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.my_role() in ('admin', 'editor'), false)
$$;
revoke execute on all functions in schema private from public, anon;
grant execute on function private.my_role(), private.can_edit_book() to authenticated;

-- The app asks for the signed-in person's role through this.
create function public.whoami() returns table (email text, role text)
language sql stable security invoker set search_path = ''
as $$
  select m.email, m.role from public.members m where m.email = lower(auth.jwt() ->> 'email')
$$;
revoke execute on function public.whoami() from public, anon;
grant execute on function public.whoami() to authenticated;
