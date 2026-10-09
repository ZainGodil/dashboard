-- 012_add_paycove_plans.sql
-- Collections report: payment plans from Paycove. Additive, apart from widening two check
-- constraints (sync_log.source and exception_actions.flag_kind) to allow the new values.

-- OAuth tokens for connected services (Paycove). Service role only: never readable from the browser.
create table integration_tokens (
  provider       text primary key,          -- 'paycove'
  access_token   text not null,
  refresh_token  text,
  expires_at     timestamptz,
  connected_by   text not null,
  connected_at   timestamptz not null default now()
);

alter table integration_tokens enable row level security;

-- Paycove invoices ("deals"); quotes are skipped
create table paycove_deals (
  id                  bigint primary key,    -- Paycove deal id
  name                text,
  status              text,                  -- e.g. 'Overdue', 'Paid'
  student_name        text,
  student_email       text,                  -- lower-cased; matches stripe_payments.customer_email
  total_amount        numeric(12,2),
  total_amount_paid   numeric(12,2),
  remaining_balance   numeric(12,2),
  payments_paid       integer,
  payments_unpaid     integer,
  payments_scheduled  integer,
  days_overdue        integer,
  crm_deal_id         text,
  crm_contact_id      text,
  created_in_paycove  timestamptz,
  synced_at           timestamptz not null default now()
);

create index paycove_deals_email_idx on paycove_deals (student_email);

alter table paycove_deals enable row level security;

-- Each installment of a plan
create table paycove_payments (
  id             bigint primary key,         -- Paycove scheduled payment id
  deal_id        bigint not null references paycove_deals (id) on delete cascade,
  number         integer,
  description    text,
  due_on         date,                       -- null when Paycove has no due date set
  amount         numeric(12,2) not null,
  is_paid        boolean not null,
  paid_on        date,
  payable        boolean not null default true,
  synced_at      timestamptz not null default now()
);

create index paycove_payments_deal_idx on paycove_payments (deal_id);
create index paycove_payments_due_idx  on paycove_payments (due_on);

alter table paycove_payments enable row level security;

-- Allow Paycove runs in the sync audit trail
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'sync_log'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%source%'
  loop
    execute format('alter table sync_log drop constraint %I', c);
  end loop;
end $$;
alter table sync_log add constraint sync_log_source_check
  check (source in ('hubspot','google_ads','meta','stripe','paycove'));

-- Allow the new "installment overdue" flag to be handled like the others
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'exception_actions'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%flag_kind%'
  loop
    execute format('alter table exception_actions drop constraint %I', c);
  end loop;
end $$;
alter table exception_actions add constraint exception_actions_flag_kind_check
  check (flag_kind in ('failed','quiet','overdue'));
