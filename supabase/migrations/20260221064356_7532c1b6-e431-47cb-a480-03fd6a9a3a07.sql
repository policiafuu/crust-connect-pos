
-- Create whatsapp_templates table
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id UUID NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create unidade_modulos table
CREATE TABLE IF NOT EXISTS public.unidade_modulos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id UUID NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  modulo_codigo TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  data_ativacao TIMESTAMPTZ DEFAULT now(),
  data_expiracao TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(unidade_id, modulo_codigo)
);

-- Create senhas_pagamento table
CREATE TABLE IF NOT EXISTS public.senhas_pagamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id UUID NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  franquia_id UUID NOT NULL REFERENCES public.franquias(id) ON DELETE CASCADE,
  numero_senha TEXT NOT NULL,
  entregador_id UUID REFERENCES public.entregadores(id) ON DELETE SET NULL,
  entregador_nome TEXT NULL,
  status TEXT NOT NULL DEFAULT 'aguardando',
  chamado_em TIMESTAMPTZ NULL,
  atendido_em TIMESTAMPTZ NULL,
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidade_modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.senhas_pagamento ENABLE ROW LEVEL SECURITY;

-- Permissive policies
CREATE POLICY "Allow all on whatsapp_templates" ON public.whatsapp_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on unidade_modulos" ON public.unidade_modulos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on senhas_pagamento" ON public.senhas_pagamento FOR ALL USING (true) WITH CHECK (true);
