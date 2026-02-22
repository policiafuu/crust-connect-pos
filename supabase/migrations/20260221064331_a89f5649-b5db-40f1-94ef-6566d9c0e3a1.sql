
-- Add missing columns to planos
ALTER TABLE public.planos ADD COLUMN IF NOT EXISTS dias_trial INTEGER DEFAULT 7;
ALTER TABLE public.planos ADD COLUMN IF NOT EXISTS forma_cobranca TEXT DEFAULT 'mensal';
ALTER TABLE public.planos ADD COLUMN IF NOT EXISTS permite_trial BOOLEAN DEFAULT true;

-- Add missing columns to franquias
ALTER TABLE public.franquias ADD COLUMN IF NOT EXISTS data_registro TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.franquias ADD COLUMN IF NOT EXISTS dias_trial INTEGER DEFAULT 7;

-- Add missing column to entregadores
ALTER TABLE public.entregadores ADD COLUMN IF NOT EXISTS tts_voice_path TEXT NULL;
ALTER TABLE public.entregadores ADD COLUMN IF NOT EXISTS whatsapp_ativo BOOLEAN DEFAULT true;

-- Create modulos table
CREATE TABLE IF NOT EXISTS public.modulos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT NULL,
  preco_mensal NUMERIC DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create pacotes_comerciais table
CREATE TABLE IF NOT EXISTS public.pacotes_comerciais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  codigo TEXT NOT NULL,
  descricao TEXT NULL,
  preco_total NUMERIC NOT NULL DEFAULT 0,
  desconto_percent NUMERIC DEFAULT 0,
  plano_id UUID REFERENCES public.planos(id) ON DELETE SET NULL,
  modulos_inclusos TEXT[] DEFAULT '{}',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create franquia_cobrancas table
CREATE TABLE IF NOT EXISTS public.franquia_cobrancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franquia_id UUID NOT NULL REFERENCES public.franquias(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDENTE',
  valor NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create api_keys table
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL,
  owner_id UUID NOT NULL,
  descricao TEXT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  revoked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacotes_comerciais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.franquia_cobrancas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entregadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_entregas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidade_planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.franquia_bag_tipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidade_bag_tipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.franquias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_unidades ENABLE ROW LEVEL SECURITY;

-- Permissive RLS policies for all tables (system uses custom auth, not Supabase auth)
CREATE POLICY "Allow all on modulos" ON public.modulos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on pacotes_comerciais" ON public.pacotes_comerciais FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on franquia_cobrancas" ON public.franquia_cobrancas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on api_keys" ON public.api_keys FOR ALL USING (true) WITH CHECK (true);
