-- Review photos: small JPEG data URLs a Member attaches to their own Review, shown to every Member
-- in the Recipe's gallery. Deleting a Review deletes its photos.
create table public.review_photos (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  -- Shrunk in the browser like Recipe photos (~140 KB); the same limit as Recipe and Profile photos.
  data_url text not null check (data_url like 'data:image/%' and length(data_url) <= 400000),
  created_at timestamptz not null default now()
);

create index review_photos_review_id_idx on public.review_photos (review_id);

-- Whether a Review is the signed-in Member's own (Reviews are readable by every Member).
create function private.is_my_review(target uuid) returns boolean
  language sql stable security definer set search_path = ''
  as $$ select exists (select 1 from public.reviews r where r.id = target and r.user_id = (select auth.uid())) $$;
revoke all on function private.is_my_review(uuid) from public, anon;
grant execute on function private.is_my_review(uuid) to authenticated;

alter table public.review_photos enable row level security;

-- Any Member sees every Review photo. A Member adds and removes photos only on their own Review;
-- Editors and Admins may also delete any Review photo. Photos aren't changed in place.
create policy "review photos: members read" on public.review_photos for select to authenticated
  using ((select private.my_role()) is not null);
create policy "review photos: own insert" on public.review_photos for insert to authenticated
  with check (private.is_my_review(review_id) and (select private.my_role()) is not null);
create policy "review photos: own or editors delete" on public.review_photos for delete to authenticated
  using ((private.is_my_review(review_id) and (select private.my_role()) is not null) or (select private.can_edit_book()));

-- Review photos update live for everyone.
alter publication supabase_realtime add table public.review_photos;
