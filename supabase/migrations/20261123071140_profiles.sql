-- Profiles: each Member's display name and photo, shown to the other Members.
-- No email here: other Members see a Member's name and photo, never their email.
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 60),
  -- A small JPEG data URL, shrunk in the browser like Recipe photos.
  photo text check (photo is null or length(photo) <= 400000),
  -- When the Member was first asked for a display name (answered or skipped), so it's asked once.
  name_asked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: members read" on public.profiles for select to authenticated
  using ((select private.my_role()) is not null);
create policy "profiles: own insert" on public.profiles for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.my_role()) is not null);
create policy "profiles: own update" on public.profiles for update to authenticated
  using (user_id = (select auth.uid()) and (select private.my_role()) is not null)
  with check (user_id = (select auth.uid()) and (select private.my_role()) is not null);

-- Profiles update live for everyone.
alter publication supabase_realtime add table public.profiles;
