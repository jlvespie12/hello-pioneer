-- notes: minimal note-taking schema, one row per note, owned by an auth user.

create table public.notes (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  title       text        not null,
  content     text        not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index notes_user_id_updated_at_idx
  on public.notes (user_id, updated_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger notes_set_updated_at
before update on public.notes
for each row execute function public.set_updated_at();

alter table public.notes enable row level security;

create policy "notes_select_own"
  on public.notes for select
  using (auth.uid() = user_id);

create policy "notes_insert_own"
  on public.notes for insert
  with check (auth.uid() = user_id);

create policy "notes_update_own"
  on public.notes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "notes_delete_own"
  on public.notes for delete
  using (auth.uid() = user_id);
