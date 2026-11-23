-- The Recipe Book's recipes as one record per Recipe (docs/adr/0001-one-record-per-recipe.md).
-- The original spreadsheet Recipes stay in the app as the base; a record overlays one Recipe:
--   a record with a body       = an added Recipe, or an edited original;
--   a record marked deleted     = a removed Recipe ("Removed recipes");
--   no record                   = the original as it is ("Undo my changes" deletes the record).
-- Product catalogue edits and categories stay in the shared book_parts 'catalog' block.

create table public.recipes (
  id text primary key,
  -- The Member who added it; empty for the original spreadsheet Recipes and older edits.
  author_id uuid references auth.users (id) on delete set null,
  body jsonb,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  -- Only a removed Recipe may have no body.
  check (deleted or coalesce(jsonb_typeof(body), '') = 'object')
);

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger recipes_touch_updated_at
  before update on public.recipes
  for each row execute function private.touch_updated_at();

alter table public.recipes enable row level security;

-- For now: any Member reads; Editors and Admins write. (Authors come later.)
create policy "recipes: members read" on public.recipes for select to authenticated
  using ((select private.my_role()) is not null);
create policy "recipes: editors insert" on public.recipes for insert to authenticated
  with check ((select private.can_edit_book()));
create policy "recipes: editors update" on public.recipes for update to authenticated
  using ((select private.can_edit_book())) with check ((select private.can_edit_book()));
create policy "recipes: editors delete" on public.recipes for delete to authenticated
  using ((select private.can_edit_book()));

alter publication supabase_realtime add table public.recipes;

-- Carry the edits saved in the shared block into records, then retire that block.
-- Each entry of recipeEdits is a Recipe (an edit or an added Recipe) or null (removed).
insert into public.recipes (id, body, deleted, created_at, updated_at, updated_by)
select e.key,
       case when jsonb_typeof(e.value) = 'object' then e.value end,
       jsonb_typeof(e.value) = 'null',
       b.updated_at, b.updated_at, b.updated_by
from public.book_parts b
cross join lateral jsonb_each(coalesce(b.body -> 'recipeEdits', '{}'::jsonb)) e
where b.part = 'recipes' and jsonb_typeof(e.value) in ('object', 'null');

delete from public.book_parts where part = 'recipes';
alter table public.book_parts drop constraint book_parts_part_check;
alter table public.book_parts add constraint book_parts_part_check check (part = 'catalog');
