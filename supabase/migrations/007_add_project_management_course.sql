-- Add 'Project Management' to course CHECK constraints on all tables

DO $$
DECLARE
  tables text[] := ARRAY['contacts','ad_spend','cac_metrics','rolling_metrics','enrollments','campaign_mapping'];
  t text;
  constraint_name text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Find and drop existing course check constraint
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.check_constraints cc
      ON tc.constraint_name = cc.constraint_name
    WHERE tc.table_name = t
      AND tc.constraint_type = 'CHECK'
      AND cc.check_clause LIKE '%course%';

    IF constraint_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', t, constraint_name);
    END IF;

    -- Add updated constraint
    EXECUTE format(
      $sql$ALTER TABLE %I ADD CONSTRAINT %I_course_check
        CHECK (course IN ('Digital Marketing','UI/UX Design','Generative AI Data Analyst','Project Management','General'))$sql$,
      t, t
    );
  END LOOP;
END;
$$;
