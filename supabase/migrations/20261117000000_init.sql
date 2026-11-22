-- Recipe Hub: invite-only accounts, one shared recipe book, private plans.

-- People who may sign in. Emails are stored in lower case.
create table public.members (
  email text primary key check (email = lower(email)),
  role text not null default 'viewer' check (role in ('admin', 'editor', 'viewer')),
  added_at timestamptz not null default now()
);

-- The shared recipe book, in two parts like the app keeps it:
-- 'catalog' = { productEdits, categories }, 'recipes' = { recipeEdits }.
create table public.book_parts (
  part text primary key check (part in ('catalog', 'recipes')),
  body jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

-- Recipe photos as small JPEG data URLs (the app shrinks them to ~140 KB).
create table public.photos (
  recipe_id text primary key,
  data_url text not null check (length(data_url) <= 400000),
  updated_at timestamptz not null default now()
);

-- Each person's plan, shopping lists and settings.
create table public.personal (
  user_id uuid primary key references auth.users (id) on delete cascade,
  body jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Role of the signed-in person, or null if they aren't on the list.
create function public.my_role() returns text
language sql stable security definer set search_path = ''
as $$
  select m.role from public.members m where m.email = lower(auth.jwt() ->> 'email')
$$;

create function public.can_edit_book() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.my_role() in ('admin', 'editor'), false)
$$;

-- Only invited emails can create an account.
create function public.check_invited() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.members m where m.email = lower(new.email)) then
    raise exception 'not_invited: % is not on the Recipe Hub invite list', new.email;
  end if;
  return new;
end
$$;

create trigger only_invited_users
  before insert on auth.users
  for each row execute function public.check_invited();

revoke execute on function public.check_invited() from public, anon, authenticated;

alter table public.members enable row level security;
alter table public.book_parts enable row level security;
alter table public.photos enable row level security;
alter table public.personal enable row level security;

-- members: everyone sees their own row; admins see and manage everyone.
create policy "members: read own or admin" on public.members for select to authenticated
  using (email = lower(auth.jwt() ->> 'email') or (select public.my_role()) = 'admin');
create policy "members: admin insert" on public.members for insert to authenticated
  with check ((select public.my_role()) = 'admin');
create policy "members: admin update" on public.members for update to authenticated
  using ((select public.my_role()) = 'admin') with check ((select public.my_role()) = 'admin');
create policy "members: admin delete" on public.members for delete to authenticated
  using ((select public.my_role()) = 'admin' and email <> lower(auth.jwt() ->> 'email'));

-- book and photos: members read, admins and editors write.
create policy "book: members read" on public.book_parts for select to authenticated
  using ((select public.my_role()) is not null);
create policy "book: editors insert" on public.book_parts for insert to authenticated
  with check ((select public.can_edit_book()));
create policy "book: editors update" on public.book_parts for update to authenticated
  using ((select public.can_edit_book())) with check ((select public.can_edit_book()));

create policy "photos: members read" on public.photos for select to authenticated
  using ((select public.my_role()) is not null);
create policy "photos: editors insert" on public.photos for insert to authenticated
  with check ((select public.can_edit_book()));
create policy "photos: editors update" on public.photos for update to authenticated
  using ((select public.can_edit_book())) with check ((select public.can_edit_book()));
create policy "photos: editors delete" on public.photos for delete to authenticated
  using ((select public.can_edit_book()));

-- personal: each member only their own row.
create policy "personal: own" on public.personal for all to authenticated
  using (user_id = (select auth.uid()) and (select public.my_role()) is not null)
  with check (user_id = (select auth.uid()) and (select public.my_role()) is not null);

-- Live updates for the book and photos.
alter publication supabase_realtime add table public.book_parts, public.photos;
