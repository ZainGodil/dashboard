-- ============================================================
-- 001_initial_schema.sql
-- Workforce Institute Dashboard — initial schema
-- ============================================================

-- ============================================================
-- contacts
-- Raw HubSpot contact records, upserted on each sync
-- ============================================================
create table contacts (
  id               uuid primary key default gen_random_uuid(),
  hubspot_id       text not null unique,
  first_name       text,
  last_name        text,
  create_date      date,
  course           text check (course in ('Digital Marketing','UI/UX Design','Generative AI Data Analyst','General')),
  original_source  text,
  viable           boolean not null default false,
  lead_status      text,
  qualified        text check (qualified in ('Q','UQ','NA')),
  university       text check (university in ('UTA','WFI','Hofstra','NEIU','SCU')),
  advisor          text,
  segment          text check (segment in ('B2C','WFD')),
  sales_segment    text check (sales_segment in ('B2HE','B2G')),
  enrolled         boolean not null default false,
  synced_at        timestamptz not null default now()
);

create index contacts_create_date_idx  on contacts (create_date);
create index contacts_advisor_idx       on contacts (advisor);
create index contacts_segment_idx       on contacts (segment);
create index contacts_university_idx    on contacts (university);
create index contacts_enrolled_idx      on contacts (enrolled);

-- ============================================================
-- ad_spend
-- Daily spend from Google Ads and Meta
-- ============================================================
create table ad_spend (
  id             uuid primary key default gen_random_uuid(),
  date           date not null,
  platform       text not null check (platform in ('google','meta')),
  university     text check (university in ('UTA','WFI','Hofstra','NEIU','SCU')),
  course         text check (course in ('Digital Marketing','UI/UX Design','Generative AI Data Analyst','General')),
  segment        text check (segment in ('B2C','WFD')),
  spend          numeric(12,2) not null default 0,
  impressions    integer not null default 0,
  clicks         integer not null default 0,
  campaign_name  text not null,
  synced_at      timestamptz not null default now(),
  unique (date, platform, campaign_name)
);

create index ad_spend_date_idx      on ad_spend (date);
create index ad_spend_platform_idx  on ad_spend (platform);
create index ad_spend_university_idx on ad_spend (university);
create index ad_spend_course_idx    on ad_spend (course);

-- ============================================================
-- campaign_mapping
-- Manual override table: ad campaign name → SBU/brand
-- ============================================================
create table campaign_mapping (
  id                     uuid primary key default gen_random_uuid(),
  platform               text not null check (platform in ('google','meta')),
  campaign_name_pattern  text not null,
  university             text check (university in ('UTA','WFI','Hofstra','NEIU','SCU')),
  course                 text check (course in ('Digital Marketing','UI/UX Design','Generative AI Data Analyst','General')),
  segment                text check (segment in ('B2C','WFD')),
  notes                  text,
  created_at             timestamptz not null default now()
);

-- ============================================================
-- enrollments
-- Enrollment events derived from HubSpot contacts
-- ============================================================
create table enrollments (
  id                  uuid primary key default gen_random_uuid(),
  contact_id          uuid not null references contacts (id) on delete cascade,
  hubspot_contact_id  text not null,
  course              text check (course in ('Digital Marketing','UI/UX Design','Generative AI Data Analyst','General')),
  university          text check (university in ('UTA','WFI','Hofstra','NEIU','SCU')),
  segment             text check (segment in ('B2C','WFD')),
  source              text,
  enrolled_at         date,
  month               text,
  unique (hubspot_contact_id)
);

create index enrollments_month_idx      on enrollments (month);
create index enrollments_university_idx on enrollments (university);
create index enrollments_course_idx     on enrollments (course);

-- ============================================================
-- cac_metrics
-- Pre-computed monthly rollup, refreshed on each HubSpot sync
-- ============================================================
create table cac_metrics (
  id           uuid primary key default gen_random_uuid(),
  month        text not null,
  course       text check (course in ('Digital Marketing','UI/UX Design','Generative AI Data Analyst','General')),
  university   text check (university in ('UTA','WFI','Hofstra','NEIU','SCU')),
  segment      text check (segment in ('B2C','WFD')),
  source       text,
  leads        integer not null default 0,
  enrollments  integer not null default 0,
  cvr          numeric(8,4) not null default 0,
  spend        numeric(12,2) not null default 0,
  cpl          numeric(12,2) not null default 0,
  cac          numeric(12,2) not null default 0,
  computed_at  timestamptz not null default now(),
  unique (month, course, university, segment, source)
);

create index cac_metrics_month_idx on cac_metrics (month);

-- ============================================================
-- rolling_metrics
-- Pre-aggregated 90-day rolling window, refreshed nightly
-- ============================================================
create table rolling_metrics (
  id               uuid primary key default gen_random_uuid(),
  as_of_date       date not null,
  course           text check (course in ('Digital Marketing','UI/UX Design','Generative AI Data Analyst','General')),
  university       text check (university in ('UTA','WFI','Hofstra','NEIU','SCU')),
  segment          text check (segment in ('B2C','WFD')),
  source           text,
  leads_90d        integer not null default 0,
  enrollments_90d  integer not null default 0,
  spend_90d        numeric(12,2) not null default 0,
  cvr_90d          numeric(8,4) not null default 0,
  cpl_90d          numeric(12,2) not null default 0,
  cac_90d          numeric(12,2) not null default 0,
  unique (as_of_date, course, university, segment, source)
);

-- ============================================================
-- sync_log
-- Audit trail for all sync jobs
-- ============================================================
create table sync_log (
  id              uuid primary key default gen_random_uuid(),
  source          text not null check (source in ('hubspot','google_ads','meta')),
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  records_synced  integer not null default 0,
  status          text not null check (status in ('success','error')),
  error_message   text
);

create index sync_log_source_idx     on sync_log (source);
create index sync_log_started_at_idx on sync_log (started_at desc);

-- ============================================================
-- Row Level Security
-- Service role has full access; anon role has no access
-- ============================================================
alter table contacts         enable row level security;
alter table ad_spend         enable row level security;
alter table campaign_mapping enable row level security;
alter table enrollments      enable row level security;
alter table cac_metrics      enable row level security;
alter table rolling_metrics  enable row level security;
alter table sync_log         enable row level security;

-- ============================================================
-- campaign_mapping seed data
-- Known edge cases from the CAC Report Excel
-- ============================================================
insert into campaign_mapping (platform, campaign_name_pattern, university, course, segment, notes) values
  ('meta',   'WIOA',             null,      null,                         'WFD', 'WIOA government funding campaigns map to WFD segment'),
  ('meta',   'WFD',              null,      null,                         'WFD', 'Workforce Development Meta campaigns'),
  ('google', 'Gen AI',           null,      'Generative AI Data Analyst', null,  'Short form of Generative AI in older campaign names'),
  ('google', 'GenAI',            null,      'Generative AI Data Analyst', null,  'Alternate short form'),
  ('google', 'Data Analytics',   null,      'Generative AI Data Analyst', null,  'Legacy campaign name before rebrand'),
  ('google', 'Digital Mktg',     null,      'Digital Marketing',          null,  'Abbreviated form in some campaign names'),
  ('meta',   'UI/UX',            null,      'UI/UX Design',               null,  'Meta UI/UX campaigns without brackets'),
  ('meta',   'Hofstra',          'Hofstra', null,                         null,  'Hofstra-specific Meta campaigns');
