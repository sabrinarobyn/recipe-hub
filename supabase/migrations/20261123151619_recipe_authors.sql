-- Authors: any Member adds Recipes and is recorded as their Author.
-- Authors change their own Recipes and set their Main Photo; Editors and Admins change any Recipe,
-- including the originals, which have no Author. Taking a Member off the invite list keeps their
-- Recipes (author_id points at their account, which stays), but they can't change them any more.

-- Whether the signed-in Member is on the invite list and authored this Recipe.
create function private.is_my_recipe(recipe_id text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.my_role() is not null
     and exists (select 1 from public.recipes r where r.id = recipe_id and r.author_id = auth.uid())
$$;
revoke execute on function private.is_my_recipe(text) from public, anon;
grant execute on function private.is_my_recipe(text) to authenticated;

-- Recipes: Editors and Admins write any Recipe (adding with no Author, or as themselves);
-- any other Member adds Recipes only as themselves and changes only those.
drop policy "recipes: editors insert" on public.recipes;
drop policy "recipes: editors update" on public.recipes;
drop policy "recipes: editors delete" on public.recipes;

create policy "recipes: editors or author insert" on public.recipes for insert to authenticated
  with check (
    ((select private.can_edit_book()) and (author_id is null or author_id = (select auth.uid())))
    or (author_id = (select auth.uid()) and (select private.my_role()) is not null)
  );
create policy "recipes: editors or author update" on public.recipes for update to authenticated
  using ((select private.can_edit_book()) or (author_id = (select auth.uid()) and (select private.my_role()) is not null))
  with check ((select private.can_edit_book()) or (author_id = (select auth.uid()) and (select private.my_role()) is not null));
create policy "recipes: editors or author delete" on public.recipes for delete to authenticated
  using ((select private.can_edit_book()) or (author_id = (select auth.uid()) and (select private.my_role()) is not null));

-- A Member who can't edit every Recipe always adds Recipes as themselves. The app saves an
-- Author's changes with an upsert that leaves author_id out, and an upsert's row is checked
-- against the insert rule too, so it needs the Author filled in (the update keeps the stored one).
create function private.fill_recipe_author() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.author_id is null and not private.can_edit_book() then
    new.author_id := auth.uid();
  end if;
  return new;
end
$$;

create trigger recipes_fill_author
  before insert on public.recipes
  for each row execute function private.fill_recipe_author();

-- Main Photos: Editors and Admins for any Recipe, Authors for their own.
create policy "photos: author insert" on public.photos for insert to authenticated
  with check (private.is_my_recipe(recipe_id));
create policy "photos: author update" on public.photos for update to authenticated
  using (private.is_my_recipe(recipe_id)) with check (private.is_my_recipe(recipe_id));
create policy "photos: author delete" on public.photos for delete to authenticated
  using (private.is_my_recipe(recipe_id));

-- Products any Member adds while writing a Recipe. They're added once and never changed here:
-- Editors change Products (these included) in the shared 'catalog' block, which overlays them.
create table public.products (
  key text primary key check (key <> ''),
  body jsonb not null check (jsonb_typeof(body) = 'object'),
  author_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;

create policy "products: members read" on public.products for select to authenticated
  using ((select private.my_role()) is not null);
create policy "products: members add as themselves" on public.products for insert to authenticated
  with check (author_id = (select auth.uid()) and (select private.my_role()) is not null);

alter publication supabase_realtime add table public.products;
