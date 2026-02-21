import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentsCreateRequest {
  store_id: string;
  valor: number;
  descricao?: string;
  referencia?: string;
  retorno_url?: string;
}

async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
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

async function authenticateApiKey(req: Request) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Missing or invalid Authorization header", status: 401 } as const;
  }

  const apiKeyRaw = authHeader.substring("Bearer ".length).trim();
  if (!apiKeyRaw) {
    return { error: "API key is empty", status: 401 } as const;
  }

  const apiKeyHash = await hashApiKey(apiKeyRaw);
  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from("api_keys")
    .select("id, owner_type, owner_id, ativo")
    .eq("api_key_hash", apiKeyHash)
    .maybeSingle();

  if (error) {
    console.error("Error looking up API key:", error);
    return { error: "Internal error validating API key", status: 500 } as const;
  }

  if (!data || !data.ativo) {
    return { error: "API key not found or inactive", status: 401 } as const;
  }

  return { apiKeyId: data.id, ownerType: data.owner_type as "franquia" | "unidade", ownerId: data.owner_id } as const;
}

function validatePayload(body: unknown): { value?: PaymentsCreateRequest; error?: string } {
  if (!body || typeof body !== "object") {
    return { error: "Payload inválido" };
  }

  const b = body as Record<string, unknown>;

  const store_id = typeof b.store_id === "string" ? b.store_id.trim() : "";
  const valor = typeof b.valor === "number" ? b.valor : Number(b.valor ?? 0);
  const descricao = typeof b.descricao === "string" ? b.descricao.trim() : undefined;
  const referencia = typeof b.referencia === "string" ? b.referencia.trim() : undefined;
  const retorno_url = typeof b.retorno_url === "string" ? b.retorno_url.trim() : undefined;

  if (!store_id) {
    return { error: "store_id é obrigatório" };
  }

  if (!Number.isFinite(valor) || valor <= 0) {
    return { error: "valor deve ser um número maior que zero" };
  }

  if (descricao && descricao.length > 255) {
    return { error: "descricao muito longa" };
  }

  if (referencia && referencia.length > 255) {
    return { error: "referencia muito longa" };
  }

  if (retorno_url && retorno_url.length > 1024) {
    return { error: "retorno_url muito longa" };
  }

  return {
    value: {
      store_id,
      valor,
      descricao,
      referencia,
      retorno_url,
    },
  };
}

async function handleCreatePayment(req: Request): Promise<Response> {
  const auth = await authenticateApiKey(req);
  if ("error" in auth) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { value, error: validationError } = validatePayload(body);

    if (validationError || !value) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = await getSupabaseClient();

    // Carrega unidade e franquia
    const { data: unidade, error: unidadeError } = await supabase
      .from("unidades")
      .select("id, franquia_id, nome_loja")
      .eq("id", value.store_id)
      .maybeSingle();

    if (unidadeError) {
      console.error("Erro ao buscar unidade na criação de pagamento:", unidadeError);
      return new Response(JSON.stringify({ error: "Erro ao buscar loja" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!unidade) {
      return new Response(JSON.stringify({ error: "Loja não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: franquia, error: franquiaError } = await supabase
      .from("franquias")
      .select("id, nome_franquia")
      .eq("id", unidade.franquia_id)
      .maybeSingle();

    if (franquiaError) {
      console.error("Erro ao buscar franquia na criação de pagamento:", franquiaError);
      return new Response(JSON.stringify({ error: "Erro ao buscar franquia" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!franquia) {
      return new Response(JSON.stringify({ error: "Franquia não encontrada para a loja" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca configuração de pagamento ativa da unidade
    const { data: config, error: configError } = await supabase
      .from("unidade_payment_config")
      .select("gateway, config, ativo")
      .eq("unidade_id", unidade.id)
      .eq("ativo", true)
      .maybeSingle();

    if (configError) {
      console.error("Erro ao buscar configuração de pagamento da unidade:", configError);
      return new Response(JSON.stringify({ error: "Erro ao buscar configuração de pagamento da loja" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!config) {
      return new Response(JSON.stringify({ error: "Nenhum gateway de pagamento ativo configurado para a loja" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const gateway = (config.gateway as string)?.toLowerCase();
    const cfg = (config.config as any) || {};

    let checkoutUrl: string | null = null;
    let externalId: string | null = null;

    if (gateway === "asaas" || gateway === "asas") {
      const apiKey = cfg.api_key as string | undefined;
      const customerId = cfg.customer_id as string | undefined;

      if (!apiKey || !customerId) {
        return new Response(
          JSON.stringify({ error: "Configuração do Asaas incompleta (api_key ou customer_id ausente)" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const asaasBaseUrl = "https://api.asaas.com/v3";

      const payload = {
        customer: customerId,
        billingType: "PIX",
        value: value.valor,
        dueDate: new Date().toISOString().slice(0, 10),
        description: value.descricao || `Pagamento loja ${unidade.nome_loja}`,
        externalReference: value.referencia || unidade.id,
      };

      const asaasResponse = await fetch(`${asaasBaseUrl}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!asaasResponse.ok) {
        const errorBody = await asaasResponse.text();
        console.error("Erro ao criar cobrança no Asaas via API pública:", errorBody);
        return new Response(JSON.stringify({ error: "Erro ao criar cobrança no Asaas" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const asaasData = await asaasResponse.json();
      externalId = asaasData.id as string;
      checkoutUrl =
        (asaasData.invoiceUrl as string | undefined) ||
        (asaasData.bankSlipUrl as string | undefined) ||
        null;

      if (externalId) {
        const { error: insertError } = await supabase.from("franquia_cobrancas").insert({
          franquia_id: franquia.id,
          gateway: "asas",
          external_id: externalId,
          status: asaasData.status ?? "PENDING",
          valor: value.valor,
          vencimento: asaasData.dueDate ? new Date(asaasData.dueDate).toISOString() : null,
          payload: {
            origem: "api_publica",
            unidade_id: unidade.id,
            referencia: value.referencia ?? null,
            retorno_url: value.retorno_url ?? null,
            raw: asaasData,
          },
        });

        if (insertError) {
          console.error("Erro ao registrar cobrança no banco:", insertError);
        }
      }
    } else if (gateway === "mercado_pago") {
      return new Response(
        JSON.stringify({ error: "Gateway Mercado Pago ainda não implementado nesta API" }),
        {
          status: 501,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } else if (gateway === "seabra") {
      return new Response(
        JSON.stringify({ error: "Gateway Seabra ainda não implementado nesta API" }),
        {
          status: 501,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } else {
      return new Response(JSON.stringify({ error: "Gateway de pagamento não suportado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        id: externalId,
        gateway,
        status: "PENDENTE",
        checkout_url: checkoutUrl,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Erro inesperado em payments-create:", error);
    return new Response(JSON.stringify({ error: "Erro interno ao criar cobrança" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
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

  return handleCreatePayment(req);
});
