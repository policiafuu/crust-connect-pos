import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Download, Upload, Loader2, Database, Users, FileText, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

const EXPORT_TABLES = [
  { key: 'franquias', label: 'Franquias', icon: Database },
  { key: 'unidades', label: 'Unidades (Lojas)', icon: Database },
  { key: 'entregadores', label: 'Entregadores', icon: Users },
  { key: 'historico_entregas', label: 'Histórico de Entregas', icon: FileText },
  { key: 'system_users', label: 'Usuários do Sistema', icon: Users },
  { key: 'user_unidades', label: 'Vínculos Usuário-Unidade', icon: Users },
  { key: 'planos', label: 'Planos', icon: Database },
  { key: 'unidade_planos', label: 'Planos por Unidade', icon: Database },
  { key: 'franquia_bag_tipos', label: 'Tipos de Bag (Franquia)', icon: Database },
  { key: 'unidade_bag_tipos', label: 'Tipos de Bag (Unidade)', icon: Database },
  { key: 'global_config', label: 'Configurações Globais', icon: Database },
  { key: 'system_config', label: 'Configurações do Sistema', icon: Database },
  { key: 'logs_auditoria', label: 'Logs de Auditoria', icon: FileText },
] as const;

function arrayToCsv(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
      // Escape CSV
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

function downloadCsv(filename: string, csvContent: string) {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const SCHEMA_SQL = `-- ============================================
-- SCHEMA COMPLETO DO SISTEMA FILALAB
-- Gerado automaticamente para migração
-- ============================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum de papéis
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'app_role' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END;
$$;

-- Função utilitária para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Tabela: franquias
CREATE TABLE IF NOT EXISTS public.franquias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_franquia TEXT NOT NULL,
  slug TEXT NOT NULL,
  cpf_cnpj TEXT,
  email TEXT,
  telefone TEXT,
  config_pagamento JSONB NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  data_vencimento DATE NULL,
  horario_reset TIME WITHOUT TIME ZONE DEFAULT '03:00:00',
  plano_limite_lojas INTEGER DEFAULT 1,
  status_pagamento TEXT DEFAULT 'ativo',
  desconto_tipo TEXT DEFAULT 'nenhum',
  desconto_valor NUMERIC DEFAULT 0,
  desconto_percentual NUMERIC DEFAULT 0,
  desconto_recorrente BOOLEAN DEFAULT false
);

-- Tabela: unidades
CREATE TABLE IF NOT EXISTS public.unidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franquia_id UUID NOT NULL REFERENCES public.franquias(id) ON DELETE CASCADE,
  nome_loja TEXT NOT NULL,
  config_whatsapp JSONB NULL,
  config_sheets_url TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: entregadores
CREATE TABLE IF NOT EXISTS public.entregadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  unidade TEXT NOT NULL,
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
  franquia_id UUID REFERENCES public.franquias(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'disponivel',
  tipo_bag TEXT DEFAULT 'normal',
  ativo BOOLEAN NOT NULL DEFAULT true,
  fila_posicao TIMESTAMPTZ DEFAULT now(),
  turno_inicio TIME WITHOUT TIME ZONE DEFAULT '16:00:00',
  turno_fim TIME WITHOUT TIME ZONE DEFAULT '02:00:00',
  usar_turno_padrao BOOLEAN DEFAULT true,
  dias_trabalho JSONB DEFAULT '{"dom":true,"seg":true,"ter":true,"qua":true,"qui":true,"sex":true,"sab":true}',
  hora_saida TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela: historico_entregas
CREATE TABLE IF NOT EXISTS public.historico_entregas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entregador_id UUID NOT NULL REFERENCES public.entregadores(id) ON DELETE CASCADE,
  franquia_id UUID REFERENCES public.franquias(id) ON DELETE SET NULL,
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
  unidade TEXT NOT NULL,
  tipo_bag TEXT DEFAULT 'normal',
  hora_saida TIMESTAMPTZ NOT NULL DEFAULT now(),
  hora_retorno TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela: global_config
CREATE TABLE IF NOT EXISTS public.global_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT NOT NULL,
  config_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: system_config
CREATE TABLE IF NOT EXISTS public.system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade TEXT NOT NULL,
  webhook_url TEXT NULL,
  nome_loja TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: planos
CREATE TABLE IF NOT EXISTS public.planos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  descricao TEXT NULL,
  valor_base NUMERIC NOT NULL,
  duracao_meses INTEGER NOT NULL DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela: unidade_planos
CREATE TABLE IF NOT EXISTS public.unidade_planos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id UUID NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  plano_id UUID NOT NULL REFERENCES public.planos(id) ON DELETE CASCADE,
  valor NUMERIC NOT NULL,
  desconto_percent NUMERIC NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela: franquia_bag_tipos
CREATE TABLE IF NOT EXISTS public.franquia_bag_tipos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franquia_id UUID NOT NULL REFERENCES public.franquias(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela: unidade_bag_tipos
CREATE TABLE IF NOT EXISTS public.unidade_bag_tipos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id UUID NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  bag_tipo_id UUID NOT NULL REFERENCES public.franquia_bag_tipos(id) ON DELETE CASCADE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela: logs_auditoria
CREATE TABLE IF NOT EXISTS public.logs_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franquia_id UUID REFERENCES public.franquias(id) ON DELETE SET NULL,
  usuario_email TEXT NULL,
  acao TEXT NULL,
  detalhes JSONB NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: system_users
CREATE TABLE IF NOT EXISTS public.system_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'user',
  unidade TEXT NOT NULL DEFAULT 'ITAQUA',
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
  franquia_id UUID REFERENCES public.franquias(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: user_unidades
CREATE TABLE IF NOT EXISTS public.user_unidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.system_users(id) ON DELETE CASCADE,
  unidade_id UUID NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

export function DataExportImport() {
  const [exportingTable, setExportingTable] = useState<string | null>(null);
  const [exportingAll, setExportingAll] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleExportTable = async (tableKey: string, label: string) => {
    setExportingTable(tableKey);
    try {
      const { data, error } = await (supabase.from(tableKey as any).select('*') as any);
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.info(`Tabela "${label}" está vazia.`);
        return;
      }
      const csv = arrayToCsv(data);
      downloadCsv(`${tableKey}_export.csv`, csv);
      toast.success(`${label} exportado com sucesso (${data.length} registros)`);
    } catch (err: any) {
      toast.error(`Erro ao exportar ${label}: ${err.message}`);
    } finally {
      setExportingTable(null);
    }
  };

  const handleExportAll = async () => {
    setExportingAll(true);
    let totalRecords = 0;
    try {
      for (const table of EXPORT_TABLES) {
        const { data, error } = await (supabase.from(table.key as any).select('*') as any);
        if (error) {
          console.error(`Erro ao exportar ${table.key}:`, error);
          continue;
        }
        if (data && data.length > 0) {
          const csv = arrayToCsv(data);
          downloadCsv(`${table.key}_export.csv`, csv);
          totalRecords += data.length;
        }
      }
      toast.success(`Exportação completa! ${totalRecords} registros exportados.`);
    } catch (err: any) {
      toast.error(`Erro na exportação: ${err.message}`);
    } finally {
      setExportingAll(false);
    }
  };

  const handleCopySQL = async () => {
    try {
      await navigator.clipboard.writeText(SCHEMA_SQL);
      setCopied(true);
      toast.success('SQL copiado para a área de transferência!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar. Selecione o texto manualmente.');
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="export" className="space-y-4">
        <TabsList>
          <TabsTrigger value="export" className="gap-2">
            <Download className="w-4 h-4" /> Exportar CSV
          </TabsTrigger>
          <TabsTrigger value="import" className="gap-2">
            <Upload className="w-4 h-4" /> Migrar SQL
          </TabsTrigger>
        </TabsList>

        {/* Export Tab */}
        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base font-mono">Exportar Dados em CSV</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Exporte os dados de cada tabela do sistema individualmente ou tudo de uma vez.
                </p>
              </div>
              <Button
                onClick={handleExportAll}
                disabled={exportingAll}
                className="gap-2"
              >
                {exportingAll ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Exportar Tudo
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {EXPORT_TABLES.map((table) => {
                  const Icon = table.icon;
                  const isExporting = exportingTable === table.key;
                  return (
                    <Button
                      key={table.key}
                      variant="outline"
                      className="justify-start gap-3 h-auto py-3 px-4"
                      disabled={isExporting || exportingAll}
                      onClick={() => handleExportTable(table.key, table.label)}
                    >
                      {isExporting ? (
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      ) : (
                        <Icon className="w-4 h-4 shrink-0" />
                      )}
                      <div className="text-left">
                        <p className="text-sm font-medium">{table.label}</p>
                        <p className="text-xs text-muted-foreground font-mono">{table.key}</p>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Import/Migration Tab */}
        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base font-mono">SQL de Migração das Tabelas</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Copie o SQL abaixo e execute no editor SQL do seu novo projeto para recriar toda a estrutura de tabelas.
                </p>
              </div>
              <Button onClick={handleCopySQL} variant="outline" className="gap-2">
                {copied ? (
                  <>
                    <Check className="w-4 h-4" /> Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> Copiar SQL
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Textarea
                  readOnly
                  value={SCHEMA_SQL}
                  className="font-mono text-xs min-h-[400px] bg-muted/30 resize-y"
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
              </div>
              <Separator className="my-4" />
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">📋 Instruções de migração:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Copie o SQL acima clicando no botão "Copiar SQL"</li>
                  <li>Abra o editor SQL do seu novo projeto (Cloud View → Run SQL)</li>
                  <li>Cole o SQL e execute</li>
                  <li>Exporte os dados em CSV usando a aba "Exportar CSV"</li>
                  <li>Importe os CSVs no novo banco de dados</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
