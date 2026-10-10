-- 013_add_hubspot_contact_emails.sql
-- Email for each enrolled HubSpot contact, so the Collections page can show each student's
-- booking amount (enrollments.deal_amount, the figure behind the CAC report's Bookings).
-- Filled by the Stripe sync; the HubSpot sync itself is unchanged. Additive only.

create table hubspot_contact_emails (
  hubspot_id  text primary key,              -- matches enrollments.hubspot_contact_id
  email       text,                          -- lower-cased
  synced_at   timestamptz not null default now()
);

create index hubspot_contact_emails_email_idx on hubspot_contact_emails (email);

alter table hubspot_contact_emails enable row level security;
