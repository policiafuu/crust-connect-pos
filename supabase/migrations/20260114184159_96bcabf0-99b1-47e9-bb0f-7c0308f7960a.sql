-- Reversão completa das políticas de segurança RLS - Ordem correta
-- Restaurando políticas permissivas originais

-- ETAPA 1: Remover TODAS as políticas restritivas que dependem das funções helper

-- system_users
DROP POLICY IF EXISTS "system_users_self_select" ON public.system_users;
DROP POLICY IF EXISTS "system_users_admin_all" ON public.system_users;

-- franquias
DROP POLICY IF EXISTS "franquias_read_scoped" ON public.franquias;
DROP POLICY IF EXISTS "franquias_admin_all" ON public.franquias;

-- global_config
DROP POLICY IF EXISTS "global_config_super_admin_only" ON public.global_config;

-- franquia_cobrancas
DROP POLICY IF EXISTS "franquia_cobrancas_scoped" ON public.franquia_cobrancas;

-- entregadores
DROP POLICY IF EXISTS "entregadores_scoped" ON public.entregadores;

-- logs_auditoria
DROP POLICY IF EXISTS "logs_auditoria_scoped" ON public.logs_auditoria;

-- senhas_pagamento
DROP POLICY IF EXISTS "senhas_pagamento_scoped" ON public.senhas_pagamento;

-- api_keys
DROP POLICY IF EXISTS "api_keys_owner_scoped" ON public.api_keys;

-- auth_refresh_tokens
DROP POLICY IF EXISTS "auth_refresh_tokens_self" ON public.auth_refresh_tokens;
DROP POLICY IF EXISTS "auth_refresh_tokens_admin_all" ON public.auth_refresh_tokens;

-- system_config
DROP POLICY IF EXISTS "system_config_scoped" ON public.system_config;

-- unidades
DROP POLICY IF EXISTS "unidades_scoped" ON public.unidades;

-- unidade_planos
DROP POLICY IF EXISTS "unidade_planos_scoped" ON public.unidade_planos;

-- unidade_bag_tipos
DROP POLICY IF EXISTS "unidade_bag_tipos_scoped" ON public.unidade_bag_tipos;

-- unidade_modulos
DROP POLICY IF EXISTS "unidade_modulos_scoped" ON public.unidade_modulos;

-- unidade_payment_config
DROP POLICY IF EXISTS "unidade_payment_config_scoped" ON public.unidade_payment_config;

-- user_unidades
DROP POLICY IF EXISTS "user_unidades_scoped" ON public.user_unidades;

-- whatsapp_historico
DROP POLICY IF EXISTS "whatsapp_historico_scoped" ON public.whatsapp_historico;

-- whatsapp_templates
DROP POLICY IF EXISTS "whatsapp_templates_scoped" ON public.whatsapp_templates;

-- franquia_bag_tipos
DROP POLICY IF EXISTS "franquia_bag_tipos_scoped" ON public.franquia_bag_tipos;

-- rate_limits
DROP POLICY IF EXISTS "rate_limits_admin_only" ON public.rate_limits;

-- historico_entregas
DROP POLICY IF EXISTS "Franquia users can view historico_entregas" ON public.historico_entregas;
DROP POLICY IF EXISTS "Franquia users can insert historico_entregas" ON public.historico_entregas;
DROP POLICY IF EXISTS "Franquia users can update historico_entregas" ON public.historico_entregas;
DROP POLICY IF EXISTS "Franquia users can delete historico_entregas" ON public.historico_entregas;

-- ETAPA 2: Agora podemos remover as funções helper
DROP FUNCTION IF EXISTS public.current_user_role();
DROP FUNCTION IF EXISTS public.current_user_franquia_id();
DROP FUNCTION IF EXISTS public.current_user_unidade_id();

-- ETAPA 3: Remover políticas antigas permissivas e recriar

-- entregadores
DROP POLICY IF EXISTS "Anyone can view entregadores" ON public.entregadores;
DROP POLICY IF EXISTS "Anyone can create entregadores" ON public.entregadores;
DROP POLICY IF EXISTS "Anyone can update entregadores" ON public.entregadores;
DROP POLICY IF EXISTS "Anyone can delete entregadores" ON public.entregadores;

CREATE POLICY "Anyone can view entregadores"
  ON public.entregadores FOR SELECT USING (true);
CREATE POLICY "Anyone can create entregadores"
  ON public.entregadores FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update entregadores"
  ON public.entregadores FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete entregadores"
  ON public.entregadores FOR DELETE USING (true);

-- historico_entregas
DROP POLICY IF EXISTS "Anyone can view historico_entregas" ON public.historico_entregas;
DROP POLICY IF EXISTS "Anyone can create historico_entregas" ON public.historico_entregas;
DROP POLICY IF EXISTS "Anyone can update historico_entregas" ON public.historico_entregas;
DROP POLICY IF EXISTS "Anyone can delete historico_entregas" ON public.historico_entregas;

CREATE POLICY "Anyone can view historico_entregas"
  ON public.historico_entregas FOR SELECT USING (true);
CREATE POLICY "Anyone can create historico_entregas"
  ON public.historico_entregas FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update historico_entregas"
  ON public.historico_entregas FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete historico_entregas"
  ON public.historico_entregas FOR DELETE USING (true);

