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
    const { text, voiceId, franquiaId, sequenceIndex } = await req.json()

    if (!text || !voiceId) {
      return new Response(
        JSON.stringify({ error: 'text e voiceId são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    let elevenApiKeys: string[] = []

    if (franquiaId && SUPABASE_URL && SERVICE_ROLE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
        const { data, error } = await supabase
          .from('franquias')
          .select('config_pagamento')
          .eq('id', franquiaId)
          .maybeSingle()

        if (error) {
          console.error('Erro ao buscar config da franquia para ElevenLabs:', error)
        } else {
          const cfg = (data?.config_pagamento as any) || {}
          const tvTts = cfg?.tv_tts || {}
          const primaryKey = tvTts.elevenlabs_api_key || cfg?.elevenlabs_api_key || null
          const secondaryKey = tvTts.elevenlabs_api_key_secondary || null
          const tertiaryKey = tvTts.elevenlabs_api_key_tertiary || null

          if (primaryKey) elevenApiKeys.push(primaryKey)
          if (secondaryKey && secondaryKey !== primaryKey) elevenApiKeys.push(secondaryKey)
          if (tertiaryKey && tertiaryKey !== primaryKey && tertiaryKey !== secondaryKey) {
            elevenApiKeys.push(tertiaryKey)
          }
        }
      } catch (e) {
        console.error('Erro ao inicializar cliente Supabase na função elevenlabs-tts:', e)
      }
    }

    // Fallback: usa chave global se configurada (ex: franquia padrão Dom Fiorentino)
    const globalKey = Deno.env.get('ELEVENLABS_API_KEY') ?? null
    if (globalKey && !elevenApiKeys.includes(globalKey)) {
      elevenApiKeys.push(globalKey)
    }

    if (elevenApiKeys.length === 0) {
      console.error('Nenhuma chave ElevenLabs configurada para esta franquia')
      return new Response(
        JSON.stringify({ error: 'ElevenLabs não configurado para esta franquia' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Escolhe a chave inicial com base em sequenceIndex (para intercalar entre chaves)
    const baseIndex = typeof sequenceIndex === 'number' && sequenceIndex >= 0
      ? sequenceIndex % elevenApiKeys.length
      : 0

    let lastErrorText: string | null = null
    let lastErrorStatus: number | null = null

    for (let i = 0; i < elevenApiKeys.length; i++) {
      const key = elevenApiKeys[(baseIndex + i) % elevenApiKeys.length]
      
      // Delay variável entre tentativas (apenas após a primeira falha)
      if (i > 0) {
        // Delay oscilante: 300ms a 800ms
        const delay = 300 + Math.floor(Math.random() * 500)
        console.log(`Aguardando ${delay}ms antes de tentar próxima chave ElevenLabs...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      console.log(`Tentativa ${i + 1}/${elevenApiKeys.length} - Chamando ElevenLabs API...`)

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          output_format: 'mp3_44100_128',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.85,
            style: 0.3,
            use_speaker_boost: true,
            speed: 1.1,
          },
        }),
      })

      if (response.ok) {
        console.log(`Sucesso com a chave ${i + 1}/${elevenApiKeys.length}`)
        const audioBuffer = await response.arrayBuffer()
        return new Response(audioBuffer, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'audio/mpeg',
            'Cache-Control': 'no-store',
          },
        })
      }

      lastErrorStatus = response.status
      lastErrorText = await response.text()
      console.error(`Erro ElevenLabs TTS com chave ${i + 1}/${elevenApiKeys.length}:`, response.status, lastErrorText)
    }

    console.error(`Todas as ${elevenApiKeys.length} chaves falharam. Último erro:`, lastErrorStatus, lastErrorText)
    
    return new Response(
      JSON.stringify({ 
        error: 'Falha ao gerar áudio ElevenLabs com todas as chaves disponíveis',
        details: lastErrorText,
        attempts: elevenApiKeys.length 
      }),
      { status: lastErrorStatus || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Erro na função elevenlabs-tts:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno ao gerar áudio' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
