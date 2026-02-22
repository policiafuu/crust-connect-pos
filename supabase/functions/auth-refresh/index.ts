import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create, getNumericDate, Header, Payload } from "https://deno.land/x/djwt@v2.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

async function getSupabaseClient() {
  const url = getEnv("SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

async function getJwtKey(): Promise<CryptoKey> {
  const secret = getEnv("JWT_SECRET");
  const enc = new TextEncoder().encode(secret);
  return await crypto.subtle.importKey(
    "raw",
    enc,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function hashRefreshToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function generateTokens(user: any, req: Request, supabase: any) {
  const key = await getJwtKey();

  const header: Header = { alg: "HS256", typ: "JWT" };
  const exp = getNumericDate(60 * 15); // 15 minutos
  const payload: Payload = {
    sub: user.id,
    role: user.role,
    franquia_id: user.franquia_id ?? null,
    unidade_id: user.unidade_id ?? null,
    username: user.username,
    exp,
  };

  const accessToken = await create(header, payload, key);

  const refreshToken = crypto.randomUUID() + "-" + crypto.randomUUID();
  const refreshHash = await hashRefreshToken(refreshToken);

  const refreshExpires = new Date();
  refreshExpires.setDate(refreshExpires.getDate() + 30);

  const { error } = await supabase.from("auth_refresh_tokens").insert({
    user_id: user.id,
    token_hash: refreshHash,
    expires_at: refreshExpires.toISOString(),
    ip: undefined,
    user_agent: undefined,
  });

  if (error) {
    console.error("Erro ao salvar novo refresh token:", error);
    throw error;
  }

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: exp,
  };
}

function mapEffectiveRole(rawRole: string, franquiaId: string | null): "super_admin" | "admin_franquia" | "operador" {
  if (rawRole === "admin") {
    return franquiaId ? "admin_franquia" : "super_admin";
  }
  return "operador";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { refreshToken } = await req.json();

    if (!refreshToken || typeof refreshToken !== "string") {
      return new Response(
        JSON.stringify({ error: "Refresh token inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = await getSupabaseClient();
    const refreshHash = await hashRefreshToken(refreshToken);

    const { data: storedToken, error } = await supabase
      .from("auth_refresh_tokens")
      .select("id, user_id, expires_at, revoked_at")
      .eq("token_hash", refreshHash)
      .maybeSingle();

    if (error || !storedToken) {
      return new Response(
        JSON.stringify({ error: "Refresh token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (storedToken.revoked_at || new Date(storedToken.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Refresh token expirado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Buscar usuário atualizado
    const { data: user, error: userError } = await supabase
      .from("system_users")
      .select("id, username, role, unidade, franquia_id, unidade_id")
      .eq("id", storedToken.user_id)
      .maybeSingle();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Revogar token antigo
    await supabase
      .from("auth_refresh_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", storedToken.id);

    const { accessToken, refreshToken: newRefreshToken, accessTokenExpiresAt } = await generateTokens(user, req, supabase);

    const effectiveRole = mapEffectiveRole(user.role, user.franquia_id ?? null);

    const responseBody = {
      user: {
        id: user.id,
        username: user.username,
        role: effectiveRole,
        unidade: user.unidade,
        franquiaId: user.franquia_id ?? null,
        unidadeId: user.unidade_id ?? null,
      },
      tokens: {
        accessToken,
        refreshToken: newRefreshToken,
        accessTokenExpiresAt,
      },
    };

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Erro no auth-refresh:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno de autenticação" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