-- system_users
DROP POLICY IF EXISTS "system_users_permissive_all" ON public.system_users;
DROP POLICY IF EXISTS "system_users_select_for_login" ON public.system_users;
DROP POLICY IF EXISTS "Anyone can manage system_users" ON public.system_users;
DROP POLICY IF EXISTS "Anyone can read system_users for login" ON public.system_users;

CREATE POLICY "Anyone can manage system_users"
  ON public.system_users FOR ALL USING (true);
CREATE POLICY "Anyone can read system_users for login"
  ON public.system_users FOR SELECT USING (true);

-- global_config
DROP POLICY IF EXISTS "Anyone can read global_config" ON public.global_config;
DROP POLICY IF EXISTS "Anyone can manage global_config" ON public.global_config;

CREATE POLICY "Anyone can read global_config"
  ON public.global_config FOR SELECT USING (true);
CREATE POLICY "Anyone can manage global_config"
  ON public.global_config FOR ALL USING (true);

-- franquias
DROP POLICY IF EXISTS "franquias_permissive_all" ON public.franquias;
CREATE POLICY "franquias_permissive_all"
  ON public.franquias FOR ALL USING (true) WITH CHECK (true);

-- franquia_cobrancas
DROP POLICY IF EXISTS "franquia_cobrancas_permissive_all" ON public.franquia_cobrancas;
CREATE POLICY "franquia_cobrancas_permissive_all"
  ON public.franquia_cobrancas FOR ALL USING (true) WITH CHECK (true);

-- logs_auditoria
DROP POLICY IF EXISTS "logs_auditoria_permissive_all" ON public.logs_auditoria;
CREATE POLICY "logs_auditoria_permissive_all"
  ON public.logs_auditoria FOR ALL USING (true) WITH CHECK (true);

-- api_keys
DROP POLICY IF EXISTS "api_keys_permissive_all" ON public.api_keys;
CREATE POLICY "api_keys_permissive_all"
  ON public.api_keys FOR ALL USING (true) WITH CHECK (true);

-- auth_refresh_tokens
DROP POLICY IF EXISTS "auth_refresh_tokens_permissive_all" ON public.auth_refresh_tokens;
CREATE POLICY "auth_refresh_tokens_permissive_all"
  ON public.auth_refresh_tokens FOR ALL USING (true) WITH CHECK (true);

-- franquia_bag_tipos
DROP POLICY IF EXISTS "franquia_bag_tipos_permissive_all" ON public.franquia_bag_tipos;
CREATE POLICY "franquia_bag_tipos_permissive_all"
  ON public.franquia_bag_tipos FOR ALL USING (true) WITH CHECK (true);

-- unidade_bag_tipos
DROP POLICY IF EXISTS "unidade_bag_tipos_permissive_all" ON public.unidade_bag_tipos;
CREATE POLICY "unidade_bag_tipos_permissive_all"
  ON public.unidade_bag_tipos FOR ALL USING (true) WITH CHECK (true);

-- unidades
DROP POLICY IF EXISTS "unidades_permissive_all" ON public.unidades;
CREATE POLICY "unidades_permissive_all"
  ON public.unidades FOR ALL USING (true) WITH CHECK (true);

-- unidade_planos
DROP POLICY IF EXISTS "unidade_planos_permissive_all" ON public.unidade_planos;
CREATE POLICY "unidade_planos_permissive_all"
  ON public.unidade_planos FOR ALL USING (true) WITH CHECK (true);

-- unidade_modulos
DROP POLICY IF EXISTS "unidade_modulos_permissive_all" ON public.unidade_modulos;
CREATE POLICY "unidade_modulos_permissive_all"
  ON public.unidade_modulos FOR ALL USING (true) WITH CHECK (true);

-- unidade_payment_config
DROP POLICY IF EXISTS "unidade_payment_config_permissive_all" ON public.unidade_payment_config;
CREATE POLICY "unidade_payment_config_permissive_all"
  ON public.unidade_payment_config FOR ALL USING (true) WITH CHECK (true);

-- user_unidades
DROP POLICY IF EXISTS "Anyone can manage user_unidades" ON public.user_unidades;
CREATE POLICY "Anyone can manage user_unidades"
  ON public.user_unidades FOR ALL USING (true) WITH CHECK (true);

-- whatsapp_historico
DROP POLICY IF EXISTS "whatsapp_historico_permissive_all" ON public.whatsapp_historico;
CREATE POLICY "whatsapp_historico_permissive_all"
  ON public.whatsapp_historico FOR ALL USING (true) WITH CHECK (true);

-- whatsapp_templates
DROP POLICY IF EXISTS "whatsapp_templates_permissive_all" ON public.whatsapp_templates;
CREATE POLICY "whatsapp_templates_permissive_all"
  ON public.whatsapp_templates FOR ALL USING (true) WITH CHECK (true);

-- rate_limits
DROP POLICY IF EXISTS "rate_limits_permissive_all" ON public.rate_limits;
CREATE POLICY "rate_limits_permissive_all"
  ON public.rate_limits FOR ALL USING (true) WITH CHECK (true);

-- system_config
DROP POLICY IF EXISTS "Anyone can read system_config" ON public.system_config;
DROP POLICY IF EXISTS "Anyone can manage system_config" ON public.system_config;

CREATE POLICY "Anyone can read system_config"
  ON public.system_config FOR SELECT USING (true);
CREATE POLICY "Anyone can manage system_config"
  ON public.system_config FOR ALL USING (true);