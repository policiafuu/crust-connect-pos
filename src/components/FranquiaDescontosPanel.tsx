import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pencil, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Franquia {
  id: string;
  nome_franquia: string;
  config_pagamento: any | null;
}

interface PlanoResumo {
  id: string;
  nome: string;
  tipo: string;
  valor_base: number;
}

export function FranquiaDescontosPanel() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedFranquia, setSelectedFranquia] = useState<Franquia | null>(null);
  const [form, setForm] = useState({
    plano_id: '',
    aplicar_em: 'atual' as 'atual' | 'proxima',
  });

  const { data: planos = [], isLoading: isLoadingPlanos } = useQuery<PlanoResumo[]>({
    queryKey: ['planos-descontos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos')
        .select('id, nome, tipo, valor_base')
        .eq('ativo', true)
        .order('valor_base', { ascending: true });
      if (error) throw error;
      return data as PlanoResumo[];
    },
  });

  const { data: franquias = [], isLoading } = useQuery<Franquia[]>({
    queryKey: ['franquias-descontos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('franquias')
        .select('id, nome_franquia, config_pagamento')
        .order('nome_franquia', { ascending: true });
      if (error) throw error;
      return data as Franquia[];
    },
  });

  const updatePlanoMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFranquia) return;
      const planoSelecionado = planos.find((p) => p.id === form.plano_id);
      if (!planoSelecionado) throw new Error('Selecione um pacote/plano');

      const cfgAtual = (selectedFranquia.config_pagamento as any) || {};

      const novoConfig =
        form.aplicar_em === 'atual'
          ? {
              ...cfgAtual,
              plano_id: planoSelecionado.id,
              // Não grava mais valor_plano fixo: o valor da fatura sempre segue o plano vinculado
              valor_plano: null,
              next_plano_id: null,
              next_valor_plano: null,
            }
          : {
              ...cfgAtual,
              next_plano_id: planoSelecionado.id,
              next_valor_plano: Number(planoSelecionado.valor_base),
            };

      const { error } = await supabase
        .from('franquias')
        .update({
          config_pagamento: novoConfig,
          desconto_tipo: 'nenhum',
          desconto_valor: 0,
          desconto_percentual: 0,
          desconto_recorrente: false,
        })
        .eq('id', selectedFranquia.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pacote atualizado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['franquias-descontos'] });
      queryClient.invalidateQueries({ queryKey: ['franquia-financeiro'] });
      setIsDialogOpen(false);
      setSelectedFranquia(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao atualizar pacote');
    },
  });

  const openEditDialog = (franquia: Franquia) => {
    setSelectedFranquia(franquia);
    const cfg = (franquia.config_pagamento as any) || {};
    const planoAtualId = (cfg.next_plano_id as string) || (cfg.plano_id as string) || '';
    setForm({
      plano_id: planoAtualId,
      aplicar_em: 'atual',
    });
    setIsDialogOpen(true);
  };

  const getPlanoDisplay = (f: Franquia) => {
    const cfg = (f.config_pagamento as any) || {};
    const planoId = cfg.plano_id as string | undefined;
    const nextPlanoId = cfg.next_plano_id as string | undefined;

    const planoAtual = planos.find((p) => p.id === planoId);
    const planoProximo = planos.find((p) => p.id === nextPlanoId);

    if (!planoAtual && !planoProximo) return 'Sem pacote definido';

    if (planoAtual && !planoProximo) {
      return `${planoAtual.nome} • R$ ${Number(planoAtual.valor_base).toFixed(2)} (atual)`;
    }

    if (!planoAtual && planoProximo) {
      return `${planoProximo.nome} • R$ ${Number(planoProximo.valor_base).toFixed(2)} (próxima fatura)`;
    }

    return `${planoAtual?.nome} (atual) → ${planoProximo?.nome} (próxima fatura)`;
  };

  return (
    <>
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm font-mono">Pacotes por franquia</CardTitle>
          <CardDescription className="text-xs">
            Selecione qual pacote a franquia utiliza e se a troca vale para agora ou apenas para a
            próxima fatura.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading || isLoadingPlanos ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : franquias.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma franquia cadastrada.</p>
          ) : (
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Franquia</th>
                    <th className="px-4 py-2 text-left font-medium">Pacote atual / próximo</th>
                    <th className="px-4 py-2 text-center font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {franquias.map((f) => (
                    <tr key={f.id} className="border-t border-border/60">
                      <td className="px-4 py-2">{f.nome_franquia}</td>
                      <td className="px-4 py-2">
                        <span className="text-muted-foreground">
                          {getPlanoDisplay(f)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(f)}
                          title="Editar pacote"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono">
              Pacote para {selectedFranquia?.nome_franquia}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updatePlanoMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Pacote</Label>
              <Select
                value={form.plano_id}
                onValueChange={(v) => setForm({ ...form, plano_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o pacote" />
                </SelectTrigger>
                <SelectContent>
                  {planos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} • R$ {Number(p.valor_base).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Aplicar desconto</Label>
              <div className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
                <button
                  type="button"
                  className={`text-left rounded-md px-2 py-1 ${form.aplicar_em === 'atual' ? 'bg-primary/10 border border-primary/40' : ''}`}
                  onClick={() => setForm({ ...form, aplicar_em: 'atual' })}
                >
                  <span className="block font-medium">Na fatura atual</span>
                  <span className="text-[11px] text-muted-foreground">
                    Atualiza imediatamente o valor exibido para a franquia.
                  </span>
                </button>
                <button
                  type="button"
                  className={`text-left rounded-md px-2 py-1 ${form.aplicar_em === 'proxima' ? 'bg-primary/10 border border-primary/40' : ''}`}
                  onClick={() => setForm({ ...form, aplicar_em: 'proxima' })}
                >
                  <span className="block font-medium">Somente na próxima fatura</span>
                  <span className="text-[11px] text-muted-foreground">
                    Mostra para a franquia qual será o valor da próxima fatura, sem mudar a
                    cobrança atual.
                  </span>
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setIsDialogOpen(false);
                  setSelectedFranquia(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={updatePlanoMutation.isPending}
              >
                {updatePlanoMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

