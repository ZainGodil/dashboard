-- Add UTSA to university check constraints on all relevant tables
-- PostgreSQL auto-names inline check constraints as <table>_<column>_check

alter table contacts
  drop constraint if exists contacts_university_check,
  add constraint contacts_university_check
    check (university in ('UTA','WFI','Hofstra','NEIU','SCU','UTSA'));

alter table ad_spend
  drop constraint if exists ad_spend_university_check,
  add constraint ad_spend_university_check
    check (university in ('UTA','WFI','Hofstra','NEIU','SCU','UTSA'));

alter table campaign_mapping
  drop constraint if exists campaign_mapping_university_check,
  add constraint campaign_mapping_university_check
    check (university in ('UTA','WFI','Hofstra','NEIU','SCU','UTSA'));

alter table enrollments
  drop constraint if exists enrollments_university_check,
  add constraint enrollments_university_check
    check (university in ('UTA','WFI','Hofstra','NEIU','SCU','UTSA'));

alter table cac_metrics
  drop constraint if exists cac_metrics_university_check,
  add constraint cac_metrics_university_check
    check (university in ('UTA','WFI','Hofstra','NEIU','SCU','UTSA'));

alter table rolling_metrics
  drop constraint if exists rolling_metrics_university_check,
  add constraint rolling_metrics_university_check
    check (university in ('UTA','WFI','Hofstra','NEIU','SCU','UTSA'));
