-- 009_add_stripe_payments.sql
-- Stripe charges for the Collections report, additive only. Does not touch
-- contacts, enrollments, deals or any metrics tables.

create table stripe_payments (
  id               text primary key,          -- Stripe charge id (ch_… for cards, py_… for bank payments)
  payment_intent   text,
  customer_id      text,
  customer_email   text,
  customer_name    text,
  amount           numeric(12,2) not null,    -- dollars, not cents
  amount_refunded  numeric(12,2) not null default 0,
  currency         text not null,
  status           text not null check (status in ('succeeded','pending','failed')),
  payment_method   text,                      -- card, us_bank_account, ach_debit, …
  failure_code     text,
  failure_message  text,
  description      text,
  created_at       timestamptz not null,
  month            text not null,             -- 'Jan-26', America/Chicago, same format as contacts.month
  synced_at        timestamptz not null default now()
);

create index stripe_payments_created_at_idx     on stripe_payments (created_at);
create index stripe_payments_month_idx          on stripe_payments (month);
create index stripe_payments_customer_email_idx on stripe_payments (customer_email);
create index stripe_payments_status_idx         on stripe_payments (status);

alter table stripe_payments enable row level security;

-- Allow Stripe runs in the sync audit trail
alter table sync_log drop constraint if exists sync_log_source_check;
alter table sync_log add constraint sync_log_source_check
  check (source in ('hubspot','google_ads','meta','stripe'));
