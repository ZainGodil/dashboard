-- 010_add_collections_manual_entries.sql
-- Collections report, Phase 3. Additive only.

-- Payments that never touch Stripe (WFD, lenders, bank transfers), recorded by hand in the app.
-- Rows are soft-deleted so a mistaken entry can be removed without losing the audit trail.
create table manual_payments (
  id             uuid primary key default gen_random_uuid(),
  student_name   text not null,
  student_email  text,                       -- lower-cased; matches stripe_payments.customer_email
  payer          text not null check (payer in (
                   'WFD','Sallie Mae','Climb Credit','Meritize','Credee',
                   'Vocational Rehabilitation Services','Direct','Bank transfer','Other')),
  amount         numeric(12,2) not null check (amount > 0),
  paid_on        date not null,
  month          text not null,              -- 'Jan-26', same format as stripe_payments.month
  note           text,
  created_by     text not null,
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  deleted_by     text
);

create index manual_payments_paid_on_idx on manual_payments (paid_on);
create index manual_payments_email_idx   on manual_payments (student_email);

alter table manual_payments enable row level security;

-- Student status set from the Collections page. student_key is the email when known,
-- otherwise 'name:<student name>' (same key the report groups by).
create table student_status (
  student_key  text primary key,
  status       text not null check (status in ('Active','Graduated','Dropped','Blocked','On Hold')),
  updated_by   text not null,
  updated_at   timestamptz not null default now()
);

alter table student_status enable row level security;
