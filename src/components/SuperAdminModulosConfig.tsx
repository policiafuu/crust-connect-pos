import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Pencil, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Modulo {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  preco_mensal: number;
  ativo: boolean;
}

export function SuperAdminModulosConfig() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingModulo, setEditingModulo] = useState<Modulo | null>(null);
  const [form, setForm] = useState({
    codigo: '',
    nome: '',
    descricao: '',
    preco_mensal: '0',
    ativo: true,
  });

  const { data: modulos = [], isLoading } = useQuery<Modulo[]>({
    queryKey: ['modulos-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('modulos')
        .select('id, codigo, nome, descricao, preco_mensal, ativo')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as Modulo[];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const preco = Number(form.preco_mensal.replace(',', '.'));
      if (isNaN(preco) || preco < 0) throw new Error('Preço inválido');

      const payload = {
        codigo: form.codigo.trim(),
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        preco_mensal: preco,
        ativo: form.ativo,
      };

      if (!payload.codigo || !payload.nome) {
        throw new Error('Código e nome são obrigatórios');
      }

      if (editingModulo) {
        const { error } = await supabase.from('modulos').update(payload).eq('id', editingModulo.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('modulos').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Módulo salvo com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['modulos-admin'] });
      queryClient.invalidateQueries({ queryKey: ['modulos'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao salvar módulo');
    },
  });

  const resetForm = () => {
    setForm({
      codigo: '',
      nome: '',
      descricao: '',
      preco_mensal: '0',
      ativo: true,
    });
    setEditingModulo(null);
  };

  const openEditDialog = (modulo: Modulo) => {
    setEditingModulo(modulo);
    setForm({
      codigo: modulo.codigo,
      nome: modulo.nome,
      descricao: modulo.descricao || '',
      preco_mensal: String(modulo.preco_mensal),
      ativo: modulo.ativo,
    });
    setIsDialogOpen(true);
  };

  const openNewDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  return (
    <>
      <Card className="border-border">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-sm font-mono">Módulos opcionais</CardTitle>
            <CardDescription className="text-xs">
              Gerencie os módulos que as franquias podem ativar em suas configurações
            </CardDescription>
          </div>
          <Button size="sm" onClick={openNewDialog} className="gap-2">
            <Plus className="w-4 h-4" /> Novo módulo
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : modulos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum módulo cadastrado.</p>
          ) : (
            modulos.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between border border-border rounded-lg p-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{m.nome}</span>
                    {!m.ativo && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        Inativo
                      </span>
                    )}
                  </div>
                  {m.descricao && (
                    <p className="text-xs text-muted-foreground mt-1">{m.descricao}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Código: <code>{m.codigo}</code> • Valor: R$ {Number(m.preco_mensal).toFixed(2)}
                    /mês
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => openEditDialog(m)}
                  title="Editar módulo"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono">
              {editingModulo ? 'Editar módulo' : 'Novo módulo'}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              upsertMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Código do módulo</Label>
              <Input
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                placeholder="Ex: whatsapp_evolution"
                disabled={!!editingModulo}
              />
              <p className="text-[11px] text-muted-foreground">
                Identificador único (não pode ser alterado após criar)
              </p>
            </div>
            <div className="space-y-2">
              <Label>Nome do módulo</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: WhatsApp Evolution"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Breve descrição do que o módulo faz"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Preço mensal (R$)</Label>
              <Input
                type="text"
                value={form.preco_mensal}
                onChange={(e) => setForm({ ...form, preco_mensal: e.target.value })}
                placeholder="Ex: 29,90"
              />
              <p className="text-[11px] text-muted-foreground">
                Este valor será cobrado mensalmente quando a franquia ativar o módulo
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.ativo}
                onCheckedChange={(checked) => setForm({ ...form, ativo: checked })}
              />
              <Label className="text-sm cursor-pointer" onClick={() => setForm({ ...form, ativo: !form.ativo })}>
                Módulo ativo (disponível para franquias)
              </Label>
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={upsertMutation.isPending}
              >
                {upsertMutation.isPending && (
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
