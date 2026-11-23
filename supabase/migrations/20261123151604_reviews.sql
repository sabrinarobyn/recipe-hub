-- Reviews: one Member's 1 to 5 stars and optional comment on a Recipe; one per Member and Recipe.
-- recipe_id names a Recipe by its id with no foreign key: the original spreadsheet Recipes have no
-- record in public.recipes (docs/adr/0001-one-record-per-recipe.md) and can still be reviewed.
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  recipe_id text not null check (char_length(recipe_id) between 1 and 200),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A second Review by the same Member replaces the first (the app upserts on this).
  unique (recipe_id, user_id)
);

create index reviews_user_id_idx on public.reviews (user_id);

create trigger reviews_touch_updated_at
  before update on public.reviews
  for each row execute function private.touch_updated_at();

alter table public.reviews enable row level security;

-- Any Member reads every Review. A Member writes only their own; Editors and Admins may also
-- delete any Review. Removing a Member from the invite list keeps their Reviews.
create policy "reviews: members read" on public.reviews for select to authenticated
  using ((select private.my_role()) is not null);
create policy "reviews: own insert" on public.reviews for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.my_role()) is not null);
create policy "reviews: own update" on public.reviews for update to authenticated
  using (user_id = (select auth.uid()) and (select private.my_role()) is not null)
  with check (user_id = (select auth.uid()) and (select private.my_role()) is not null);
create policy "reviews: own or editors delete" on public.reviews for delete to authenticated
  using ((user_id = (select auth.uid()) and (select private.my_role()) is not null) or (select private.can_edit_book()));

-- Reviews update live for everyone.
alter publication supabase_realtime add table public.reviews;
