-- Allow full management of system_users (needed for Super Admin UI deletions)
ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'system_users'
      AND policyname = 'system_users_permissive_all'
  ) THEN
    CREATE POLICY "system_users_permissive_all"
    ON public.system_users
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;