-- 1) Tabela para refresh tokens de autenticação
CREATE TABLE IF NOT EXISTS public.auth_refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.system_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  ip text,
  user_agent text,
  CONSTRAINT auth_refresh_tokens_token_hash_unique UNIQUE (token_hash)
);

ALTER TABLE public.auth_refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Política permissiva inicial (vamos restringir via lógica nas Edge Functions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'auth_refresh_tokens'
      AND policyname = 'auth_refresh_tokens_permissive_all'
  ) THEN
    CREATE POLICY auth_refresh_tokens_permissive_all
      ON public.auth_refresh_tokens
      AS PERMISSIVE
      FOR ALL
      TO public
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 2) Tabela simples para rate limit (por IP + rota + janela de tempo)
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  route text NOT NULL,
  ip text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  last_request_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rate_limits_key_window_unique UNIQUE (key, route, window_start)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'rate_limits'
      AND policyname = 'rate_limits_permissive_all'
  ) THEN
    CREATE POLICY rate_limits_permissive_all
      ON public.rate_limits
      AS PERMISSIVE
      FOR ALL
      TO public
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 3) Expandir logs_auditoria com colunas de segurança adicionais
ALTER TABLE public.logs_auditoria
  ADD COLUMN IF NOT EXISTS user_id uuid NULL REFERENCES public.system_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unidade_id uuid NULL REFERENCES public.unidades(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ip text NULL,
  ADD COLUMN IF NOT EXISTS user_agent text NULL;
