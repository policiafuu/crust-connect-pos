import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { differenceInCalendarDays, format } from 'date-fns';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

interface FranquiaFinanceiro {
  id: string;
  nome_franquia: string;
  status_pagamento: string | null;
  data_vencimento: string | null;
  config_pagamento: any | null;
}

interface PlanoResumo {
  id: string;
  nome: string;
  tipo: string;
  valor_base: number;
  duracao_meses: number;
}

interface PacoteResumo {
  id: string;
  nome: string;
  preco_total: number;
}

export function FranquiaFinanceiroPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isPaying, setIsPaying] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: franquia, isLoading: isLoadingFranquia } = useQuery<FranquiaFinanceiro | null>({
    queryKey: ['franquia-financeiro', user?.franquiaId],
    queryFn: async () => {
      if (!user?.franquiaId) return null;

      const { data, error } = await supabase
        .from('franquias')
        .select('id, nome_franquia, status_pagamento, data_vencimento, config_pagamento, desconto_tipo, desconto_valor, desconto_percentual, desconto_recorrente')
        .eq('id', user.franquiaId)
        .maybeSingle();

      if (error) throw error;
      return data as any;
    },
    enabled: !!user?.franquiaId,
  });

  const planoId = (franquia?.config_pagamento as any)?.plano_id as string | undefined;
  const modulosAtivos = ((franquia?.config_pagamento as any)?.modulos_ativos as string[]) || [];

  const { data: planoAtual, isLoading: isLoadingPlano } = useQuery<PlanoResumo | null>({
    queryKey: ['plano-atual', planoId],
    queryFn: async () => {
      if (!planoId) return null;

      const { data, error } = await supabase
        .from('planos')
        .select('id, nome, tipo, valor_base, duracao_meses')
        .eq('id', planoId)
        .maybeSingle();

      if (error) throw error;
      return data as PlanoResumo | null;
    },
    enabled: !!planoId,
  });

  const { data: modulos = [] } = useQuery<{ codigo: string; preco_mensal: number }[]>({
    queryKey: ['modulos-preco', modulosAtivos],
    queryFn: async () => {
      if (modulosAtivos.length === 0) return [];

      const { data, error } = await supabase
        .from('modulos')
        .select('codigo, preco_mensal')
        .in('codigo', modulosAtivos)
        .eq('ativo', true);

      if (error) throw error;
      return data as any;
    },
    enabled: modulosAtivos.length > 0,
  });

  const planoNome = planoAtual?.nome;

  const { data: pacoteAtual } = useQuery<PacoteResumo | null>({
    queryKey: ['pacote-atual', planoNome],
    queryFn: async () => {
      if (!planoNome) return null;
      const { data, error } = await supabase
        .from('pacotes_comerciais')
        .select('id, nome, preco_total')
        .eq('nome', planoNome)
        .eq('ativo', true)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return (data as any) || null;
    },
    enabled: !!planoNome,
  });

  const diasRestantes = useMemo(() => {
    if (!franquia?.data_vencimento) return null;
    return differenceInCalendarDays(new Date(franquia.data_vencimento), new Date());
  }, [franquia?.data_vencimento]);

  const valorBase = useMemo(() => {
    const cfg = (franquia?.config_pagamento as any) || {};
    // 1) Se existir pacote comercial vinculado ao plano, usa sempre o preco_total do pacote
    if (pacoteAtual?.preco_total != null) return Number(pacoteAtual.preco_total);
    // 2) Caso contrário, usa o valor_base do plano
    if (planoAtual?.valor_base != null) return Number(planoAtual.valor_base);
    // 3) Por último, usa algum valor legado salvo na franquia (se existir)
    if (cfg.valor_plano != null) return Number(cfg.valor_plano);
    return 0;
  }, [franquia?.config_pagamento, planoAtual?.valor_base, pacoteAtual?.preco_total]);

  const proximoPlanoInfo = useMemo(() => {
    const cfg = (franquia?.config_pagamento as any) || {};
    if (!cfg.next_plano_id || !cfg.next_valor_plano) return null;
    return {
      valor: Number(cfg.next_valor_plano),
    };
  }, [franquia?.config_pagamento]);

  const valorModulos = useMemo(() => {
    return modulos.reduce((acc, m) => acc + Number(m.preco_mensal || 0), 0);
  }, [modulos]);

  const valorPlano = useMemo(() => {
    let total = valorBase + valorModulos;

    const descontoTipo = (franquia as any)?.desconto_tipo;
    const descontoValor = Number((franquia as any)?.desconto_valor || 0);
    const descontoPercentual = Number((franquia as any)?.desconto_percentual || 0);

    if (descontoTipo === 'fixo' && descontoValor > 0) {
      total = total - descontoValor;
    } else if (descontoTipo === 'percentual' && descontoPercentual > 0) {
      total = total - total * (descontoPercentual / 100);
    }

    return Math.max(0, total);
  }, [valorBase, valorModulos, franquia]);

  const { data: cobrancas = [] } = useQuery({
    queryKey: ['franquia-cobrancas', franquia?.id],
    queryFn: async () => {
      if (!franquia?.id) return [];
      const { data, error } = await supabase
        .from('franquia_cobrancas')
        .select('id, external_id, status, valor, created_at')
        .eq('franquia_id', franquia.id)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!franquia?.id,
  });

  const handlePagarPix = async () => {
    if (!franquia || !valorPlano) {
      toast.error('Não foi possível identificar o valor da franquia.');
      return;
    }

    try {
      setIsPaying(true);

      const { data, error } = await supabase.functions.invoke('criar-cobranca-franquia', {
        body: { franquiaId: franquia.id },
      });

      if (error) {
        console.error('Erro ao criar cobrança:', error);
        toast.error('Erro ao criar cobrança. Tente novamente.');
        return;
      }

      const checkoutUrl = (data as any)?.checkoutUrl as string | undefined;

      if (!checkoutUrl) {
        toast.error('Cobrança criada, mas o gateway não retornou um link de pagamento.');
        return;
      }

      window.open(checkoutUrl, '_blank');
      
      // Recarrega as cobranças após criar uma nova
      queryClient.invalidateQueries({ queryKey: ['franquia-cobrancas', franquia.id] });
    } catch (err) {
      console.error('Erro inesperado ao criar cobrança:', err);
      toast.error('Erro inesperado ao gerar a cobrança.');
    } finally {
      setIsPaying(false);
    }
  };

  const handleSyncPayment = async (externalId: string) => {
    if (!franquia) return;

    try {
      setIsSyncing(true);
      toast.loading('Sincronizando com Asaas...');

      const { data, error } = await supabase.functions.invoke('sync-payment-status', {
        body: {
          franquiaId: franquia.id,
          externalId,
        },
      });

      toast.dismiss();

      if (error) {
        console.error('Erro ao sincronizar:', error);
        toast.error('Erro ao sincronizar pagamento.');
        return;
      }

      const result = data as any;
      
      if (result.status === 'PAGO') {
        toast.success('Pagamento confirmado! Franquia renovada com sucesso.');
        // Recarrega os dados da franquia e cobranças
        queryClient.invalidateQueries({ queryKey: ['franquia-financeiro', user?.franquiaId] });
        queryClient.invalidateQueries({ queryKey: ['franquia-cobrancas', franquia.id] });
      } else {
        toast.info(`Status atual no Asaas: ${result.asaasStatus}`);
      }
    } catch (err) {
      toast.dismiss();
      console.error('Erro inesperado ao sincronizar:', err);
      toast.error('Erro inesperado ao sincronizar pagamento.');
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoadingFranquia) {
    return (
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm font-mono">Plano atual</CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm font-mono">Status da conta</CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!franquia) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm font-mono">Financeiro da franquia</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar os dados da franquia. Verifique se o usuário está associado
            corretamente a uma franquia.
          </p>
        </CardContent>
      </Card>
    );
  }

  const status = franquia.status_pagamento ?? 'indefinido';
  const vencimentoFormatado = franquia.data_vencimento
    ? format(new Date(franquia.data_vencimento), 'dd/MM/yyyy')
    : null;

  const statusLabel = status === 'ativo' ? 'Ativo' : status === 'inadimplente' ? 'Inadimplente' : 'Indefinido';

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-mono">Plano atual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Franquia</p>
                <p className="font-mono font-semibold text-base">{franquia.nome_franquia}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-1">Valor mensal</p>
                <p className="font-mono text-2xl font-bold">
                  {valorPlano != null ? `R$ ${valorPlano.toFixed(2)}` : '—'}
                </p>
                {planoAtual && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {planoAtual.nome} • {planoAtual.tipo} • {planoAtual.duracao_meses} mês(es)
                  </p>
                )}
                {valorModulos > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    + R$ {valorModulos.toFixed(2)} em módulos
                  </p>
                )}
                {(franquia as any)?.desconto_tipo && (franquia as any)?.desconto_tipo !== 'nenhum' && (
                  <p className="text-[11px] text-green-600 mt-1">
                    Desconto {(franquia as any)?.desconto_tipo} aplicado
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Status de pagamento</p>
                <p className="font-mono text-sm">
                  {statusLabel}
                </p>
              </div>
              <div className="space-y-1 text-right md:text-left">
                <p className="text-xs text-muted-foreground">Próximo vencimento</p>
                <p className="font-mono text-sm">{vencimentoFormatado ?? '—'}</p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-border/60 bg-muted/5 p-3">
              <p className="text-xs text-muted-foreground">
                Dúvidas sobre cobrança ou troca de plano? Entre em contato com o suporte financeiro
                pelo WhatsApp e informe o nome da sua franquia.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-mono">Status da conta</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Situação</p>
                <p className="font-mono font-semibold capitalize">{statusLabel}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-1">Dias para o vencimento</p>
                <p className="font-mono text-3xl font-bold">
                  {diasRestantes != null ? diasRestantes : '—'}
                </p>
              </div>
            </div>

            <Button
              type="button"
              className="w-full"
              onClick={handlePagarPix}
              disabled={!valorPlano || isPaying}
            >
              {isPaying ? 'Gerando cobrança…' : 'PAGAR COM PIX'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {cobrancas.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-mono">Últimas cobranças</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {cobrancas.map((cobranca) => (
                <div
                  key={cobranca.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/5 p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(cobranca.created_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                    <p className="font-mono text-sm font-semibold">
                      R$ {Number(cobranca.valor).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      ID: {cobranca.external_id}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-mono px-2 py-1 rounded ${
                        cobranca.status === 'PAGO'
                          ? 'bg-green-100 text-green-700'
                          : cobranca.status === 'PENDENTE'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {cobranca.status}
                    </span>
                    {cobranca.status !== 'PAGO' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSyncPayment(cobranca.external_id)}
                        disabled={isSyncing}
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              💡 Se você já pagou uma cobrança no Asaas, clique no botão de sincronização para
              atualizar o status manualmente.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
