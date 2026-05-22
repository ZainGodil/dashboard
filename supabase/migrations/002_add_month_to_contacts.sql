-- Add computed month column to contacts for faster CAC aggregation
alter table contacts add column if not exists month text;

-- Backfill from create_date
update contacts
set month = to_char(create_date, 'Mon-YY')
where create_date is not null and month is null;

create index if not exists contacts_month_idx on contacts (month);
