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
    const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting deletion of expired franchises...');

    // Calcular data limite: 14 dias atrás
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const dateLimit = fourteenDaysAgo.toISOString().split('T')[0];

    console.log('Date limit for deletion:', dateLimit);

    // Buscar franquias inadimplentes há mais de 14 dias
    const { data: expiredFranchises, error: fetchError } = await supabase
      .from('franquias')
      .select('id, nome_franquia, slug, email, data_vencimento')
      .eq('status_pagamento', 'inadimplente')
      .lt('data_vencimento', dateLimit);

    if (fetchError) {
      console.error('Error fetching expired franchises:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao buscar franquias expiradas' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!expiredFranchises || expiredFranchises.length === 0) {
      console.log('No expired franchises found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhuma franquia expirada encontrada',
          deletedCount: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Found ${expiredFranchises.length} expired franchises to delete`);

    const deletedFranchises = [];
    const errors = [];

    for (const franquia of expiredFranchises) {
      try {
        console.log(`Deleting franchise: ${franquia.nome_franquia} (${franquia.id})`);

        // 1. Buscar todas as unidades da franquia
        const { data: unidades } = await supabase
          .from('unidades')
          .select('id')
          .eq('franquia_id', franquia.id);

        if (unidades && unidades.length > 0) {
          const unidadeIds = unidades.map(u => u.id);
          
          // 2. Deletar dados relacionados às unidades
          await supabase.from('whatsapp_historico').delete().in('unidade_id', unidadeIds);
          await supabase.from('whatsapp_templates').delete().in('unidade_id', unidadeIds);
          await supabase.from('senhas_pagamento').delete().in('unidade_id', unidadeIds);
          await supabase.from('unidade_modulos').delete().in('unidade_id', unidadeIds);
          await supabase.from('unidade_planos').delete().in('unidade_id', unidadeIds);
          await supabase.from('unidade_payment_config').delete().in('unidade_id', unidadeIds);
          await supabase.from('unidade_bag_tipos').delete().in('unidade_id', unidadeIds);
          await supabase.from('historico_entregas').delete().in('unidade_id', unidadeIds);
          
          // 3. Deletar entregadores
          const { data: entregadores } = await supabase
            .from('entregadores')
            .select('id')
            .in('unidade_id', unidadeIds);

          if (entregadores && entregadores.length > 0) {
            const entregadorIds = entregadores.map(e => e.id);
            await supabase.from('historico_entregas').delete().in('entregador_id', entregadorIds);
          }

          await supabase.from('entregadores').delete().in('unidade_id', unidadeIds);
        }

        // 4. Buscar usuários da franquia
        const { data: users } = await supabase
          .from('system_users')
          .select('id')
          .eq('franquia_id', franquia.id);

        if (users && users.length > 0) {
          const userIds = users.map(u => u.id);
          await supabase.from('user_unidades').delete().in('user_id', userIds);
          await supabase.from('system_users').delete().in('id', userIds);
        }

        // 5. Deletar dados da franquia
        await supabase.from('franquia_cobrancas').delete().eq('franquia_id', franquia.id);
        await supabase.from('logs_auditoria').delete().eq('franquia_id', franquia.id);
        
        const { data: bagTipos } = await supabase
          .from('franquia_bag_tipos')
          .select('id')
          .eq('franquia_id', franquia.id);

        if (bagTipos && bagTipos.length > 0) {
          const bagTipoIds = bagTipos.map(b => b.id);
          await supabase.from('unidade_bag_tipos').delete().in('bag_tipo_id', bagTipoIds);
          await supabase.from('franquia_bag_tipos').delete().in('id', bagTipoIds);
        }

        // 6. Deletar unidades
        if (unidades && unidades.length > 0) {
          await supabase.from('unidades').delete().eq('franquia_id', franquia.id);
        }

        // 7. Finalmente, deletar a franquia
        const { error: deleteError } = await supabase
          .from('franquias')
          .delete()
          .eq('id', franquia.id);

        if (deleteError) {
          console.error(`Error deleting franchise ${franquia.id}:`, deleteError);
          errors.push({ franquiaId: franquia.id, error: deleteError.message });
        } else {
          console.log(`Successfully deleted franchise: ${franquia.nome_franquia}`);
          deletedFranchises.push({
            id: franquia.id,
            nome: franquia.nome_franquia,
            email: franquia.email,
          });
        }
      } catch (error) {
        console.error(`Error processing franchise ${franquia.id}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ franquiaId: franquia.id, error: errorMessage });
      }
    }

    console.log(`Deletion completed. Success: ${deletedFranchises.length}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${deletedFranchises.length} franquia(s) deletada(s) com sucesso`,
        deletedCount: deletedFranchises.length,
        deletedFranchises,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in delete-expired-franchises:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
