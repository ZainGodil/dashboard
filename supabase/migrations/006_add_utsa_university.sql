-- Add UTSA to university check constraints on all relevant tables.
-- Uses dynamic DO blocks to drop whatever name PostgreSQL auto-generated,
-- then adds a consistently-named constraint.

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT constraint_name FROM information_schema.table_constraints
           WHERE table_name = 'contacts' AND constraint_type = 'CHECK'
             AND constraint_name LIKE '%university%'
  LOOP EXECUTE 'ALTER TABLE contacts DROP CONSTRAINT ' || quote_ident(r.constraint_name); END LOOP;
END $$;
ALTER TABLE contacts ADD CONSTRAINT contacts_university_check
  CHECK (university IN ('UTA','WFI','Hofstra','NEIU','SCU','UTSA'));

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT constraint_name FROM information_schema.table_constraints
           WHERE table_name = 'ad_spend' AND constraint_type = 'CHECK'
             AND constraint_name LIKE '%university%'
  LOOP EXECUTE 'ALTER TABLE ad_spend DROP CONSTRAINT ' || quote_ident(r.constraint_name); END LOOP;
END $$;
ALTER TABLE ad_spend ADD CONSTRAINT ad_spend_university_check
  CHECK (university IN ('UTA','WFI','Hofstra','NEIU','SCU','UTSA'));

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT constraint_name FROM information_schema.table_constraints
           WHERE table_name = 'campaign_mapping' AND constraint_type = 'CHECK'
             AND constraint_name LIKE '%university%'
  LOOP EXECUTE 'ALTER TABLE campaign_mapping DROP CONSTRAINT ' || quote_ident(r.constraint_name); END LOOP;
END $$;
ALTER TABLE campaign_mapping ADD CONSTRAINT campaign_mapping_university_check
  CHECK (university IN ('UTA','WFI','Hofstra','NEIU','SCU','UTSA'));

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT constraint_name FROM information_schema.table_constraints
           WHERE table_name = 'enrollments' AND constraint_type = 'CHECK'
             AND constraint_name LIKE '%university%'
  LOOP EXECUTE 'ALTER TABLE enrollments DROP CONSTRAINT ' || quote_ident(r.constraint_name); END LOOP;
END $$;
ALTER TABLE enrollments ADD CONSTRAINT enrollments_university_check
  CHECK (university IN ('UTA','WFI','Hofstra','NEIU','SCU','UTSA'));

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT constraint_name FROM information_schema.table_constraints
           WHERE table_name = 'cac_metrics' AND constraint_type = 'CHECK'
             AND constraint_name LIKE '%university%'
  LOOP EXECUTE 'ALTER TABLE cac_metrics DROP CONSTRAINT ' || quote_ident(r.constraint_name); END LOOP;
END $$;
ALTER TABLE cac_metrics ADD CONSTRAINT cac_metrics_university_check
  CHECK (university IN ('UTA','WFI','Hofstra','NEIU','SCU','UTSA'));

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT constraint_name FROM information_schema.table_constraints
           WHERE table_name = 'rolling_metrics' AND constraint_type = 'CHECK'
             AND constraint_name LIKE '%university%'
  LOOP EXECUTE 'ALTER TABLE rolling_metrics DROP CONSTRAINT ' || quote_ident(r.constraint_name); END LOOP;
END $$;
ALTER TABLE rolling_metrics ADD CONSTRAINT rolling_metrics_university_check
  CHECK (university IN ('UTA','WFI','Hofstra','NEIU','SCU','UTSA'));
