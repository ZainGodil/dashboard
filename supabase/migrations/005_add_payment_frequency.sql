-- Add payment_frequency to enrollments for AOV / LTV / ROAS calculations
alter table enrollments add column if not exists payment_frequency text;
