import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUnit } from '@/contexts/UnitContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Layout, BackButton } from '@/components/Layout';
import { EntregadorCard } from '@/components/EntregadorCard';
import { UsersManagement } from '@/components/UsersManagement';
import { WebhookConfig } from '@/components/WebhookConfig';
import { WhatsAppTemplates } from '@/components/WhatsAppTemplates';
import { BulkMotoboyImport } from '@/components/BulkMotoboyImport';
import { TVCallConfigModal } from '@/components/TVCallConfigModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ModulosConfig } from '@/components/ModulosConfig';
import { FranquiaFinanceiroPanel } from '@/components/FranquiaFinanceiroPanel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  fetchEntregadores,
  createEntregador,
  updateEntregador,
  deleteEntregador,
  resetDaily,
  Entregador,
  Unidade,
  DiasTrabalho,
  TURNO_PADRAO,
} from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Users, Loader2, LogOut, Filter, RotateCcw } from 'lucide-react';
import { Navigate, useSearchParams } from 'react-router-dom';

const DIAS_SEMANA = [
  { key: 'seg', label: 'Segunda' },
  { key: 'ter', label: 'Terça' },
  { key: 'qua', label: 'Quarta' },
  { key: 'qui', label: 'Quinta' },
  { key: 'sex', label: 'Sexta' },
  { key: 'sab', label: 'Sábado' },
  { key: 'dom', label: 'Domingo' },
] as const;

const DEFAULT_DIAS_TRABALHO: DiasTrabalho = {
  dom: true,
  seg: true,
  ter: true,
  qua: true,
  qui: true,
  sex: true,
  sab: true,
};

