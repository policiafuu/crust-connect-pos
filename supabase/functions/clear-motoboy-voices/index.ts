import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { franquiaId } = await req.json()

    if (!franquiaId) {
      return new Response(
        JSON.stringify({ error: 'franquiaId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error('SUPABASE_URL ou SERVICE_ROLE_KEY não configurados')
      return new Response(
        JSON.stringify({ error: 'Configuração interna ausente' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // 1) Listar e remover todos os arquivos de voz da franquia
    const listResult = await supabase.storage
      .from('motoboy_voices')
      .list(franquiaId, { limit: 1000 })

    if (listResult.error) {
      console.error('Erro ao listar vozes da franquia:', listResult.error)
    } else if (listResult.data && listResult.data.length > 0) {
      const paths = listResult.data.map((obj) => `${franquiaId}/${obj.name}`)
      const removeResult = await supabase.storage
        .from('motoboy_voices')
        .remove(paths)

      if (removeResult.error) {
        console.error('Erro ao remover vozes da franquia:', removeResult.error)
      }
    }

    // 2) Limpar coluna tts_voice_path dos entregadores da franquia
    // Nem todos os registros possuem franquia_id preenchido, então usamos o prefixo do caminho
    const { error: updateError } = await supabase
      .from('entregadores')
      .update({ tts_voice_path: null })
      .like('tts_voice_path', `${franquiaId}/%`)

    if (updateError) {
      console.error('Erro ao limpar tts_voice_path dos entregadores:', updateError)
      return new Response(
        JSON.stringify({ error: 'Erro ao limpar entregadores' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Erro na função clear-motoboy-voices:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno ao limpar vozes' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
