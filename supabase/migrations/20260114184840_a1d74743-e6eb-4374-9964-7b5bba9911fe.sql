-- Adicionar configurações de customização da TV para SUPERADMIN
-- Configurações visuais e de texto para chamadas de entrega e pagamento na TV

INSERT INTO public.global_config (config_key, config_value) 
VALUES 
  ('tv_entrega_titulo', 'ENTREGA CHAMADA'),
  ('tv_pagamento_titulo', 'PAGAMENTO CHAMADO')
ON CONFLICT (config_key) DO NOTHING;