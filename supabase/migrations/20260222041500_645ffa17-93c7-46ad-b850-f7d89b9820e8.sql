-- Fix FK on auth_refresh_tokens to reference system_users instead of auth.users
ALTER TABLE public.auth_refresh_tokens DROP CONSTRAINT IF EXISTS auth_refresh_tokens_user_id_fkey;
ALTER TABLE public.auth_refresh_tokens ADD CONSTRAINT auth_refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.system_users(id) ON DELETE CASCADE;