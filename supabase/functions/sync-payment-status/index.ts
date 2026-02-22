import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncPaymentPayload {
  franquiaId: string;
  externalId: string;
}

async function getSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Backend configuration missing");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = await getSupabaseClient();
    const payload = (await req.json()) as SyncPaymentPayload;

    console.log("Sincronizando pagamento:", payload);

    // Busca configuração global do gateway de pagamento
    const { data: globalConfig } = await supabase
      .from("global_config")
      .select("config_value")
      .eq("config_key", "billing_gateway")
      .maybeSingle();

    if (!globalConfig?.config_value) {
      throw new Error("Configuração de pagamento não encontrada. Configure o gateway em Config > Financeiro.");
    }

    const gatewayConfig = JSON.parse(globalConfig.config_value);
    const provider = gatewayConfig.provider as string | undefined;
    const asaasApiKey = gatewayConfig.api_key as string | undefined;

    if (!provider || provider !== 'asas') {
      throw new Error("Gateway de pagamento deve ser 'asas' para sincronização");
    }

    if (!asaasApiKey) {
      throw new Error("API Key do Asaas não configurada");
    }

    // Busca o status do pagamento no Asaas
    const asaasResponse = await fetch(
      `https://api.asaas.com/v3/payments/${payload.externalId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "access_token": asaasApiKey,
        },
      }
    );

    if (!asaasResponse.ok) {
      throw new Error(`Erro ao buscar pagamento no Asaas: ${asaasResponse.status}`);
    }

    const asaasPayment = await asaasResponse.json();
    console.log("Status do pagamento no Asaas:", asaasPayment.status);

    // Mapeia o status
    let statusInterno = "PENDENTE";
    if (["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(asaasPayment.status)) {
      statusInterno = "PAGO";
    } else if (asaasPayment.status === "PENDING") {
      statusInterno = "PENDENTE";
    } else if (asaasPayment.status === "OVERDUE") {
      statusInterno = "PENDENTE";
    } else if (asaasPayment.status === "CANCELED") {
      statusInterno = "CANCELADO";
    }

    // Atualiza a cobrança
    const { error: updateCobrancaError } = await supabase
      .from("franquia_cobrancas")
      .update({
        status: statusInterno,
        payload: {
          origem: "sincronizacao_manual",
          raw: asaasPayment,
        },
      })
      .eq("external_id", payload.externalId);

    if (updateCobrancaError) {
      console.error("Erro ao atualizar cobrança:", updateCobrancaError);
    }

    // Se o pagamento foi confirmado, renova a franquia
    if (statusInterno === "PAGO") {
      const { data: franquia, error: franquiaError } = await supabase
        .from("franquias")
        .select("id, config_pagamento, data_vencimento")
        .eq("id", payload.franquiaId)
        .maybeSingle();

      if (franquiaError) {
        console.error("Erro ao buscar franquia:", franquiaError);
      } else if (franquia) {
        const cfgFranquia = (franquia.config_pagamento as any) || {};
        const planoId = cfgFranquia.plano_id as string | undefined;

        let novaDataVencimento: string | null = null;

        if (planoId) {
          const { data: plano, error: planoError } = await supabase
            .from("planos")
            .select("duracao_meses")
            .eq("id", planoId)
            .maybeSingle();

          if (planoError) {
            console.error("Erro ao buscar plano:", planoError);
          } else if (plano?.duracao_meses != null) {
            const baseDate = franquia.data_vencimento
              ? new Date(franquia.data_vencimento as string)
              : new Date();
            const renovada = addMonths(baseDate, Number(plano.duracao_meses || 1));
            novaDataVencimento = renovada.toISOString().slice(0, 10);
          }
        }

        const updatePayload: Record<string, any> = { status_pagamento: "ativo" };
        if (novaDataVencimento) {
          updatePayload.data_vencimento = novaDataVencimento;
        }

        const { error: updateFranquiaError } = await supabase
          .from("franquias")
          .update(updatePayload)
          .eq("id", payload.franquiaId);

        if (updateFranquiaError) {
          console.error("Erro ao atualizar franquia:", updateFranquiaError);
          throw updateFranquiaError;
        }

        console.log("Franquia renovada com sucesso!");
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: statusInterno,
        asaasStatus: asaasPayment.status,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erro na sincronização:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
