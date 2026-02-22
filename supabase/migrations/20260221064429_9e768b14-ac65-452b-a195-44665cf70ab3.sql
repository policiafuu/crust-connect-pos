
-- Drop and recreate policies for tables missing them
DO $$ BEGIN
  -- entregadores
  BEGIN DROP POLICY "Allow all on entregadores" ON public.entregadores; EXCEPTION WHEN undefined_object THEN NULL; END;
  -- historico_entregas
  BEGIN DROP POLICY "Allow all on historico_entregas" ON public.historico_entregas; EXCEPTION WHEN undefined_object THEN NULL; END;
  -- global_config
  BEGIN DROP POLICY "Allow all on global_config" ON public.global_config; EXCEPTION WHEN undefined_object THEN NULL; END;
  -- system_config
  BEGIN DROP POLICY "Allow all on system_config" ON public.system_config; EXCEPTION WHEN undefined_object THEN NULL; END;
  -- planos
  BEGIN DROP POLICY "Allow all on planos" ON public.planos; EXCEPTION WHEN undefined_object THEN NULL; END;
  -- unidade_planos
  BEGIN DROP POLICY "Allow all on unidade_planos" ON public.unidade_planos; EXCEPTION WHEN undefined_object THEN NULL; END;
  -- franquia_bag_tipos
  BEGIN DROP POLICY "Allow all on franquia_bag_tipos" ON public.franquia_bag_tipos; EXCEPTION WHEN undefined_object THEN NULL; END;
  -- unidade_bag_tipos
  BEGIN DROP POLICY "Allow all on unidade_bag_tipos" ON public.unidade_bag_tipos; EXCEPTION WHEN undefined_object THEN NULL; END;
  -- unidades
  BEGIN DROP POLICY "Allow all on unidades" ON public.unidades; EXCEPTION WHEN undefined_object THEN NULL; END;
  -- logs_auditoria
  BEGIN DROP POLICY "Allow all on logs_auditoria" ON public.logs_auditoria; EXCEPTION WHEN undefined_object THEN NULL; END;
  -- franquias
  BEGIN DROP POLICY "Allow all on franquias" ON public.franquias; EXCEPTION WHEN undefined_object THEN NULL; END;
  -- system_users
  BEGIN DROP POLICY "Allow all on system_users" ON public.system_users; EXCEPTION WHEN undefined_object THEN NULL; END;
  -- user_unidades
  BEGIN DROP POLICY "Allow all on user_unidades" ON public.user_unidades; EXCEPTION WHEN undefined_object THEN NULL; END;
END $$;

CREATE POLICY "Allow all on entregadores" ON public.entregadores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on historico_entregas" ON public.historico_entregas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on global_config" ON public.global_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on system_config" ON public.system_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on planos" ON public.planos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on unidade_planos" ON public.unidade_planos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on franquia_bag_tipos" ON public.franquia_bag_tipos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on unidade_bag_tipos" ON public.unidade_bag_tipos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on unidades" ON public.unidades FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on logs_auditoria" ON public.logs_auditoria FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on franquias" ON public.franquias FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on system_users" ON public.system_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on user_unidades" ON public.user_unidades FOR ALL USING (true) WITH CHECK (true);