export default function Config() {
  const { selectedUnit } = useUnit();
  const { logout, user } = useAuth();
  const queryClient = useQueryClient();
  const cancelVoicesRef = useRef(false);

  const [searchParams] = useSearchParams();
  const isPaymentBlocked = searchParams.get('bloqueio') === '1';
  const isFranquiaAdmin = user?.role === 'admin_franquia';
  const initialTab = isPaymentBlocked && isFranquiaAdmin ? 'financeiro' : 'motoboys';
  const [paymentBlockedOpen, setPaymentBlockedOpen] = useState(isPaymentBlocked && isFranquiaAdmin);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEntregador, setEditingEntregador] = useState<Entregador | null>(null);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [isGeneratingAllVoices, setIsGeneratingAllVoices] = useState(false);
  const [voicesProgress, setVoicesProgress] = useState<{ current: number; total: number } | null>(null);
  const [showAudioPreview, setShowAudioPreview] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [tvCallConfigOpen, setTvCallConfigOpen] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    unidade: selectedUnit || ('ITAQUA' as Unidade),
    dias_trabalho: DEFAULT_DIAS_TRABALHO,
    usar_turno_padrao: true,
    turno_inicio: TURNO_PADRAO.inicio.slice(0, 5),
    turno_fim: TURNO_PADRAO.fim.slice(0, 5),
  });

  // Filtros
  const [filterStatus, setFilterStatus] = useState<'all' | 'ativo' | 'inativo'>('all');
  const [filterTurno, setFilterTurno] = useState<'all' | 'padrao' | 'custom'>('all');

  // Redirect se não houver unidade selecionada, exceto quando o acesso estiver bloqueado
  // e o admin de franquia precisa entrar apenas no Financeiro
  if (!selectedUnit && !(isPaymentBlocked && isFranquiaAdmin)) {
    return <Navigate to="/" replace />;
  }

  // Query for fetching entregadores
  const { data: entregadores = [], isLoading } = useQuery({
    queryKey: ['entregadores', selectedUnit],
    queryFn: () => fetchEntregadores({ unidade: selectedUnit }),
  });

  // Configuração da franquia (para reaproveitar tv_tts / ElevenLabs)
  const { data: franquiaConfig } = useQuery<{ config_pagamento: any | null }>({
    queryKey: ['franquia-config-tv', user?.franquiaId],
    queryFn: async () => {
      if (!user?.franquiaId) return { config_pagamento: null };
      const { data, error } = await supabase
        .from('franquias')
        .select('config_pagamento')
        .eq('id', user.franquiaId)
        .maybeSingle();
      if (error) throw error;
      return (data as any) || { config_pagamento: null };
    },
    enabled: !!user?.franquiaId,
  });

  // Buscar bags da franquia
  const { data: franquiaBagTipos = [] } = useQuery<{
    id: string;
    nome: string;
    descricao: string | null;
    ativo: boolean;
    franquia_id: string;
  }[]>({
    queryKey: ['franquia-bag-tipos', user?.franquiaId],
    queryFn: async () => {
      if (!user?.franquiaId) return [];
      const { data, error } = await supabase
        .from('franquia_bag_tipos')
        .select('id, nome, descricao, ativo, franquia_id')
        .eq('franquia_id', user.franquiaId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as any;
    },
    enabled: !!user?.franquiaId,
  });

  // Query para verificar áudios de bags/bebida gerados
  const { data: generatedAudios, refetch: refetchAudios } = useQuery({
    queryKey: ['generated-audios', user?.franquiaId],
    queryFn: async () => {
      if (!user?.franquiaId) return { bags: [], bebida: false };
      
      const { data: files } = await supabase.storage
        .from('motoboy_voices')
        .list(`${user.franquiaId}/bags`);
      
      const { data: bebidaFile } = await supabase.storage
        .from('motoboy_voices')
        .list(user.franquiaId, { search: 'bebida.mp3' });
      
      return {
        bags: files || [],
        bebida: (bebidaFile && bebidaFile.length > 0) || false,
      };
    },
    enabled: !!user?.franquiaId,
  });

  // Filtrar entregadores
  const filteredEntregadores = entregadores.filter((e) => {
    if (filterStatus === 'ativo' && !e.ativo) return false;
    if (filterStatus === 'inativo' && e.ativo) return false;
    if (filterTurno === 'padrao' && e.usar_turno_padrao === false) return false;
    if (filterTurno === 'custom' && e.usar_turno_padrao !== false) return false;
    return true;
  });

  // Mutation for creating entregador
  const createMutation = useMutation({
    mutationFn: createEntregador,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entregadores'] });
      toast.success('Entregador cadastrado com sucesso!');
      resetForm();
    },
    onError: () => {
      toast.error('Erro ao cadastrar entregador');
    },
  });

  // Mutation for updating entregador
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Entregador> }) =>
      updateEntregador(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entregadores'] });
      toast.success('Entregador atualizado!');
      resetForm();
    },
    onError: () => {
      toast.error('Erro ao atualizar entregador');
    },
  });

  // Mutation for deleting entregador
  const deleteMutation = useMutation({
    mutationFn: deleteEntregador,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entregadores'] });
      toast.success('Entregador removido!');
    },
    onError: () => {
      toast.error('Erro ao remover entregador');
    },
  });

  const resetDailyMutation = useMutation({
    mutationFn: () => resetDaily(selectedUnit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entregadores'] });
      queryClient.invalidateQueries({ queryKey: ['saidas-dia'] });
      setResetDialogOpen(false);
      toast.success('Reset diário executado para esta unidade: motoboys desativados e histórico limpo.');
    },
    onError: () => {
      toast.error('Erro ao executar reset diário. Tente novamente.');
    },
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      telefone: '',
      unidade: selectedUnit,
      dias_trabalho: DEFAULT_DIAS_TRABALHO,
      usar_turno_padrao: true,
      turno_inicio: TURNO_PADRAO.inicio.slice(0, 5),
      turno_fim: TURNO_PADRAO.fim.slice(0, 5),
    });
    setEditingEntregador(null);
    setIsFormOpen(false);
    setIsGeneratingVoice(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome.trim() || !formData.telefone.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }

    const turnoInicio = formData.turno_inicio + ':00';
    const turnoFim = formData.turno_fim + ':00';

    if (editingEntregador) {
      updateMutation.mutate({
        id: editingEntregador.id,
        data: {
          nome: formData.nome,
          telefone: formData.telefone,
          dias_trabalho: formData.dias_trabalho,
          usar_turno_padrao: formData.usar_turno_padrao,
          turno_inicio: turnoInicio,
          turno_fim: turnoFim,
        },
      });
    } else {
      createMutation.mutate({
        nome: formData.nome,
        telefone: formData.telefone,
        unidade: formData.unidade,
        status: 'disponivel',
        ativo: true,
        dias_trabalho: formData.dias_trabalho,
        usar_turno_padrao: formData.usar_turno_padrao,
        turno_inicio: turnoInicio,
        turno_fim: turnoFim,
      });
    }
  };

  const handleEdit = (entregador: Entregador) => {
    setEditingEntregador(entregador);
    setFormData({
      nome: entregador.nome,
      telefone: entregador.telefone,
      unidade: entregador.unidade,
      dias_trabalho: entregador.dias_trabalho || DEFAULT_DIAS_TRABALHO,
      usar_turno_padrao: entregador.usar_turno_padrao !== false,
      turno_inicio: entregador.turno_inicio?.slice(0, 5) || TURNO_PADRAO.inicio.slice(0, 5),
      turno_fim: entregador.turno_fim?.slice(0, 5) || TURNO_PADRAO.fim.slice(0, 5),
    });
    setIsGeneratingVoice(false);
    setIsFormOpen(true);
  };

  const handleToggleAtivo = (entregador: Entregador) => {
    const updateData: Partial<Entregador> = { ativo: !entregador.ativo };
    
    if (!entregador.ativo) {
      updateData.fila_posicao = new Date().toISOString();
    }
    
    updateMutation.mutate({
      id: entregador.id,
      data: updateData,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este entregador?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleDiaChange = (dia: keyof DiasTrabalho, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      dias_trabalho: {
        ...prev.dias_trabalho,
        [dia]: checked,
      },
    }));
  };

  const activeCount = entregadores.filter((e) => e.ativo).length;

  const handleGenerateBagVoices = async () => {
    if (!user?.franquiaId) {
      toast.error('É necessário estar vinculado a uma franquia.');
      return;
    }

    const tvTts = (franquiaConfig?.config_pagamento as any)?.tv_tts;
    const elevenVoiceId = tvTts?.eleven_voice_id as string | undefined;

    if (!tvTts || tvTts.voice_model !== 'elevenlabs' || !elevenVoiceId) {
      toast.error('Configure o ElevenLabs antes de gerar os áudios.');
      return;
    }

    const bagsAtivas = franquiaBagTipos.filter((b) => b.ativo);
    if (bagsAtivas.length === 0) {
      toast.info('Nenhum tipo de bag ativo encontrado.');
      return;
    }

    setIsGeneratingAllVoices(true);
    let sucesso = 0;
    let falhas = 0;

    try {
      // Gerar áudio para cada bag
      for (const bag of bagsAtivas) {
        try {
          const texto = `Pegue a bag ${bag.nome}`;
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: JSON.stringify({
                text: texto,
                voiceId: elevenVoiceId,
                franquiaId: user.franquiaId,
              }),
            },
          );

          if (!response.ok) {
            falhas++;
            continue;
          }

          const audioBlob = await response.blob();
          const path = `${user.franquiaId}/bags/${bag.id}.mp3`;

          const { error: uploadError } = await supabase.storage
            .from('motoboy_voices')
            .upload(path, audioBlob, { upsert: true, contentType: 'audio/mpeg' });

          if (uploadError) {
            falhas++;
            continue;
          }

          sucesso++;
          await new Promise((resolve) => setTimeout(resolve, 3000));
        } catch (e) {
          console.error('Erro ao gerar áudio da bag:', bag.id, e);
          falhas++;
        }
      }

      // Gerar áudio de bebida
      try {
        const textoBebida = 'Atenção! O pedido possui refrigerante!';
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              text: textoBebida,
              voiceId: elevenVoiceId,
              franquiaId: user.franquiaId,
            }),
          },
        );

        if (response.ok) {
          const audioBlob = await response.blob();
          const path = `${user.franquiaId}/bebida.mp3`;
          await supabase.storage
            .from('motoboy_voices')
            .upload(path, audioBlob, { upsert: true, contentType: 'audio/mpeg' });
          sucesso++;
        }
      } catch (e) {
        console.error('Erro ao gerar áudio de bebida:', e);
      }

      if (sucesso > 0) {
        toast.success(`${sucesso} áudios de bags/bebida gerados com sucesso!${falhas ? ` Falhas: ${falhas}` : ''}`);
      } else {
        toast.error('Não foi possível gerar os áudios.');
      }
    } finally {
      setIsGeneratingAllVoices(false);
      refetchAudios();
    }
  };

  const handleClearBagAudios = async () => {
    if (!user?.franquiaId) {
      toast.error('É necessário estar vinculado a uma franquia.');
      return;
    }

    const confirmClear = window.confirm(
      'Tem certeza que deseja remover apenas os áudios das bags? Os áudios dos motoboys serão mantidos.',
    );

    if (!confirmClear) return;

    try {
      // Deletar pasta de bags
      const { data: bagFiles } = await supabase.storage
        .from('motoboy_voices')
        .list(`${user.franquiaId}/bags`);

      if (bagFiles && bagFiles.length > 0) {
        const filesToRemove = bagFiles.map((f) => `${user.franquiaId}/bags/${f.name}`);
        await supabase.storage.from('motoboy_voices').remove(filesToRemove);
      }

      // Deletar áudio de bebida
      await supabase.storage
        .from('motoboy_voices')
        .remove([`${user.franquiaId}/bebida.mp3`]);

      refetchAudios();
      toast.success('Áudios das bags removidos com sucesso!');
    } catch (error) {
      console.error('Erro ao limpar áudios das bags:', error);
      toast.error('Erro ao limpar áudios das bags.');
    }
  };

  const handleGenerateAllVoices = async () => {
    if (!user?.franquiaId) {
      toast.error('É necessário estar vinculado a uma franquia para gerar vozes.');
      return;
    }

    const tvTts = (franquiaConfig?.config_pagamento as any)?.tv_tts;
    const elevenVoiceId = tvTts?.eleven_voice_id as string | undefined;

    if (!tvTts || tvTts.voice_model !== 'elevenlabs' || !elevenVoiceId) {
      toast.error('Configure o ElevenLabs na aba Módulos (voz da TV) antes de gerar as vozes.');
      return;
    }

    const semVoz = entregadores.filter((e) => !e.tts_voice_path);

    if (semVoz.length === 0) {
      toast.info('Todos os motoboys desta unidade já possuem voz gerada.');
      return;
    }

    setIsGeneratingAllVoices(true);
    setVoicesProgress({ current: 0, total: semVoz.length });
    cancelVoicesRef.current = false;
    let sucesso = 0;
    let falhas = 0;
    let cancelado = false;

    try {
      for (let index = 0; index < semVoz.length; index++) {
        const motoboy = semVoz[index];

        if (cancelVoicesRef.current) {
          cancelado = true;
          break;
        }

        setVoicesProgress({ current: index + 1, total: semVoz.length });

        try {
          const texto = `${motoboy.nome}, é a sua vez!`;

          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: JSON.stringify({
                text: texto,
                voiceId: elevenVoiceId,
                franquiaId: user.franquiaId,
                sequenceIndex: index,
              }),
            },
          );

          if (!response.ok) {
            const errText = await response.text();
            console.error('Erro ElevenLabs ao gerar voz fixa (lote):', errText);
            falhas++;
            continue;
          }

          const audioBlob = await response.blob();
          const path = `${user.franquiaId}/${motoboy.id}.mp3`;

          const { error: uploadError } = await supabase.storage
            .from('motoboy_voices')
            .upload(path, audioBlob, {
              upsert: true,
              contentType: 'audio/mpeg',
            });

          if (uploadError) {
            console.error('Erro ao salvar MP3 no storage (lote):', uploadError);
            falhas++;
            continue;
          }

          await updateEntregador(motoboy.id, { tts_voice_path: path });
          sucesso++;

          // Delay entre cada geração para evitar bloqueios na API da ElevenLabs
          await new Promise((resolve) => setTimeout(resolve, 10000));
        } catch (e) {
          console.error('Erro ao gerar voz fixa em lote para motoboy:', motoboy.id, e);
          falhas++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['entregadores'] });

      if (cancelado) {
        toast.info(`Geração de vozes cancelada. Sucesso em ${sucesso}, falhas em ${falhas}.`);
      } else if (sucesso > 0) {
        toast.success(`Vozes geradas com sucesso para ${sucesso} motoboys.${falhas ? ` Falhas em ${falhas}.` : ''}`);
      } else {
        toast.error('Não foi possível gerar voz para nenhum motoboy.');
      }
    } finally {
      setIsGeneratingAllVoices(false);
      setVoicesProgress(null);
    }
  };

  const handleClearAllVoices = async () => {
    if (!user?.franquiaId) {
      toast.error('É necessário estar vinculado a uma franquia para limpar as vozes.');
      return;
    }

    const confirmClear = window.confirm(
      'Tem certeza que deseja remover todos os áudios gerados desta franquia? Isso não pode ser desfeito.',
    );

    if (!confirmClear) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clear-motoboy-voices`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ franquiaId: user.franquiaId }),
        },
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error('Erro ao limpar vozes da franquia:', errText);
        toast.error('Erro ao limpar as vozes. Tente novamente.');
        return;
      }

      // Garantir que o campo tts_voice_path seja limpo também pelo frontend
      const { error: updateError } = await supabase
        .from('entregadores')
        .update({ tts_voice_path: null })
        .like('tts_voice_path', `${user.franquiaId}/%`);

      if (updateError) {
        console.error('Erro ao limpar tts_voice_path via frontend:', updateError);
      }

      await queryClient.invalidateQueries({ queryKey: ['entregadores'] });
      refetchAudios();
      toast.success('Todas as vozes dos motoboys desta franquia foram removidas.');
    } catch (error) {
      console.error('Erro inesperado ao limpar vozes:', error);
      toast.error('Erro inesperado ao limpar as vozes.');
    }
  };

  return (
    <Layout>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <BackButton />
        <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-4 sm:ml-auto">
          <span className="text-xs sm:text-sm text-muted-foreground">
            Logado como: <strong>{user?.username}</strong>
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={logout}
            className="gap-2 w-full sm:w-auto justify-center"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </Button>
        </div>
      </div>

      <div className="mb-6 space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold font-mono">Configuração</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Gerencie os entregadores e configurações da unidade{' '}
          <span className="font-semibold text-foreground">{selectedUnit}</span>
        </p>
      </div>

      {isPaymentBlocked && isFranquiaAdmin && (
        <Dialog open={paymentBlockedOpen} onOpenChange={setPaymentBlockedOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-mono text-lg">Franquia bloqueada por pagamento</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Seu acesso ao sistema está temporariamente restrito devido à pendência de pagamento.
              Use a aba <span className="font-semibold">Financeiro</span> para regularizar a situação e
              liberar novamente todas as funcionalidades.
            </p>
          </DialogContent>
        </Dialog>
      )}

      <Tabs defaultValue={initialTab} className="space-y-6">
        <TabsList
          className={`w-full flex gap-1 overflow-x-auto rounded-lg bg-muted/40 p-1 border border-border
            ${user?.role === 'admin_franquia' ? 'sm:grid sm:grid-cols-5 sm:w-auto' : 'sm:grid sm:grid-cols-4 sm:w-auto'}`}
        >
          <TabsTrigger value="motoboys" className="whitespace-nowrap text-xs sm:text-sm px-3 py-1.5">
            Motoboys
          </TabsTrigger>
          <TabsTrigger value="usuarios" className="whitespace-nowrap text-xs sm:text-sm px-3 py-1.5">
            Usuários
          </TabsTrigger>
          <TabsTrigger value="modulos" className="whitespace-nowrap text-xs sm:text-sm px-3 py-1.5">
            Módulos
          </TabsTrigger>
          <TabsTrigger value="webhook" className="whitespace-nowrap text-xs sm:text-sm px-3 py-1.5">
            Integrações &amp; WhatsApp
          </TabsTrigger>
          {user?.role === 'admin_franquia' && (
            <TabsTrigger value="financeiro" className="whitespace-nowrap text-xs sm:text-sm px-3 py-1.5">
              Financeiro
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="motoboys" className="space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              {/* Filtros */}
              <div className="flex flex-wrap items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select
                  value={filterStatus}
                  onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="z-50">
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="ativo">Ativos</SelectItem>
                    <SelectItem value="inativo">Inativos</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filterTurno}
                  onValueChange={(v) => setFilterTurno(v as typeof filterTurno)}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Turno" />
                  </SelectTrigger>
                  <SelectContent className="z-50">
                    <SelectItem value="all">Todos turnos</SelectItem>
                    <SelectItem value="padrao">Turno padrão</SelectItem>
                    <SelectItem value="custom">Turno custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-3 md:items-end md:gap-4">
              <div className="flex flex-wrap items-center gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateAllVoices}
                  disabled={isGeneratingAllVoices}
                  className="gap-2 text-xs sm:text-sm"
                >
                  {isGeneratingAllVoices ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {voicesProgress
                        ? `Gerando voz ${voicesProgress.current} de ${voicesProgress.total}`
                        : 'Gerando Vozes...'}
                    </>
                  ) : (
                    'Gerar Vozes Motoboys'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateBagVoices}
                  disabled={isGeneratingAllVoices}
                  className="gap-2 text-xs sm:text-sm"
                >
                  Gerar Áudios Bags/Bebida
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClearAllVoices}
                  disabled={isGeneratingAllVoices}
                  className="gap-2 text-xs sm:text-sm"
                >
                  Limpar vozes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClearBagAudios}
                  disabled={isGeneratingAllVoices}
                  className="gap-2 text-xs sm:text-sm"
                >
                  Limpar áudios bags
                </Button>
                {/* Importar áudio de bag */}
                <div className="relative">
                  <input
                    type="file"
                    accept="audio/mpeg,audio/mp3"
                    multiple
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    onChange={async (e) => {
                      const files = e.target.files;
                      if (!files || !user?.franquiaId) return;
                      let ok = 0;
                      for (const file of Array.from(files)) {
                        // Match filename to bag by name
                        const matchBag = franquiaBagTipos.find(
                          (b) => file.name.toLowerCase().includes(b.nome.toLowerCase()) ||
                                 file.name.replace('.mp3', '') === b.id
                        );
                        const bagId = matchBag?.id || file.name.replace('.mp3', '');
                        const path = `${user.franquiaId}/bags/${bagId}.mp3`;
                        const { error } = await supabase.storage
                          .from('motoboy_voices')
                          .upload(path, file, { upsert: true, contentType: 'audio/mpeg' });
                        if (!error) ok++;
                      }
                      refetchAudios();
                      toast.success(`${ok} áudios de bag importados!`);
                      e.target.value = '';
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 text-xs sm:text-sm pointer-events-none"
                  >
                    Importar Áudios Bags
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setResetDialogOpen(true)}
                  className="gap-2 text-xs sm:text-sm"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset Diário
                </Button>
                {isGeneratingAllVoices && (voicesProgress ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      cancelVoicesRef.current = true;
                    }}
                    className="gap-1 text-[11px]"
                  >
                    Cancelar
                  </Button>
                ) : null)}
              </div>
              {isGeneratingAllVoices && voicesProgress && (
                <div className="flex items-center gap-2 w-full max-w-xs md:max-w-sm ml-auto">
                  <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width: `${(voicesProgress.current / voicesProgress.total) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {voicesProgress.current}/{voicesProgress.total}
                  </span>
                </div>
              )}

              {/* Preview de áudios de bags/bebida */}
              {generatedAudios && (generatedAudios.bags.length > 0 || generatedAudios.bebida) && (
                <div className="mb-2 md:mb-0 w-full">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAudioPreview(!showAudioPreview)}
                    className="gap-2 text-xs w-full justify-between md:w-auto md:justify-start"
                  >
                    <span>{showAudioPreview ? '▼' : '▶'} Áudios Gerados</span>
                    <span className="text-[11px] text-muted-foreground">
                      ({generatedAudios.bags.length} bags
                      {generatedAudios.bebida ? ' + bebida' : ''})
                    </span>
                  </Button>

                  {showAudioPreview && (
                    <div className="mt-3 p-3 md:p-4 border rounded-lg bg-card space-y-3 text-xs">
                      {/* Bags */}
                      {generatedAudios.bags.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2 text-muted-foreground">
                            Bags ({generatedAudios.bags.length})
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {generatedAudios.bags.map((file: any) => {
                              const bagId = file.name.replace('.mp3', '');
                              const bag = franquiaBagTipos.find((b) => b.id === bagId);

                              return (
                                <Button
                                  key={file.name}
                                  variant="outline"
                                  size="sm"
                                  className="text-[11px] gap-1"
                                  onClick={async () => {
                                    try {
                                      const { data } = await supabase.storage
                                        .from('motoboy_voices')
                                        .download(`${user?.franquiaId}/bags/${file.name}`);
                                      if (data) {
                                        const url = URL.createObjectURL(data);
                                        const audio = new Audio(url);
                                        await audio.play();
                                        audio.onended = () => URL.revokeObjectURL(url);
                                      }
                                    } catch (e) {
                                      toast.error('Erro ao reproduzir áudio');
                                    }
                                  }}
                                >
                                  ▶️ {bag?.nome || bagId}
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Bebida */}
                      {generatedAudios.bebida && (
                        <div>
                          <h4 className="font-semibold mb-2 text-muted-foreground">Bebida</h4>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-[11px] gap-1"
                            onClick={async () => {
                              try {
                                const { data } = await supabase.storage
                                  .from('motoboy_voices')
                                  .download(`${user?.franquiaId}/bebida.mp3`);
                                if (data) {
                                  const url = URL.createObjectURL(data);
                                  const audio = new Audio(url);
                                  await audio.play();
                                  audio.onended = () => URL.revokeObjectURL(url);
                                }
                              } catch (e) {
                                toast.error('Erro ao reproduzir áudio');
                              }
                            }}
                          >
                            ▶️ Aviso de bebida
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={() => setIsFormOpen(true)}
                className="gap-2 w-full md:w-auto justify-center"
              >
                <Plus className="w-4 h-4" />
                Novo Motoboy
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total cadastrados</p>
                  <p className="text-2xl font-bold font-mono">{entregadores.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-status-available/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-status-available" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ativos</p>
                  <p className="text-2xl font-bold font-mono">{activeCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              <BulkMotoboyImport unidade={selectedUnit as Unidade} />
              {filteredEntregadores.length === 0 ? (
                <div className="text-center py-20 bg-card border border-dashed border-border rounded-lg">
                  <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-4">
                    {entregadores.length === 0
                      ? 'Nenhum entregador cadastrado nesta unidade'
                      : 'Nenhum entregador encontrado com os filtros aplicados'}
                  </p>
                  <Button onClick={() => setIsFormOpen(true)} variant="outline">
                    Cadastrar motoboy
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredEntregadores.map((entregador) => (
                    <EntregadorCard
                      key={entregador.id}
                      entregador={entregador}
                      onEdit={() => handleEdit(entregador)}
                      onDelete={() => handleDelete(entregador.id)}
                      onToggleAtivo={() => handleToggleAtivo(entregador)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="usuarios">
          <UsersManagement />
        </TabsContent>

        <TabsContent value="modulos">
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Configurações do Módulo TV</h3>
                <p className="text-sm text-muted-foreground">Personalize as chamadas exibidas na tela da TV</p>
              </div>
              <Button
                variant="outline"
                onClick={() => setTvCallConfigOpen(true)}
                className="gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="2" y="7" width="20" height="10" rx="2" strokeWidth="2" />
                  <path d="M17 17v3M7 17v3M12 13h.01" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Configurar Chamadas da TV
              </Button>
            </div>
            {/* Apenas visual: módulos ativos da franquia, incluindo Extra de Animação na TV */}
            <ModulosConfig />
          </div>
        </TabsContent>

        <TabsContent value="webhook">
          <div className="space-y-6">
            <WebhookConfig />
            <WhatsAppTemplates />
          </div>
        </TabsContent>

        {user?.role === 'admin_franquia' && (
          <TabsContent value="financeiro" className="space-y-4">
            <FranquiaFinanceiroPanel />
          </TabsContent>
        )}
      </Tabs>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono">
              {editingEntregador ? 'Editar Motoboy' : 'Novo Motoboy'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, nome: e.target.value }))
                }
                placeholder="Nome do motoboy"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Celular (com DDD)</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, telefone: e.target.value }))
                }
                placeholder="11999999999"
              />
            </div>

            {!editingEntregador && user?.role === 'super_admin' && (
              <div className="space-y-2">
                <Label htmlFor="unidade">Unidade</Label>
                <Select
                  value={formData.unidade}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, unidade: value as Unidade }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ITAQUA">Itaquaquecetuba</SelectItem>
                    <SelectItem value="POA">Poá</SelectItem>
                    <SelectItem value="SUZANO">Suzano</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Dias de Trabalho */}
            <div className="space-y-3">
              <Label>Dias de Trabalho</Label>
              <div className="grid grid-cols-2 gap-2">
                {DIAS_SEMANA.map((dia) => (
                  <div key={dia.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`dia-${dia.key}`}
                      checked={formData.dias_trabalho[dia.key]}
                      onCheckedChange={(checked) =>
                        handleDiaChange(dia.key, checked as boolean)
                      }
                    />
                    <Label
                      htmlFor={`dia-${dia.key}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {dia.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Turno */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Turno</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="turno-padrao"
                    checked={formData.usar_turno_padrao}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, usar_turno_padrao: checked }))
                    }
                  />
                  <Label htmlFor="turno-padrao" className="text-sm font-normal cursor-pointer">
                    Turno padrão (16:00 - 02:00)
                  </Label>
                </div>
              </div>

              {!formData.usar_turno_padrao && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-secondary/50 rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="turno-inicio">Início</Label>
                    <Input
                      id="turno-inicio"
                      type="time"
                      value={formData.turno_inicio}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, turno_inicio: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="turno-fim">Fim</Label>
                    <Input
                      id="turno-fim"
                      type="time"
                      value={formData.turno_fim}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, turno_fim: e.target.value }))
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            {/* WhatsApp toggle por motoboy */}
            {editingEntregador && (
              <div className="flex items-center justify-between border border-border rounded-lg p-4">
                <div>
                  <Label>Mensagens WhatsApp</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Se desativado, este motoboy não receberá mensagens via WhatsApp.
                  </p>
                </div>
                <Switch
                  checked={editingEntregador.whatsapp_ativo !== false}
                  onCheckedChange={(checked) => {
                    updateMutation.mutate({
                      id: editingEntregador.id,
                      data: { whatsapp_ativo: checked },
                    });
                    setEditingEntregador({ ...editingEntregador, whatsapp_ativo: checked });
                  }}
                />
              </div>
            )}

            {/* Importar áudio próprio do motoboy */}
            {editingEntregador && (
              <div className="space-y-3 border border-border rounded-lg p-4 bg-secondary/40">
                <Label>Importar áudio próprio</Label>
                <p className="text-xs text-muted-foreground">
                  Envie um arquivo MP3 personalizado para usar como chamada deste motoboy na TV.
                </p>
                <Input
                  type="file"
                  accept="audio/mpeg,audio/mp3"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !user?.franquiaId || !editingEntregador) return;
                    try {
                      const path = `${user.franquiaId}/${editingEntregador.id}.mp3`;
                      const { error: uploadError } = await supabase.storage
                        .from('motoboy_voices')
                        .upload(path, file, { upsert: true, contentType: 'audio/mpeg' });
                      if (uploadError) throw uploadError;
                      const updated = await updateEntregador(editingEntregador.id, { tts_voice_path: path });
                      setEditingEntregador(updated);
                      queryClient.invalidateQueries({ queryKey: ['entregadores'] });
                      toast.success('Áudio importado com sucesso!');
                    } catch (err) {
                      toast.error('Erro ao importar áudio');
                    }
                  }}
                />
              </div>
            )}

            {/* Voz fixa ElevenLabs por motoboy */}
            {editingEntregador && (
              <div className="space-y-3 border border-border rounded-lg p-4 bg-secondary/40">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Label>Voz personalizada (ElevenLabs)</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Gera um MP3 fixo com o nome deste motoboy usando seus créditos ElevenLabs.
                      Depois a TV usa sempre esse arquivo, sem gastar créditos de novo.
                    </p>
                  </div>
                  {editingEntregador.tts_voice_path && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        Voz já gerada
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={async () => {
                          try {
                            const { data } = await supabase.storage
                              .from('motoboy_voices')
                              .download(editingEntregador.tts_voice_path!);
                            
                            if (data) {
                              const audioUrl = URL.createObjectURL(data);
                              const audio = new Audio(audioUrl);
                              await audio.play();
                              audio.onended = () => URL.revokeObjectURL(audioUrl);
                            }
                          } catch (e) {
                            toast.error('Erro ao reproduzir áudio');
                          }
                        }}
                      >
                        ▶️ Ouvir
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={async () => {
                          try {
                            const { data } = await supabase.storage
                              .from('motoboy_voices')
                              .download(editingEntregador.tts_voice_path!);
                            
                            if (data) {
                              const url = URL.createObjectURL(data);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `voz_${editingEntregador.nome.replace(/\s/g, '_')}.mp3`;
                              a.click();
                              URL.revokeObjectURL(url);
                              toast.success('Áudio baixado!');
                            }
                          } catch (e) {
                            toast.error('Erro ao baixar áudio');
                          }
                        }}
                      >
                        ⬇️ Baixar
                      </Button>
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="mt-2"
                  disabled={isGeneratingVoice || !user?.franquiaId}
                  onClick={async () => {
                    if (!editingEntregador || !user?.franquiaId) return;

                    const tvTts = (franquiaConfig?.config_pagamento as any)?.tv_tts;
                    const elevenVoiceId = tvTts?.eleven_voice_id as string | undefined;

                    if (!tvTts || tvTts.voice_model !== 'elevenlabs' || !elevenVoiceId) {
                      toast.error('Configure o ElevenLabs na aba Módulos (voz da TV) antes de gerar.');
                      return;
                    }

                    try {
                      setIsGeneratingVoice(true);
                      const texto = `${editingEntregador.nome}, é a sua vez!`;

                      const response = await fetch(
                        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
                        {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                          },
                          body: JSON.stringify({
                            text: texto,
                            voiceId: elevenVoiceId,
                            franquiaId: user.franquiaId,
                          }),
                        },
                      );

                      if (!response.ok) {
                        const errText = await response.text();
                        console.error('Erro ElevenLabs ao gerar voz fixa:', errText);
                        toast.error('Erro ao gerar voz. O sistema tentou com todas as chaves configuradas.');
                        return;
                      }

                      const audioBlob = await response.blob();
                      const path = `${user.franquiaId}/${editingEntregador.id}.mp3`;

                      const { error: uploadError } = await supabase.storage
                        .from('motoboy_voices')
                        .upload(path, audioBlob, {
                          upsert: true,
                          contentType: 'audio/mpeg',
                        });

                      if (uploadError) {
                        console.error('Erro ao salvar MP3 no storage:', uploadError);
                        toast.error('Erro ao salvar o arquivo de voz.');
                        return;
                      }

                      const updated = await updateEntregador(editingEntregador.id, {
                        tts_voice_path: path,
                      });

                      setEditingEntregador(updated);
                      queryClient.invalidateQueries({ queryKey: ['entregadores'] });
                      toast.success('Voz personalizada gerada e salva com sucesso!');
                    } catch (e) {
                      console.error('Erro ao gerar voz fixa do motoboy:', e);
                      toast.error('Erro inesperado ao gerar a voz do motoboy.');
                    } finally {
                      setIsGeneratingVoice(false);
                    }
                  }}
                >
                  {isGeneratingVoice ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Gerando voz...
                    </>
                  ) : (
                    '🔊 Gerar voz personalizada (ElevenLabs)'
                  )}
                </Button>
              </div>
            )}


            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editingEntregador ? 'Salvar' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Diário Confirmation Dialog */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Reset Diário</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá desativar todos os motoboys e limpar o histórico de entregas do dia.
              Tem certeza que deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resetDailyMutation.mutate()}
              disabled={resetDailyMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {resetDailyMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Resetando...
                </>
              ) : (
                'Confirmar Reset'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de configuração de chamadas da TV */}
      <TVCallConfigModal
        open={tvCallConfigOpen}
        onOpenChange={setTvCallConfigOpen}
      />
    </Layout>
  );
}
