-- Stores manual user edits to campaign classification (course/university).
-- These survive ad syncs, which re-parse and overwrite ad_spend.course/university.
-- The spend pages merge this table with ad_spend at read time, preferring overrides.
create table campaign_overrides (
  id           uuid primary key default gen_random_uuid(),
  campaign_name text not null,
  platform      text not null check (platform in ('google', 'meta')),
  course        text,
  university    text,
  updated_at    timestamptz not null default now(),
  unique (campaign_name, platform)
);

create index campaign_overrides_platform_idx on campaign_overrides (platform);
