-- 008_add_deals.sql
-- Deal-stage tracking, additive only. Does not touch contacts, enrollments,
-- cac_metrics, or rolling_metrics — those keep their existing behavior.
create table deals (
  id                  uuid primary key default gen_random_uuid(),
  hubspot_deal_id     text not null unique,
  contact_hubspot_id  text,
  advisor             text,
  stage_label         text,
  amount              numeric(12,2),
  payment_frequency   text,
  close_date          date,
  month               text,
  synced_at           timestamptz not null default now()
);

create index deals_month_idx   on deals (month);
create index deals_advisor_idx on deals (advisor);

alter table deals enable row level security;
