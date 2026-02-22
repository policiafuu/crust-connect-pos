-- Enable RLS on system_users (if not already) and allow read access for login
ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_users_select_for_login"
ON public.system_users
FOR SELECT
USING (true);