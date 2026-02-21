import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Receber parâmetros do body
    const { unidade, unidadeId } = await req.json();

    console.log(`Iniciando reset diário para unidade: ${unidade || unidadeId}...`);

    // Construir query com filtro por unidade
    let resetQuery = supabase
      .from('entregadores')
      .update({
        status: 'disponivel',
        ativo: false, // Força check-in no próximo dia
        hora_saida: null,
      });

    // Filtrar por unidade_id se fornecido, senão por unidade (nome)
    if (unidadeId) {
      resetQuery = resetQuery.eq('unidade_id', unidadeId);
    } else if (unidade) {
      resetQuery = resetQuery.eq('unidade', unidade);
    } else {
      // Se não forneceu nem unidade nem unidadeId, retorna erro
      return new Response(
        JSON.stringify({ success: false, error: 'Parâmetro unidade ou unidadeId é obrigatório' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { error: resetError } = await resetQuery;

    if (resetError) {
      console.error('Erro ao resetar motoboys:', resetError);
      throw resetError;
    }

    // Limpar histórico de entregas da unidade específica
    let deleteHistoricoQuery = supabase
      .from('historico_entregas')
      .delete();

    // Filtrar por unidade_id se fornecido, senão por unidade (nome)
    if (unidadeId) {
      deleteHistoricoQuery = deleteHistoricoQuery.eq('unidade_id', unidadeId);
    } else if (unidade) {
      deleteHistoricoQuery = deleteHistoricoQuery.eq('unidade', unidade);
    }

    const { error: deleteHistoricoError } = await deleteHistoricoQuery;

    if (deleteHistoricoError) {
      console.error('Erro ao limpar histórico:', deleteHistoricoError);
      // Não lança erro aqui, apenas loga
    } else {
      console.log('Histórico de entregas limpo com sucesso!');
    }

    console.log('Reset diário concluído com sucesso!');

    return new Response(
      JSON.stringify({ success: true, message: 'Reset diário executado com sucesso' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('Erro no reset diário:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});