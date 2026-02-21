import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUnit } from '@/contexts/UnitContext';
import { useAuth } from '@/contexts/AuthContext';
import { Layout, BackButton } from '@/components/Layout';
import {
   gerarSenhaPagamento,
   fetchSenhasPagamento,
   atenderSenhaPagamento,
   chamarSenhaPagamento,
   SenhaPagamento,
   fetchEntregadores,
   shouldShowInQueue,
   Entregador,
   Unidade,
   updateEntregador,
   resetDaily,
 } from '@/lib/api';
 import { toast } from 'sonner';
 import { Ticket, Check, Loader2, Tv, ArrowDownCircle, ArrowRightLeft, RotateCcw, Phone } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { supabase } from '@/integrations/supabase/client';
import { TvPaymentPreview } from '@/components/TvPaymentPreview';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function parseSenhaNumero(numero: string): number {
  const match = numero.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export default function FilaPagamento() {
  const { selectedUnit } = useUnit();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Motoboys da unidade atual
  const { data: entregadores = [] } = useQuery<Entregador[]>({
    queryKey: ['entregadores-pagamento', selectedUnit],
    queryFn: () => fetchEntregadores({ unidade: selectedUnit as Unidade }),
    enabled: !!selectedUnit,
    refetchInterval: 10000,
  });

  const entregadoresById = useMemo(() => {
    const map = new Map<string, Entregador>();
    for (const e of entregadores) {
      map.set(e.id, e);
    }
    return map;
  }, [entregadores]);

  // Motoboys NA_UNIDADE (disponíveis) e aptos a receber hoje
  const motoboysNaUnidade = entregadores.filter((e) => {
    const ativo = e.ativo;
    const naUnidade = e.status === 'disponivel';

    const hasRecentCheckin = (() => {
      if (!e.fila_posicao) return false;
      const now = new Date().getTime();
      const filaTime = new Date(e.fila_posicao).getTime();
      const diffHours = (now - filaTime) / (1000 * 60 * 60);
      return diffHours <= 24;
    })();

    return ativo && naUnidade && (shouldShowInQueue(e) || hasRecentCheckin);
  });

  // Buscar senhas ativas
  const { data: senhas = [], isLoading } = useQuery<SenhaPagamento[]>({
    queryKey: ['senhas-pagamento', user?.unidadeId],
    queryFn: () => fetchSenhasPagamento(user!.unidadeId!),
    enabled: !!user?.unidadeId,
    refetchInterval: 5000,
  });

  const senhasAbertas = useMemo(
    () => senhas.filter((s) => s.status === 'aguardando' || s.status === 'chamado'),
    [senhas],
  );

  const senhasPagas = useMemo(
    () => senhas.filter((s) => s.status === 'atendido'),
    [senhas],
  );

  // Senhas ordenadas pela ordem de geração (1, 2, 3...)
  const filaOrdenada = useMemo(
    () =>
      [...senhasAbertas].sort((a, b) => parseSenhaNumero(a.numero_senha) - parseSenhaNumero(b.numero_senha)),
    [senhasAbertas],
  );

  // Senha atual: última com status "chamado"
  const senhaAtual = useMemo(() => {
    const chamadas = senhasAbertas.filter((s) => s.status === 'chamado');
    if (!chamadas.length) return null;

    return chamadas.reduce((maisRecente, atual) => {
      const refMaisRecente = maisRecente.chamado_em || maisRecente.updated_at || maisRecente.created_at;
      const refAtual = atual.chamado_em || atual.updated_at || atual.created_at;
      return new Date(refAtual) > new Date(refMaisRecente) ? atual : maisRecente;
    });
  }, [senhasAbertas]);

  // Motoboys sem senha hoje (para liberar senhas em lote)
  const motoboysSemSenha = useMemo(
    () =>
      motoboysNaUnidade.filter((motoboy) =>
        !senhas.some((senha) => senha.entregador_id && senha.entregador_id === motoboy.id),
      ),
    [motoboysNaUnidade, senhas],
  );

  // Mutations básicas
  const atenderMutation = useMutation({
    mutationFn: (senhaId: string) => atenderSenhaPagamento(senhaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['senhas-pagamento'] });
      toast.success('Pagamento concluído!');
    },
    onError: () => {
      toast.error('Erro ao marcar como pago');
    },
  });

  const chamarMutation = useMutation({
    mutationFn: (senhaId: string) => chamarSenhaPagamento(senhaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['senhas-pagamento'] });
      toast.success('Motoboy chamado para receber');
    },
    onError: () => {
      toast.error('Erro ao chamar para receber');
    },
  });

  // Marcar como ausente: expira senha atual e gera nova no fim da fila
  const marcarAusenteMutation = useMutation({
    mutationFn: async (senha: SenhaPagamento) => {
      await supabase
        .from('senhas_pagamento')
        .update({ status: 'expirado' })
        .eq('id', senha.id);

      if (senha.entregador_id) {
        await gerarSenhaPagamento(
          senha.unidade_id,
          senha.franquia_id,
          senha.entregador_id,
          senha.entregador_nome || undefined,
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['senhas-pagamento'] });
      toast.success('Motoboy marcado como ausente e enviado para o fim da fila');
    },
    onError: () => {
      toast.error('Erro ao marcar como ausente');
    },
  });

  // Enviar para entrega: conclui pagamento e põe motoboy em EM_ENTREGA
  const enviarParaEntregaMutation = useMutation({
    mutationFn: async (senha: SenhaPagamento) => {
      await atenderSenhaPagamento(senha.id);

      if (senha.entregador_id) {
        const entregador = entregadoresById.get(senha.entregador_id);
        if (entregador) {
          await updateEntregador(entregador.id, { status: 'entregando' });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['senhas-pagamento'] });
      queryClient.invalidateQueries({ queryKey: ['entregadores-pagamento'] });
      toast.success('Pagamento concluído e motoboy enviado para entrega');
    },
    onError: () => {
      toast.error('Erro ao enviar motoboy para entrega');
    },
  });

  // Voltar motoboy EM_ENTREGA para a fila: gerar nova senha no fim
   const voltarParaFilaMutation = useMutation({
     mutationFn: async (senha: SenhaPagamento) => {
       await supabase
         .from('senhas_pagamento')
         .update({ status: 'expirado' })
         .eq('id', senha.id);
 
       if (senha.entregador_id) {
         const entregador = entregadoresById.get(senha.entregador_id);
         if (entregador) {
           await updateEntregador(entregador.id, { status: 'disponivel' });
         }
 
         await gerarSenhaPagamento(
           senha.unidade_id,
           senha.franquia_id,
           senha.entregador_id,
           senha.entregador_nome || undefined,
         );
       }
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['senhas-pagamento'] });
       queryClient.invalidateQueries({ queryKey: ['entregadores-pagamento'] });
       toast.success('Motoboy voltou para a fila com nova senha no final');
     },
     onError: () => {
       toast.error('Erro ao voltar motoboy para a fila');
     },
   });
 
  const resetDailyMutation = useMutation({
    mutationFn: () => resetDaily(selectedUnit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['senhas-pagamento'] });
      queryClient.invalidateQueries({ queryKey: ['entregadores-pagamento'] });
      toast.success('Reset diário executado para esta unidade: motoboys desativados e histórico limpo.');
    },
     onError: () => {
       toast.error('Erro ao executar reset diário. Tente novamente.');
     },
   });

  // Liberar senhas (motoboys NA_UNIDADE sem senha ainda)
  const handleLiberarSenhas = async () => {
    if (!motoboysSemSenha.length) {
      toast.info('Nenhum motoboy na unidade sem senha hoje.');
      return;
    }

    try {
      // Resolver unidade e franquia uma única vez
      let unidadeId = user?.unidadeId as string | undefined;
      let franquiaId: string | null = null;

      if (unidadeId) {
        const { data: unidadeRow, error } = await supabase
          .from('unidades')
          .select('id, franquia_id')
          .eq('id', unidadeId)
          .maybeSingle();

        if (error || !unidadeRow || !unidadeRow.franquia_id) {
          toast.error('Configuração da unidade não encontrada');
          return;
        }

        unidadeId = unidadeRow.id as string;
        franquiaId = unidadeRow.franquia_id as string;
      } else {
        const { data: unidadeRow, error } = await supabase
          .from('unidades')
          .select('id, franquia_id')
          .ilike('nome_loja', `%${selectedUnit as string}%`)
          .maybeSingle();

        if (error || !unidadeRow || !unidadeRow.franquia_id) {
          toast.error('Configuração da unidade não encontrada');
          return;
        }

        unidadeId = unidadeRow.id as string;
        franquiaId = unidadeRow.franquia_id as string;
      }

      // Respeita a ordem de chegada (fila_posicao já vem ordenada na API)
      for (const motoboy of motoboysSemSenha) {
        await gerarSenhaPagamento(unidadeId, franquiaId!, motoboy.id, motoboy.nome);
      }

      await queryClient.invalidateQueries({ queryKey: ['senhas-pagamento'] });
      toast.success('Senhas liberadas para motoboys na unidade');
    } catch (error) {
      console.error('Erro ao liberar senhas:', error);
      toast.error('Erro ao liberar senhas');
    }
  };

  // Chamar próxima senha (sempre a ÚLTIMA da fila, ignorando EM_ENTREGA)
  const handleChamarProximaSenha = () => {
    if (senhaAtual) {
      toast.info('Já existe uma senha chamada. Conclua o atendimento antes de chamar a próxima.');
      return;
    }

    // Percorre do fim para o início para pegar sempre a última senha aguardando
    for (let i = filaOrdenada.length - 1; i >= 0; i -= 1) {
      const senha = filaOrdenada[i];
      if (senha.status !== 'aguardando') continue;

      const entregador = senha.entregador_id
        ? entregadoresById.get(senha.entregador_id)
        : undefined;

      // Ignora motoboy EM_ENTREGA
      if (entregador && entregador.status === 'entregando') continue;

      chamarMutation.mutate(senha.id);
      return;
    }

    toast.info('Nenhuma senha disponível para chamada.');
  };

  if (!selectedUnit) {
    return (
      <Layout>
        <div className="p-8 text-center text-muted-foreground">
          Selecione uma unidade para continuar
        </div>
      </Layout>
    );
  }

   const loadingAcoes =
     atenderMutation.isPending ||
     chamarMutation.isPending ||
     marcarAusenteMutation.isPending ||
     enviarParaEntregaMutation.isPending ||
     voltarParaFilaMutation.isPending ||
     resetDailyMutation.isPending;

  const senhaAtualEntregador = senhaAtual?.entregador_id
    ? entregadoresById.get(senhaAtual.entregador_id)
    : undefined;

  const senhaAtualStatusLabel = senhaAtualEntregador?.status === 'entregando'
    ? 'EM_ENTREGA'
    : 'NA_UNIDADE';

  const filaInvertida = [...filaOrdenada].reverse();

  return (
    <Layout>
      <BackButton />

       {/* TOPO: ações principais */}
       <div className="mb-6 space-y-4">
         <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
           <div className="flex flex-wrap gap-3">
             <Button
               onClick={handleLiberarSenhas}
               disabled={loadingAcoes || !motoboysSemSenha.length}
               className="gap-2"
             >
               <ArrowDownCircle className="w-4 h-4" />
               Liberar senhas (motoboys na unidade)
             </Button>
 
             <Button
               variant="secondary"
               onClick={handleChamarProximaSenha}
               disabled={loadingAcoes || !filaOrdenada.length}
               className="gap-2"
             >
               <Ticket className="w-4 h-4" />
               Chamar próxima senha
             </Button>
 
             <Button
               variant="outline"
               onClick={() => resetDailyMutation.mutate()}
               disabled={loadingAcoes || resetDailyMutation.isPending}
               className="gap-2"
             >
               <RotateCcw className="w-4 h-4" />
               Reset diário (motoboys e histórico)
             </Button>
           </div>
 
           <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
             <div>
               <span className="block">Motoboys na unidade</span>
               <span className="font-mono text-lg">{motoboysNaUnidade.length}</span>
             </div>
             <div>
               <span className="block">Na fila de pagamento</span>
               <span className="font-mono text-lg">{filaOrdenada.length}</span>
             </div>
             <div>
               <span className="block">Pagos hoje</span>
               <span className="font-mono text-lg">{senhasPagas.length}</span>
             </div>
           </div>
         </div>

        {/* BLOCO CENTRAL: Senha atual + TV */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-4">
          <Card className="border-primary/40 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Senha atual</span>
                {senhaAtual && (
                  <Badge variant="outline" className="text-xs">
                    {senhaAtualStatusLabel}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Controle principal da chamada e pagamento. Toda ação aqui libera a próxima senha.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {senhaAtual ? (
                <>
                  <div className="text-center space-y-2">
                    <p className="text-5xl md:text-6xl font-mono font-bold text-primary">
                      {senhaAtual.numero_senha}
                    </p>
                    {senhaAtualEntregador?.nome && (
                      <p className="text-lg font-semibold">
                        {senhaAtualEntregador.nome}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Button
                      onClick={() => senhaAtual && atenderMutation.mutate(senhaAtual.id)}
                      disabled={loadingAcoes}
                      className="w-full gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Pagamento realizado
                    </Button>

                    <Button
                      variant="destructive"
                      onClick={() => senhaAtual && marcarAusenteMutation.mutate(senhaAtual)}
                      disabled={loadingAcoes}
                      className="w-full gap-2"
                    >
                      Ausente (voltar para fim)
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => senhaAtual && enviarParaEntregaMutation.mutate(senhaAtual)}
                      disabled={loadingAcoes}
                      className="w-full gap-2"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      Enviar para entrega
                    </Button>
                  </div>
                </>
              ) : (
                <div className="py-10 text-center text-muted-foreground">
                  Nenhuma senha chamada no momento. Use "Chamar próxima senha" para iniciar.
                </div>
              )}
            </CardContent>
          </Card>

          {/* BLOCO TV: espelhamento visual da senha atual */}
          <Card className="bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Tv className="w-4 h-4" />
                TV (espelhamento)
              </CardTitle>
              <CardDescription>
                Visual simplificado do que está sendo exibido na TV da unidade.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TvPaymentPreview
                franquiaId={user?.franquiaId ?? null}
                unidadeNome={selectedUnit as string}
                unidadeId={user?.unidadeId ?? null}
                unidadeSlug={selectedUnit as string}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* BLOCO FILA ATUAL */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Ticket className="w-5 h-5 text-amber-500" />
                Fila atual ({filaOrdenada.length})
              </h2>
            </div>

            {filaOrdenada.length === 0 ? (
              <div className="text-center py-10 bg-card border border-dashed border-border rounded-lg">
                <p className="text-muted-foreground">Nenhuma senha na fila no momento.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filaInvertida.map((senha) => {
                  const entregador = senha.entregador_id
                    ? entregadoresById.get(senha.entregador_id)
                    : undefined;

                  const emEntrega = entregador?.status === 'entregando';
                  const isAtual = senhaAtual && senha.id === senhaAtual.id;

                  return (
                    <div
                      key={senha.id}
                      className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${
                        emEntrega ? 'opacity-60' : ''
                      } ${isAtual ? 'border-primary bg-primary/5' : 'bg-card border-border'}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono font-semibold text-lg text-amber-500">
                          {senha.numero_senha}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {entregador?.nome || senha.entregador_nome || 'Motoboy sem vínculo'}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>{emEntrega ? 'EM_ENTREGA' : 'NA_UNIDADE'}</span>
                            {isAtual && <span className="uppercase tracking-wide">(Senha atual)</span>}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Botão para chamar senha individual */}
                        {senha.status === 'aguardando' && !emEntrega && !senhaAtual && (
                          <Button
                            size="sm"
                            variant="default"
                            disabled={loadingAcoes}
                            onClick={() => chamarMutation.mutate(senha.id)}
                            className="gap-1"
                          >
                            <Phone className="w-4 h-4" />
                            Chamar
                          </Button>
                        )}
                        
                        {emEntrega && senha.status === 'aguardando' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={loadingAcoes}
                            onClick={() => voltarParaFilaMutation.mutate(senha)}
                          >
                            Voltar para fila
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* BLOCO PAGOS HOJE (histórico informativo) */}
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Check className="w-5 h-5 text-blue-500" />
              Pagos hoje ({senhasPagas.length})
            </h2>
            {senhasPagas.length === 0 ? (
              <div className="text-center py-12 bg-card border border-dashed border-border rounded-lg">
                <Check className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhum pagamento concluído hoje</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {senhasPagas.map((senha) => (
                  <Card key={senha.id} className="bg-card border border-border rounded-lg p-4">
                    <div className="text-center space-y-2">
                      <p className="text-3xl font-bold font-mono text-blue-500">
                        {senha.numero_senha}
                      </p>
                      {senha.entregador_nome && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {senha.entregador_nome}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Horário:{' '}
                        {senha.atendido_em
                          ? new Date(senha.atendido_em).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '--:--'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Valor: —
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </Layout>
  );
}
