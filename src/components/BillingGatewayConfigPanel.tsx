import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface BillingGatewayConfigRow {
  id: string;
  config_value: string;
}

interface BillingGatewayConfigValue {
  provider: 'asas' | 'mercado_pago' | 'ciabra';
  api_key: string;
  webhook_url: string;
  webhook_secret: string;
}

export function BillingGatewayConfigPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isSuperAdmin = user?.role === 'super_admin';

  const { data, isLoading } = useQuery<BillingGatewayConfigRow | null>({
    queryKey: ['billing-gateway-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_config')
        .select('id, config_value')
        .eq('config_key', 'billing_gateway')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return (data as any) || null;
    },
  });

  let parsed: Partial<BillingGatewayConfigValue> = {};
  if (data?.config_value) {
    try {
      parsed = JSON.parse(data.config_value || '{}');
    } catch {
      parsed = {};
    }
  }

  const [localProvider, setLocalProvider] = useState< BillingGatewayConfigValue['provider'] >(parsed.provider || 'asas');
  const [localApiKey, setLocalApiKey] = useState(parsed.api_key || '');
  const [localWebhookUrl, setLocalWebhookUrl] = useState(parsed.webhook_url || '');
  const [localWebhookSecret, setLocalWebhookSecret] = useState(parsed.webhook_secret || '');

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!isSuperAdmin) return;

      const payload: BillingGatewayConfigValue = {
        provider: localProvider,
        api_key: localApiKey,
        webhook_url: localWebhookUrl,
        webhook_secret: localWebhookSecret,
      };

      const { error } = await supabase.from('global_config').upsert({
        id: data?.id,
        config_key: 'billing_gateway',
        config_value: JSON.stringify(payload),
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Configuração de gateway salva');
      queryClient.invalidateQueries({ queryKey: ['billing-gateway-config'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao salvar configuração de gateway');
    },
  });

  const webhookInterno = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhooks-payments?gateway=asaas`;

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-sm font-mono">Configuração global de cobrança</CardTitle>
        <CardDescription className="text-xs">
          Defina o gateway, API Key e webhook geral usados para gerar cobranças PIX de todas as franquias.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando configuração...</p>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Gateway de pagamento</Label>
              <Select
                value={localProvider}
                onValueChange={(value) => setLocalProvider(value as BillingGatewayConfigValue['provider'])}
                disabled={!isSuperAdmin || saveMutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o gateway" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asas">Asaas</SelectItem>
                  <SelectItem value="mercado_pago">Mercado Pago</SelectItem>
                  <SelectItem value="ciabra">Ciabra</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Escolha entre Asaas, Mercado Pago ou Ciabra para ser o gateway padrão de cobrança.
              </p>
            </div>

            <div className="space-y-2">
              <Label>API Key do gateway (global)</Label>
              <Input
                type="password"
                value={localApiKey}
                onChange={(e) => setLocalApiKey(e.target.value)}
                disabled={!isSuperAdmin || saveMutation.isPending}
              />
              <p className="text-[11px] text-muted-foreground">
                Esta chave será usada por todas as franquias. Trate como um segredo.
              </p>
            </div>

            <Separator className="my-2" />

            <div className="space-y-2">
              <Label>Webhook geral do sistema (interno)</Label>
              <p className="text-[11px] text-muted-foreground">
                URL fixa do backend para configurar no painel do gateway (ex.: Asaas). Use esta URL única.
              </p>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <Input readOnly className="font-mono text-xs" value={webhookInterno} />
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 md:mt-0 md:ml-2 whitespace-nowrap"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(webhookInterno);
                      toast.success('Webhook copiado para a área de transferência');
                    } catch {
                      toast.error('Não foi possível copiar o webhook. Copie manualmente.');
                    }
                  }}
                >
                  Copiar webhook
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Webhook externo (URL opcional)</Label>
              <Input
                value={localWebhookUrl}
                onChange={(e) => setLocalWebhookUrl(e.target.value)}
                disabled={!isSuperAdmin || saveMutation.isPending}
              />
              <p className="text-[11px] text-muted-foreground">
                Opcional. Use se outro sistema também precisar receber notificações de pagamento.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Segredo do webhook externo (opcional)</Label>
              <Input
                type="password"
                value={localWebhookSecret}
                onChange={(e) => setLocalWebhookSecret(e.target.value)}
                disabled={!isSuperAdmin || saveMutation.isPending}
              />
            </div>

            {isSuperAdmin && (
              <Button
                type="button"
                className="w-full mt-2"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Salvando...' : 'Salvar configuração global'}
              </Button>
            )}

            {!isSuperAdmin && (
              <p className="text-[11px] text-muted-foreground mt-2">
                Somente o admin geral pode alterar esta configuração. Em caso de dúvida, contate o suporte.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
