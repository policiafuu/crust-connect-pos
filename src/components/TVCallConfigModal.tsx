import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { updateGlobalConfig, fetchGlobalConfig } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Tv } from 'lucide-react';

const GLOBAL_PASSWORD = 'SupAdmin3031';

interface TVCallConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TVCallConfigModal({ open, onOpenChange }: TVCallConfigModalProps) {
  const queryClient = useQueryClient();
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const [entregaTitulo, setEntregaTitulo] = useState('ENTREGA CHAMADA');
  const [pagamentoTitulo, setPagamentoTitulo] = useState('PAGAMENTO CHAMADO');

  const { data: entregaTituloData } = useQuery({
    queryKey: ['global-config', 'tv_entrega_titulo'],
    queryFn: () => fetchGlobalConfig('tv_entrega_titulo'),
  });

  const { data: pagamentoTituloData } = useQuery({
    queryKey: ['global-config', 'tv_pagamento_titulo'],
    queryFn: () => fetchGlobalConfig('tv_pagamento_titulo'),
  });

  useEffect(() => {
    if (entregaTituloData) setEntregaTitulo(entregaTituloData);
  }, [entregaTituloData]);

  useEffect(() => {
    if (pagamentoTituloData) setPagamentoTitulo(pagamentoTituloData);
  }, [pagamentoTituloData]);

  useEffect(() => {
    if (open) {
      setPassword('');
      setIsAuthenticated(false);
    }
  }, [open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await updateGlobalConfig('tv_entrega_titulo', entregaTitulo);
      await updateGlobalConfig('tv_pagamento_titulo', pagamentoTitulo);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-config'] });
      toast.success('Configurações da TV atualizadas com sucesso!');
      onOpenChange(false);
    },
    onError: () => {
      toast.error('Erro ao atualizar configurações da TV');
    },
  });

  const handleAuthenticate = () => {
    if (password === GLOBAL_PASSWORD) {
      setIsAuthenticated(true);
    } else {
      toast.error('Senha incorreta');
    }
  };

  const handleSave = () => {
    if (!entregaTitulo.trim() || !pagamentoTitulo.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }
    saveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono">
            <Tv className="w-5 h-5" />
            Configuração de Chamadas na TV
          </DialogTitle>
        </DialogHeader>

        {!isAuthenticated ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tv-config-password">Senha de SUPERADMIN</Label>
              <Input
                id="tv-config-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite a senha de administrador"
                onKeyDown={(e) => e.key === 'Enter' && handleAuthenticate()}
              />
              <p className="text-sm text-muted-foreground">
                Apenas SUPERADMIN pode alterar as configurações visuais da TV.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAuthenticate}>
                Autenticar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="entrega-titulo">Título da Chamada de Entrega</Label>
              <Input
                id="entrega-titulo"
                value={entregaTitulo}
                onChange={(e) => setEntregaTitulo(e.target.value)}
                placeholder="ENTREGA CHAMADA"
              />
              <p className="text-sm text-muted-foreground">
                Texto que aparece quando um motoboy é chamado para entrega.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pagamento-titulo">Título da Chamada de Pagamento</Label>
              <Input
                id="pagamento-titulo"
                value={pagamentoTitulo}
                onChange={(e) => setPagamentoTitulo(e.target.value)}
                placeholder="PAGAMENTO CHAMADO"
              />
              <p className="text-sm text-muted-foreground">
                Texto que aparece quando um motoboy é chamado para receber pagamento.
              </p>
            </div>

            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-semibold mb-2">Preview:</p>
              <p className="text-sky-400 font-bold mb-1">🎒 {entregaTitulo}</p>
              <p className="text-emerald-400 font-bold">💵 {pagamentoTitulo}</p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Salvar Configurações
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
