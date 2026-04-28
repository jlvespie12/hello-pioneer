-- Allow notes posted without an authenticated user. The "anyone can write a note"
-- policy permits the INSERT, but user_id NOT NULL + FK to auth.users blocked
-- truly-anonymous inserts. Drop the NOT NULL so anonymous writes succeed; the FK
-- still applies when a user_id is provided.

alter table public.notes
  alter column user_id drop not null;
