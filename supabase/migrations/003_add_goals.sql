-- ============================================================
-- 003_add_goals.sql
-- Goals table — monthly and yearly targets for spend, leads, enrollments
-- ============================================================

create table goals (
  id                   uuid primary key default gen_random_uuid(),
  period_type          text not null check (period_type in ('monthly', 'yearly')),
  period               text not null,  -- e.g. "Jan-26" (monthly) or "2026" (yearly)
  spend_target         numeric,
  leads_target         integer,
  enrollments_target   integer,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (period_type, period)
);

create index goals_period_type_idx on goals (period_type);
create index goals_period_idx      on goals (period);
