import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Pizza, Loader2, ArrowLeft, Info } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Plan {
  id: string;
  nome: string;
  descricao: string | null;
  preco_total: number;
  valor_base: number;
  plano_id: string | null;
}

// Definir módulos de cada plano
const PLAN_MODULES = {
  'Pacote Básico': [
    '✓ Gestão de fila de entregadores',
    '✓ Controle de check-in/check-out',
    '✓ Tela de TV básica',
    '✓ Sistema de senhas de pagamento',
    '✓ Histórico de entregas',
    '✓ 1 loja incluída'
  ],
  'Pacote Planilha + WhatsApp': [
    '✓ Tudo do Básico',
    '✓ Integração com Google Sheets',
    '✓ WhatsApp Avançado com templates',
    '✓ Notificações automáticas',
    '✓ Até 3 lojas'
  ],
  'Pacote Completo': [
    '✓ Tudo dos planos anteriores',
    '✓ TV Premium com animações',
    '✓ Relatórios avançados',
    '✓ Suporte prioritário',
    '✓ Lojas ilimitadas',
    '✓ Customizações exclusivas'
  ]
};

export default function Register() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  
  const [formData, setFormData] = useState({
    nomeEmpresa: '',
    cpfCnpj: '',
    email: '',
    telefone: '',
    nomeFranquia: '',
    nomeLoja: '',
    planoId: '',
    username: '',
    password: '',
    confirmPassword: '',
  });

  // Buscar planos disponíveis (pacotes comerciais vinculados a planos)
  useState(() => {
    const fetchPlans = async () => {
      const { data, error } = await supabase
        .from('pacotes_comerciais')
        .select('id, nome, descricao, preco_total, plano_id, ativo')
        .eq('ativo', true)
        .order('preco_total', { ascending: true });

      if (error) {
        toast.error('Erro ao carregar planos');
        console.error('Error fetching plans:', error);
      } else {
        const pacotes = (data || []) as { id: string; nome: string; descricao: string | null; preco_total: number; plano_id: string | null }[];
        setPlans(pacotes.map((p) => ({ ...p, valor_base: p.preco_total })));
      }
      setLoadingPlans(false);
    };

    fetchPlans();
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getPlanModules = (planName: string): string[] => {
    return PLAN_MODULES[planName as keyof typeof PLAN_MODULES] || [];
  };

  const validateForm = () => {
    if (!formData.nomeEmpresa.trim()) {
      toast.error('Nome da empresa é obrigatório');
      return false;
    }
    if (!formData.cpfCnpj.trim()) {
      toast.error('CPF/CNPJ é obrigatório');
      return false;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      toast.error('Email válido é obrigatório');
      return false;
    }
    if (!formData.telefone.trim()) {
      toast.error('Telefone é obrigatório');
      return false;
    }
    if (!formData.nomeFranquia.trim()) {
      toast.error('Nome da franquia é obrigatório');
      return false;
    }
    if (!formData.nomeLoja.trim()) {
      toast.error('Nome da loja é obrigatório');
      return false;
    }
    if (!formData.planoId) {
      toast.error('Selecione um plano');
      return false;
    }
    if (!formData.username.trim() || formData.username.length < 3) {
      toast.error('Usuário deve ter pelo menos 3 caracteres');
      return false;
    }
    if (!formData.password.trim() || formData.password.length < 6) {
      toast.error('Senha deve ter pelo menos 6 caracteres');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('As senhas não coincidem');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('register-franchise', {
        body: {
          nomeEmpresa: formData.nomeEmpresa,
          cpfCnpj: formData.cpfCnpj,
          email: formData.email,
          telefone: formData.telefone,
          nomeFranquia: formData.nomeFranquia,
          nomeLoja: formData.nomeLoja,
          pacoteId: formData.planoId,
          username: formData.username,
          password: formData.password,
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Cadastro realizado com sucesso! Faça login para continuar.');
        navigate('/login');
      } else {
        toast.error(data?.error || 'Erro ao realizar cadastro');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || 'Erro ao realizar cadastro');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-primary mx-auto mb-4 flex items-center justify-center">
            <Pizza className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold font-mono">FilaLab</h1>
          <p className="text-muted-foreground mt-2">Registre-se e comece seu trial de 7 dias</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Criar nova conta</CardTitle>
            <CardDescription>
              Preencha os dados abaixo para começar a usar o FilaLab gratuitamente por 7 dias
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nomeEmpresa">Nome da Empresa</Label>
                  <Input
                    id="nomeEmpresa"
                    value={formData.nomeEmpresa}
                    onChange={(e) => handleChange('nomeEmpresa', e.target.value)}
                    placeholder="Ex: Pizzaria Dom João"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cpfCnpj">CPF ou CNPJ</Label>
                  <Input
                    id="cpfCnpj"
                    value={formData.cpfCnpj}
                    onChange={(e) => handleChange('cpfCnpj', e.target.value)}
                    placeholder="000.000.000-00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="contato@empresa.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) => handleChange('telefone', e.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nomeFranquia">Nome da Franquia</Label>
                  <Input
                    id="nomeFranquia"
                    value={formData.nomeFranquia}
                    onChange={(e) => handleChange('nomeFranquia', e.target.value)}
                    placeholder="Ex: Pizzaria SP"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nomeLoja">Nome da Loja</Label>
                  <Input
                    id="nomeLoja"
                    value={formData.nomeLoja}
                    onChange={(e) => handleChange('nomeLoja', e.target.value)}
                    placeholder="Ex: Loja Centro"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Usuário de acesso</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => handleChange('username', e.target.value)}
                    placeholder="usuario"
                    autoComplete="username"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    placeholder="••••••"
                    autoComplete="new-password"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleChange('confirmPassword', e.target.value)}
                    placeholder="••••••"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Escolha seu plano</Label>
                {loadingPlans ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <RadioGroup value={formData.planoId} onValueChange={(value) => handleChange('planoId', value)}>
                    {plans.map((plan) => {
                      const modules = getPlanModules(plan.nome);
                      return (
                        <div key={plan.id} className="flex items-start space-x-3 border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                          <RadioGroupItem value={plan.id} id={plan.id} className="mt-1" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Label htmlFor={plan.id} className="font-semibold cursor-pointer">
                                {plan.nome}
                              </Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-4 h-4 text-primary cursor-help hover:text-primary/80 transition-colors" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs">
                                    <div className="space-y-1">
                                      <p className="font-semibold mb-2">{plan.nome}</p>
                                      {modules.map((module, idx) => (
                                        <p key={idx} className="text-xs">{module}</p>
                                      ))}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <p className="text-sm font-semibold text-primary mt-1">
                              {formatCurrency(plan.valor_base)}/mês após o trial
                            </p>
                            <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                              {modules.slice(0, 3).map((module, idx) => (
                                <p key={idx}>{module}</p>
                              ))}
                              {modules.length > 3 && (
                                <p className="text-primary font-medium">+ {modules.length - 3} recursos</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </RadioGroup>
                )}
              </div>

              <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                <p className="font-semibold mb-2">⚠️ Informações importantes:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li><strong>7 dias</strong> de trial gratuito</li>
                  <li>Acesso completo a todos os recursos do plano escolhido</li>
                  <li>Após 7 dias, inicia período de inadimplência se não pagar</li>
                  <li><strong className="text-destructive">14 dias após inadimplência, todos os dados serão deletados permanentemente</strong></li>
                </ul>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/login')}
                  className="flex-1"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </Button>
                <Button type="submit" disabled={isLoading} className="flex-1">
                  {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Criar conta
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Já tem uma conta?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  );
}
