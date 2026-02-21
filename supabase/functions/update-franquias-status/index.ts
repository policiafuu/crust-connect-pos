import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    throw new Error("Backend configuration missing: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = await getClient();

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // 1) Marcar como inadimplente quem já venceu (trial de 7 dias expirado)
    const { error: overdueError } = await supabase
      .from("franquias")
      .update({ status_pagamento: "inadimplente" })
      .lt("data_vencimento", today)
      .neq("status_pagamento", "inadimplente"); // Evitar updates desnecessários

    if (overdueError) {
      console.error("Erro ao marcar franquias inadimplentes:", overdueError);
      throw overdueError;
    }

    // 2) Manter/voltar como ativo quem ainda não venceu ou não tem vencimento configurado
    const { error: activeError } = await supabase
      .from("franquias")
      .update({ status_pagamento: "ativo" })
      .or(`data_vencimento.gte.${today},data_vencimento.is.null`);

    if (activeError) {
      console.error("Erro ao marcar franquias ativas:", activeError);
      throw activeError;
    }

    return new Response(JSON.stringify({ success: true, date: today }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro na função update-franquias-status:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
