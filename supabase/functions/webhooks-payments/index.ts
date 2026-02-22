import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AsaasWebhookPayload {
  event: string;
  payment?: {
    id: string;
    value: number;
    status: string;
    dueDate?: string;
    externalReference?: string;
  };
}

async function getSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Backend configuration missing: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
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

function mapStatusToInternal(gateway: string, event: string, status?: string): string {
  const g = gateway.toLowerCase();
  const s = (status || event || "").toUpperCase();

  if (g === "asaas" || g === "asas") {
    if (s === "PAYMENT_CONFIRMED" || s === "RECEIVED" || s === "CONFIRMED" || s === "RECEIVED_IN_CASH") {
      return "PAGO";
    }
    if (s === "PAYMENT_CREATED" || s === "PENDING") {
      return "PENDENTE";
    }
    if (s === "PAYMENT_CANCELED" || s === "CANCELED") {
      return "CANCELADO";
    }
    if (s === "PAYMENT_OVERDUE" || s === "OVERDUE") {
      return "PENDENTE";
    }
  }

  // Outros gateways (Mercado Pago, Seabra) podem ser mapeados aqui futuramente

  return "PENDENTE";
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const gatewayParam = url.searchParams.get("gateway");
  const gateway = (gatewayParam || "asaas").toLowerCase();

  try {
    const supabase = await getSupabaseClient();

    if (gateway === "asaas" || gateway === "asas") {
      const payload = (await req.json()) as AsaasWebhookPayload;
      console.log("Webhook Asaas recebido no webhook central:", JSON.stringify(payload));

      const payment = payload.payment;
      if (!payment || !payment.id) {
        return new Response(JSON.stringify({ error: "Payload de pagamento inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const externalId = payment.id;
      const statusExterno = payment.status ?? "";
      const statusInterno = mapStatusToInternal("asaas", payload.event, statusExterno);

      // Atualiza/insere o registro da cobrança com base no external_id
      const { data: cobrancaExistente } = await supabase
        .from("franquia_cobrancas")
        .select("id, franquia_id, payload")
        .eq("gateway", "asas")
        .eq("external_id", externalId)
        .maybeSingle();

      const upsertPayload = {
        gateway: "asas",
        external_id: externalId,
        status: statusInterno,
        valor: payment.value,
        vencimento: payment.dueDate ? new Date(payment.dueDate).toISOString() : null,
        payload: {
          origem: "webhook_central",
          raw: payload,
        },
      } as any;

      if (cobrancaExistente) {
        const { error: updateError } = await supabase
          .from("franquia_cobrancas")
          .update(upsertPayload)
          .eq("id", cobrancaExistente.id);

        if (updateError) {
          console.error("Erro ao atualizar cobrança no webhook central:", updateError);
        }
      } else {
        const { error: insertError } = await supabase.from("franquia_cobrancas").insert({
          ...upsertPayload,
          franquia_id: payment.externalReference ?? null,
        });

        if (insertError) {
          console.error("Erro ao inserir cobrança no webhook central:", insertError);
        }
      }

      // Opcional: atualizar franquia.status_pagamento e data_vencimento quando for confirmação de pagamento
      if (statusInterno === "PAGO" && payment.externalReference) {
        // Atualiza status_pagamento para ativo
        const { data: franquia, error: franquiaError } = await supabase
          .from("franquias")
          .select("id, config_pagamento, data_vencimento")
          .eq("id", payment.externalReference)
          .maybeSingle();

        if (franquiaError) {
          console.error("Erro ao buscar franquia a partir do webhook central:", franquiaError);
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
              console.error("Erro ao buscar plano para renovar vencimento:", planoError);
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
            .eq("id", payment.externalReference);

          if (updateFranquiaError) {
            console.error("Erro ao atualizar franquia a partir do webhook central:", updateFranquiaError);
          }
        }
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gateways futuros (Mercado Pago, Seabra)
    console.warn("Webhook recebido para gateway ainda não implementado:", gateway);
    return new Response(JSON.stringify({ error: "Gateway de webhook não implementado" }), {
      status: 501,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro na função webhooks-payments:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
