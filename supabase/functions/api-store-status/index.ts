import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StoreStatusResponse {
  franquia_id: string | null;
  unidade_id: string | null;
  status_pagamento: string | null;
  data_vencimento: string | null;
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

async function handleStoreStatus(req: Request): Promise<Response> {
  const auth = await authenticateApiKey(req);
  if ("error" in auth) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = await getSupabaseClient();

    let response: StoreStatusResponse = {
      franquia_id: null,
      unidade_id: null,
      status_pagamento: null,
      data_vencimento: null,
    };

    if (auth.ownerType === "franquia") {
      const { data, error } = await supabase
        .from("franquias")
        .select("id, status_pagamento, data_vencimento")
        .eq("id", auth.ownerId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching franquia for store status:", error);
        return new Response(JSON.stringify({ error: "Erro ao buscar status da franquia" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      response = {
        franquia_id: data?.id ?? null,
        unidade_id: null,
        status_pagamento: data?.status_pagamento ?? null,
        data_vencimento: data?.data_vencimento ?? null,
      };
    } else {
      // ownerType === 'unidade'
      const { data: unidade, error: unidadeError } = await supabase
        .from("unidades")
        .select("id, franquia_id")
        .eq("id", auth.ownerId)
        .maybeSingle();

      if (unidadeError) {
        console.error("Error fetching unidade for store status:", unidadeError);
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
        .select("id, status_pagamento, data_vencimento")
        .eq("id", unidade.franquia_id)
        .maybeSingle();

      if (franquiaError) {
        console.error("Error fetching franquia for unidade store status:", franquiaError);
        return new Response(JSON.stringify({ error: "Erro ao buscar franquia da loja" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      response = {
        franquia_id: franquia?.id ?? null,
        unidade_id: unidade.id,
        status_pagamento: franquia?.status_pagamento ?? null,
        data_vencimento: franquia?.data_vencimento ?? null,
      };
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unexpected error in store-status function:", error);
    return new Response(JSON.stringify({ error: "Erro interno ao obter status da loja" }), {
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

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return handleStoreStatus(req);
});
