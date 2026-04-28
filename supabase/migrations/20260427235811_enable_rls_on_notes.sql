-- Open SELECT and INSERT to all roles (anon + authenticated). Permissive
-- policies OR-combine, so these effectively override the prior own-row
-- restrictions for SELECT/INSERT. UPDATE/DELETE remain own-row only.

alter table public.notes enable row level security;

create policy "anyone can read notes"
  on public.notes for select
  using (true);

create policy "anyone can write a note"
  on public.notes for insert
  with check (true);
