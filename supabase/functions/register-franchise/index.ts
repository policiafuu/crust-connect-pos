import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      nomeEmpresa,
      cpfCnpj,
      email,
      telefone,
      nomeFranquia,
      nomeLoja,
      pacoteId,
      username,
      password,
    } = await req.json();

    console.log('Starting franchise registration:', { nomeFranquia, nomeLoja, username });

    // Validações básicas
    if (!nomeEmpresa || !cpfCnpj || !email || !telefone || !nomeFranquia || !nomeLoja || !pacoteId || !username || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Todos os campos são obrigatórios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Verificar se username já existe
    const { data: existingUser } = await supabase
      .from('system_users')
      .select('id')
      .eq('username', username)
      .single();

    if (existingUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário já existe' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Verificar se CPF/CNPJ já existe
    const { data: existingFranquia } = await supabase
      .from('franquias')
      .select('id')
      .eq('cpf_cnpj', cpfCnpj)
      .single();

    if (existingFranquia) {
      return new Response(
        JSON.stringify({ success: false, error: 'CPF/CNPJ já cadastrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Verificar se o pacote existe
    const { data: pacote, error: pacoteError } = await supabase
      .from('pacotes_comerciais')
      .select('id, plano_id, preco_total, ativo, modulos_inclusos')
      .eq('id', pacoteId)
      .eq('ativo', true)
      .single();

    if (pacoteError || !pacote) {
      return new Response(
        JSON.stringify({ success: false, error: 'Plano inválido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Gerar slug único para a franquia
    const slug = nomeFranquia
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Verificar se o slug já existe
    let finalSlug = slug;
    let counter = 1;
    while (true) {
      const { data: existingSlug } = await supabase
        .from('franquias')
        .select('id')
        .eq('slug', finalSlug)
        .single();

      if (!existingSlug) break;
      finalSlug = `${slug}-${counter}`;
      counter++;
    }

    // Calcular data de vencimento (7 dias de trial)
    const dataVencimento = new Date();
    dataVencimento.setDate(dataVencimento.getDate() + 7);

    // 1. Criar franquia
    const { data: franquia, error: franquiaError } = await supabase
      .from('franquias')
      .insert({
        nome_franquia: nomeFranquia,
        slug: finalSlug,
        cpf_cnpj: cpfCnpj,
        email: email,
        telefone: telefone,
        status_pagamento: 'trial',
        data_vencimento: dataVencimento.toISOString().split('T')[0],
        data_registro: new Date().toISOString(),
        dias_trial: 7,
        plano_limite_lojas: 1,
        config_pagamento: {
          plano_id: pacote.plano_id,
          valor_plano: pacote.preco_total,
          modulos_ativos: (pacote.modulos_inclusos as string[]) || [],
        },
      })
      .select()
      .single();

    if (franquiaError) {
      console.error('Error creating franquia:', franquiaError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao criar franquia' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('Franquia created:', franquia.id);

    // 2. Criar unidade
    const { data: unidade, error: unidadeError } = await supabase
      .from('unidades')
      .insert({
        nome_loja: nomeLoja,
        franquia_id: franquia.id,
      })
      .select()
      .single();

    if (unidadeError) {
      console.error('Error creating unidade:', unidadeError);
      // Rollback: deletar franquia
      await supabase.from('franquias').delete().eq('id', franquia.id);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao criar unidade' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('Unidade created:', unidade.id);

    // 3. Definir senha (texto simples, compatível com login atual)
    const passwordHash = password;
    const { data: user, error: userError } = await supabase
      .from('system_users')
      .insert({
        username: username,
        password_hash: passwordHash,
        role: 'admin',
        franquia_id: franquia.id,
        unidade_id: unidade.id,
        unidade: nomeLoja,
      })
      .select()
      .single();

    if (userError) {
      console.error('Error creating user:', userError);
      // Rollback: deletar unidade e franquia
      await supabase.from('unidades').delete().eq('id', unidade.id);
      await supabase.from('franquias').delete().eq('id', franquia.id);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao criar usuário' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('User created:', user.id);

    // 4. Associar usuário à unidade na tabela user_unidades
    const { error: userUnidadeError } = await supabase
      .from('user_unidades')
      .insert({
        user_id: user.id,
        unidade_id: unidade.id,
      });

    if (userUnidadeError) {
      console.error('Error linking user to unidade:', userUnidadeError);
      // Continuar mesmo com erro, não é crítico
    }

    // 5. Associar plano à unidade (se o pacote estiver vinculado a um plano)
    if (pacote.plano_id) {
      const { error: unidadePlanoError } = await supabase
        .from('unidade_planos')
        .insert({
          unidade_id: unidade.id,
          plano_id: pacote.plano_id,
          valor: pacote.preco_total,
          desconto_percent: 0,
          ativo: true,
        });

      if (unidadePlanoError) {
        console.error('Error linking plano to unidade:', unidadePlanoError);
        // Continuar mesmo com erro, não é crítico
      }
    }

    console.log('Registration completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Cadastro realizado com sucesso!',
        franquiaId: franquia.id,
        unidadeId: unidade.id,
        trialEndsAt: dataVencimento.toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in register-franchise:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
