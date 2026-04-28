-- email_events: one row per email lifecycle event. The 'sent' row is inserted
-- by /api/share when an email is dispatched; downstream rows (delivered,
-- opened, clicked, bounced) are inserted by /api/resend-webhook from the
-- Resend webhook payload, linked back to the note via message_id.

create table public.email_events (
  id          uuid        primary key default gen_random_uuid(),
  message_id  text        not null,
  note_id     uuid        references public.notes(id) on delete cascade,
  recipient   text        not null,
  event_type  text        not null,
  created_at  timestamptz not null default now()
);

create index email_events_note_id_created_at_idx
  on public.email_events (note_id, created_at desc);

create index email_events_message_id_idx
  on public.email_events (message_id);

alter table public.email_events enable row level security;

-- Mirror the open-by-default policy used by public.notes in this demo app.
create policy "anyone can read email_events"
  on public.email_events for select
  using (true);

create policy "anyone can insert email_events"
  on public.email_events for insert
  with check (true);
