-- 011_add_exception_actions.sql
-- Collections report, Phase 4: mark exception-queue flags as handled. Additive only.
--
-- A flag is identified by the student, the kind of flag and the event that raised it
-- (flag_since: the failed charge's time, or the last successful payment's time). A newer
-- event raises a new flag, so a handled note never hides a fresh problem.

create table exception_actions (
  id            uuid primary key default gen_random_uuid(),
  student_key   text not null,             -- same key as student_status
  flag_kind     text not null check (flag_kind in ('failed','quiet')),
  flag_since    timestamptz not null,
  note          text not null check (length(note) between 1 and 1000),
  follow_up_on  date,                      -- flag comes back on this date
  created_by    text not null,
  created_at    timestamptz not null default now(),
  reopened_at   timestamptz,
  reopened_by   text
);

create index exception_actions_student_idx on exception_actions (student_key, flag_kind, flag_since);

alter table exception_actions enable row level security;
