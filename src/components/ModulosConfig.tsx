import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUnit } from '@/contexts/UnitContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Package, Webhook, Copy, Check, Phone, FileCode, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTTS } from '@/hooks/useTTS';

interface Modulo {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
}

export function ModulosConfig() {
  const { user } = useAuth();
  const { selectedUnit } = useUnit();
  const queryClient = useQueryClient();

  const { data: modulos = [], isLoading: loadingModulos } = useQuery<Modulo[]>({
    queryKey: ['modulos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('modulos')
        .select('id, codigo, nome, descricao, preco_mensal')
        .eq('ativo', true);
      if (error) throw error;
      return data as any;
    },
  });

  const { data: franquia, isLoading: loadingFranquia } = useQuery({
    queryKey: ['franquia-modulos', user?.franquiaId],
    queryFn: async () => {
      if (!user?.franquiaId) return null;
      const { data, error } = await supabase
        .from('franquias')
        .select('config_pagamento')
        .eq('id', user.franquiaId)
        .maybeSingle();
      if (error) throw error;
      return data as { config_pagamento: any } | null;
    },
    enabled: !!user?.franquiaId,
  });

  const modulosAtivos = (franquia?.config_pagamento as any)?.modulos_ativos || [];

  const toggleModuloMutation = useMutation({
    mutationFn: async ({ codigo, ativo }: { codigo: string; ativo: boolean }) => {
      if (!user?.franquiaId) return;
      const currentConfig = (franquia?.config_pagamento as any) || {};
      const currentModulos = currentConfig.modulos_ativos || [];

      const newModulos = ativo
        ? [...currentModulos.filter((m: string) => m !== codigo), codigo]
        : currentModulos.filter((m: string) => m !== codigo);

      const newConfig = {
        ...currentConfig,
        modulos_ativos: newModulos,
      };

      const { error } = await supabase
        .from('franquias')
        .update({ config_pagamento: newConfig })
        .eq('id', user.franquiaId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['franquia-modulos', user?.franquiaId] });
      toast.success('Módulo atualizado com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao atualizar módulo');
    },
  });

  const tvPrompts = (franquia?.config_pagamento as any)?.tv_prompts || {
    entrega_chamada: 'É a sua vez {nome}',
    entrega_bag: 'Pegue a {bag}',
    pagamento_chamada:
      'Olá {nome}, sua senha é {senha}. Dirija-se ao caixa da {unidade} para receber.',
  };

  const tvTtsConfig = (franquia?.config_pagamento as any)?.tv_tts || {
    enabled: true,
    volume: 100,
    voice_model: 'system',
  };

  const whatsappConfig = (franquia?.config_pagamento as any)?.whatsapp || null;

  const [webhookUrl, setWebhookUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [whatsUrl, setWhatsUrl] = useState(whatsappConfig?.url || '');
  const [whatsApiKey, setWhatsApiKey] = useState(whatsappConfig?.api_key || '');
  const [whatsInstance, setWhatsInstance] = useState(whatsappConfig?.instance || '');

  const APPS_SCRIPT_CODE = `function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Nome da aba: Unidade-DD/MM
    var hoje = new Date();
    var dataFormatada = Utilities.formatDate(hoje, "America/Sao_Paulo", "dd/MM");
    var nomeAba = data.unidade + "-" + dataFormatada;
    
    // Verificar se a aba existe, senão criar
    var sheet = ss.getSheetByName(nomeAba);
    if (!sheet) {
      sheet = ss.insertSheet(nomeAba);
      // Adicionar cabeçalhos
      sheet.appendRow([
        "Horário Saída",
        "Motoboy",
        "Qtd. Entregas",
        "Tipo BAG",
        "Possui Bebida",
        "Registrado em"
      ]);
      // Formatar cabeçalhos
      sheet.getRange(1, 1, 1, 6).setFontWeight("bold");
    }
    
    // Adicionar nova linha
    sheet.appendRow([
      data.horario_saida,
      data.motoboy,
      data.quantidade_entregas,
      data.bag,
      data.possui_bebida || "NAO",
      new Date()
    ]);
    
    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const savePromptsMutation = useMutation({
    mutationFn: async (payload: { entrega_chamada: string; entrega_bag: string; pagamento_chamada: string }) => {
      if (!user?.franquiaId) return;
      const currentConfig = (franquia?.config_pagamento as any) || {};
      const newConfig = {
        ...currentConfig,
        tv_prompts: payload,
      };

      const { error } = await supabase
        .from('franquias')
        .update({ config_pagamento: newConfig })
        .eq('id', user.franquiaId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['franquia-modulos', user?.franquiaId] });
      queryClient.invalidateQueries({ queryKey: ['franquia-config-tv', user?.franquiaId] });
      toast.success('Textos da TV atualizados para a franquia!');
    },
    onError: () => {
      toast.error('Erro ao salvar textos da TV');
    },
  });

  if (loadingModulos || loadingFranquia) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          Módulos opcionais
        </CardTitle>
        <CardDescription>
          Visualize os módulos ativos para sua franquia e ajuste as mensagens do módulo de TV.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {modulos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum módulo opcional disponível no momento.
            </p>
          ) : (
            modulos.map((m) => {
              const ativo = modulosAtivos.includes(m.codigo);
              const preco = (m as any).preco_mensal || 0;

              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between border border-border rounded-lg p-4"
                >
                  <div className="flex-1">
                    <Label className="font-semibold">{m.nome}</Label>
                    {m.descricao && (
                      <p className="text-xs text-muted-foreground mt-1">{m.descricao}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Código: {m.codigo} • Valor mensal: R$ {Number(preco).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${ativo ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {ativo ? 'Ativo' : 'Inativo'}
                    </span>
                    <Switch
                      checked={ativo}
                      disabled={toggleModuloMutation.isPending}
                      onCheckedChange={(checked) => {
                        if (!user || user.role !== 'super_admin') {
                          toast.info(
                            'Para ativar ou desativar módulos, entre em contato com o suporte para mudar seu pacote.',
                          );
                          return;
                        }
                        toggleModuloMutation.mutate({ codigo: m.codigo, ativo: checked });
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Configuração de voz da chamada (TTS) */}
        {user?.franquiaId && (
          <TvTtsConfigSection franquiaId={user.franquiaId} initialConfig={tvTtsConfig} />
        )}

        {/* Integração Planilha (Google Sheets) */}
        {modulosAtivos.includes('integracao_planilha') && selectedUnit && (
          <div className="border-t border-border pt-6 space-y-4">
            <div className="flex items-center gap-2">
              <Webhook className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Integração com Planilha (Google Sheets)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Cole a URL do seu Google Apps Script e use o código abaixo como base.
            </p>
            <div className="space-y-2">
              <Label htmlFor="webhook-url">URL do Webhook (Apps Script)</Label>
              <div className="flex gap-2">
                <Input
                  id="webhook-url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/..."
                />
                <Button
                  type="button"
                  onClick={async () => {
                    const { data, error } = await supabase
                      .from('system_config')
                      .select('id')
                      .eq('unidade', selectedUnit)
                      .maybeSingle();

                    if (error && error.code !== 'PGRST116') {
                      toast.error('Erro ao salvar webhook');
                      return;
                    }

                    const upsertError = data
                      ? (await supabase
                          .from('system_config')
                          .update({ webhook_url: webhookUrl })
                          .eq('id', data.id)).error
                      : (await supabase
                          .from('system_config')
                          .insert({ unidade: selectedUnit, webhook_url: webhookUrl } as any)).error;

                    if (upsertError) {
                      toast.error('Erro ao salvar webhook');
                    } else {
                      toast.success('Webhook salvo com sucesso!');
                      queryClient.invalidateQueries({ queryKey: ['system-config', selectedUnit] });
                    }
                  }}
                >
                  Salvar
                </Button>
              </div>
            </div>
            <div className="border border-dashed border-border rounded-lg p-4 space-y-3 bg-muted/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">Código base do Apps Script</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(APPS_SCRIPT_CODE);
                    setCopied(true);
                    toast.success('Código copiado!');
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="gap-2"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  Copiar código
                </Button>
              </div>
              <Textarea
                readOnly
                value={APPS_SCRIPT_CODE}
                className="font-mono text-xs h-40 resize-none"
              />
            </div>
          </div>
        )}

        {/* Configuração de WhatsApp (Evolution) */}
        {modulosAtivos.includes('whatsapp_evolution') && (
          <div className="border-t border-border pt-6 space-y-4">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">WhatsApp (Evolution) da franquia</span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="whats-url">URL da API</Label>
                <Input
                  id="whats-url"
                  value={whatsUrl}
                  onChange={(e) => setWhatsUrl(e.target.value)}
                  placeholder="https://api.seuwhats.com/instance/..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whats-instance">Instância</Label>
                <Input
                  id="whats-instance"
                  value={whatsInstance}
                  onChange={(e) => setWhatsInstance(e.target.value)}
                  placeholder="ID da instância"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whats-api-key">API Key</Label>
                <Input
                  id="whats-api-key"
                  type="password"
                  value={whatsApiKey}
                  onChange={(e) => setWhatsApiKey(e.target.value)}
                  placeholder="Chave da API"
                />
              </div>
            </div>
            <Button
              type="button"
              onClick={async () => {
                if (!user?.franquiaId) return;

                const { data, error } = await supabase
                  .from('franquias')
                  .select('config_pagamento')
                  .eq('id', user.franquiaId)
                  .maybeSingle();

                if (error) {
                  toast.error('Erro ao carregar configuração');
                  return;
                }

                const currentCfg = (data?.config_pagamento as any) || {};
                const newCfg = {
                  ...currentCfg,
                  whatsapp:
                    whatsUrl && whatsApiKey && whatsInstance
                      ? { url: whatsUrl, api_key: whatsApiKey, instance: whatsInstance }
                      : null,
                };

                const { error: updateError } = await supabase
                  .from('franquias')
                  .update({ config_pagamento: newCfg })
                  .eq('id', user.franquiaId);

                if (updateError) {
                  toast.error('Erro ao salvar configuração de WhatsApp');
                } else {
                  toast.success('Configuração de WhatsApp salva com sucesso!');
                  queryClient.invalidateQueries({ queryKey: ['franquia-modulos', user.franquiaId] });
                }
              }}
            >
              Salvar WhatsApp
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface TvTtsConfigSectionProps {
  franquiaId: string;
  initialConfig: any;
}

function TvTtsConfigSection({ franquiaId, initialConfig }: TvTtsConfigSectionProps) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState<boolean>(initialConfig?.enabled ?? true);
  const [voiceModel, setVoiceModel] = useState<string>(initialConfig?.voice_model ?? 'browser_clara');
  const [volume, setVolume] = useState<number>(initialConfig?.volume ?? 100);
  const [testText, setTestText] = useState<string>('João, é a sua vez! Pegue a bag metro.');
  const [elevenApiKey, setElevenApiKey] = useState<string>(initialConfig?.elevenlabs_api_key ?? '');
  const [elevenApiKeySecondary, setElevenApiKeySecondary] = useState<string>(
    initialConfig?.elevenlabs_api_key_secondary ?? '',
  );
  const [elevenApiKeyTertiary, setElevenApiKeyTertiary] = useState<string>(
    initialConfig?.elevenlabs_api_key_tertiary ?? '',
  );
  const [elevenVoiceId, setElevenVoiceId] = useState<string>(initialConfig?.eleven_voice_id ?? '');
  const [ringtoneId, setRingtoneId] = useState<string>(initialConfig?.ringtone_id ?? 'classic_short');

  const RINGTONE_OPTIONS = [
    {
      id: 'classic_short',
      name: 'Clássico curto (padrão)',
      url: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
    },
    {
      id: 'digital_ping',
      name: 'Ping digital suave',
      url: 'https://assets.mixkit.co/active_storage/sfx/2850/2850-preview.mp3',
    },
    {
      id: 'doorbell_soft',
      name: 'Campainha suave',
      url: 'https://assets.mixkit.co/active_storage/sfx/2868/2868-preview.mp3',
    },
    {
      id: 'notification_fast',
      name: 'Notificação rápida',
      url: 'https://assets.mixkit.co/active_storage/sfx/2770/2770-preview.mp3',
    },
    {
      id: 'alert_subtle',
      name: 'Alerta sutil',
      url: 'https://assets.mixkit.co/active_storage/sfx/2735/2735-preview.mp3',
    },
    {
      id: 'bell_soft',
      name: 'Sino suave',
      url: 'https://assets.mixkit.co/active_storage/sfx/2577/2577-preview.mp3',
    },
    {
      id: 'game_level_up',
      name: 'Som tipo app de entregas 1',
      url: 'https://assets.mixkit.co/active_storage/sfx/2010/2010-preview.mp3',
    },
    {
      id: 'game_notification',
      name: 'Som tipo app de entregas 2',
      url: 'https://assets.mixkit.co/active_storage/sfx/512/512-preview.mp3',
    },
    {
      id: 'soft_pop',
      name: 'Pop suave',
      url: 'https://assets.mixkit.co/active_storage/sfx/2351/2351-preview.mp3',
    },
    {
      id: 'short_whistle',
      name: 'Apito curto',
      url: 'https://assets.mixkit.co/active_storage/sfx/2772/2772-preview.mp3',
    },
  ] as const;

  const selectedRingtone =
    RINGTONE_OPTIONS.find((r) => r.id === ringtoneId) || RINGTONE_OPTIONS[0];

  const browserVoiceModel = (voiceModel.startsWith('browser_') ? voiceModel : 'browser_clara') as any;

  const { speak } = useTTS({
    enabled: true,
    volume,
    voice_model: browserVoiceModel,
    franquiaId,
  });

  const saveTtsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('franquias')
        .select('config_pagamento')
        .eq('id', franquiaId)
        .maybeSingle();

      if (error) throw error;

      const currentCfg = (data?.config_pagamento as any) || {};
      const newCfg = {
        ...currentCfg,
        tv_tts: {
          enabled,
          volume,
          voice_model: voiceModel,
          elevenlabs_api_key: elevenApiKey || undefined,
          elevenlabs_api_key_secondary: elevenApiKeySecondary || undefined,
          elevenlabs_api_key_tertiary: elevenApiKeyTertiary || undefined,
          eleven_voice_id: elevenVoiceId || undefined,
          ringtone_id: ringtoneId || undefined,
        },
      };

      const { error: updateError } = await supabase
        .from('franquias')
        .update({ config_pagamento: newCfg })
        .eq('id', franquiaId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success('Configuração de voz da TV salva com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['franquia-config-tv', franquiaId] });
    },
    onError: () => {
      toast.error('Erro ao salvar configuração de voz da TV');
    },
  });

  const playWithElevenLabs = async (text: string) => {
    const hasAnyKey = !!elevenApiKey || !!elevenApiKeySecondary;
    if (!elevenVoiceId || !hasAnyKey || voiceModel !== 'elevenlabs') {
      await speak(text);
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text, voiceId: elevenVoiceId, franquiaId }),
        },
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error('Erro ElevenLabs (teste):', errText);
        toast.error('Erro ao testar voz ElevenLabs, usando voz do navegador.');
        await speak(text);
        return;
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.volume = (volume ?? 100) / 100;
      await audio.play();
    } catch (e) {
      console.error('Erro ao chamar ElevenLabs (teste):', e);
      toast.error('Erro ao testar voz ElevenLabs, usando voz do navegador.');
      await speak(text);
    }
  };

  const handleTest = (text: string) => {
    if (voiceModel === 'elevenlabs') {
      return playWithElevenLabs(text);
    }
    return speak(text);
  };

  return (
    <div className="mt-6 border-t border-border pt-6 space-y-4">
      <div className="flex items-center gap-2">
        <Volume2 className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">Voz e som da chamada (TV)</span>
      </div>
      <p className="text-xs text-muted-foreground">
        🆓 Sistema 100% gratuito usando Web Speech API (única opção sem API key). 
        As vozes Google Cloud, Amazon Polly, Azure, etc. todas requerem pagamento e API keys.
        O toque inicial (tipo iFood/99) é fixo e não consome créditos.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Ativar voz</Label>
          <div className="flex items-center gap-3">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            <span className="text-xs text-muted-foreground">
              Quando desativado, apenas a animação visual será exibida na TV.
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Modelo de voz</Label>
          <Select value={voiceModel} onValueChange={setVoiceModel}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o modelo de voz" />
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                👩 Vozes Femininas (navegador - grátis)
              </div>
              <SelectItem value="browser_clara">Clara - Suave e Amigável 🌸</SelectItem>
              <SelectItem value="browser_roberta">Roberta - Profissional e Clara 💼</SelectItem>
              <SelectItem value="browser_juliana">Juliana - Jovem e Energética ⚡</SelectItem>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                👨 Vozes Masculinas (navegador - grátis)
              </div>
              <SelectItem value="browser_paulo">Paulo - Grave e Séria 🎙️</SelectItem>
              <SelectItem value="browser_marcelo">Marcelo - Neutra e Confiável 👔</SelectItem>
              <SelectItem value="browser_eduardo">Eduardo - Dinâmica e Assertiva 🚀</SelectItem>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                🎧 ElevenLabs (paga, usando seus créditos)
              </div>
              <SelectItem value="elevenlabs">Usar ElevenLabs (se configurado abaixo)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground mt-1">
            💡 Navegador = 100% grátis. ElevenLabs usa seus créditos da conta Eleven.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Volume da voz</Label>
        <div className="flex items-center gap-4">
          <Slider
            value={[volume]}
            min={0}
            max={100}
            step={5}
            onValueChange={([v]) => setVolume(v)}
            className="flex-1"
          />
          <span className="w-10 text-xs text-right text-muted-foreground">{volume}%</span>
        </div>
      </div>

      <div className="space-y-3">
        <Label>Toque da chamada (campainha)</Label>
        <p className="text-[11px] text-muted-foreground">
          Esse é o som inicial tipo iFood/99 que toca antes da voz falar o nome, bag e bebida.
        </p>
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <Select value={ringtoneId} onValueChange={setRingtoneId}>
            <SelectTrigger className="md:w-72">
              <SelectValue placeholder="Selecione o toque" />
            </SelectTrigger>
            <SelectContent>
              {RINGTONE_OPTIONS.map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>
                  {opt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const ring = selectedRingtone || RINGTONE_OPTIONS[0];
                const audio = new Audio(ring.url);
                audio.volume = (volume ?? 100) / 100;
                await audio.play();
              } catch (e) {
                console.error('Erro ao tocar toque de chamada:', e);
                toast.error('Não foi possível reproduzir o toque agora.');
              }
            }}
            className="md:w-auto"
          >
            🔊 Pré-escutar toque
          </Button>
        </div>
      </div>

      <div className="space-y-4 border-t border-border pt-4 mt-2">
        <div className="space-y-1">
          <Label>ElevenLabs (opcional, usando seus créditos)</Label>
          <p className="text-[11px] text-muted-foreground">
            Preencha apenas se quiser usar sua própria conta ElevenLabs. Cada chamada consome créditos da sua conta.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>API Key #1 (Primária) 🔑</Label>
            <Input
              type="password"
              value={elevenApiKey}
              onChange={(e) => setElevenApiKey(e.target.value)}
              placeholder="xi-..."
            />
          </div>
          <div className="space-y-1">
            <Label>API Key #2 (Backup) 🔄</Label>
            <Input
              type="password"
              value={elevenApiKeySecondary}
              onChange={(e) => setElevenApiKeySecondary(e.target.value)}
              placeholder="xi-... (opcional)"
            />
          </div>
          <div className="space-y-1">
            <Label>API Key #3 (Backup Extra) 🔄</Label>
            <Input
              type="password"
              value={elevenApiKeyTertiary}
              onChange={(e) => setElevenApiKeyTertiary(e.target.value)}
              placeholder="xi-... (opcional)"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Delay variável de 300-800ms entre tentativas
            </p>
          </div>
          <div className="space-y-1">
            <Label>Voice ID ElevenLabs 🎙️</Label>
            <Input
              value={elevenVoiceId}
              onChange={(e) => setElevenVoiceId(e.target.value)}
              placeholder="ID da voz (ex: JBFqnCBsd6RMkjVDRZzb)"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Label>Teste a voz selecionada</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleTest('João, é a sua vez! Pegue a bag metro.')}
            className="flex-1"
          >
            🚴 Chamada simples
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleTest('Carlos, é a sua vez! Pegue a bag normal. Atenção! O pedido possui refrigerante!')}
            className="flex-1"
          >
            🥤 Com bebida
          </Button>
        </div>
        <Input
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          placeholder="Ou digite seu próprio texto..."
          className="mt-2"
        />
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleTest(testText || 'João, é a sua vez! Pegue a bag metro.')}
          >
            🔊 Testar texto personalizado
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => saveTtsMutation.mutate()}
            disabled={saveTtsMutation.isPending}
          >
            {saveTtsMutation.isPending ? 'Salvando...' : '💾 Salvar configuração'}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          A alteração é aplicada automaticamente nas TVs conectadas, sem precisar recarregar a tela.
        </p>
      </div>
    </div>
  );
}
