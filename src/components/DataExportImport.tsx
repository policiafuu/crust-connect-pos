import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Upload, Loader2, Database } from 'lucide-react';
import { toast } from 'sonner';

const TABLES = [
  'franquias',
  'unidades',
  'system_users',
  'user_unidades',
  'entregadores',
  'historico_entregas',
  'planos',
  'unidade_planos',
  'modulos',
  'unidade_modulos',
  'pacotes_comerciais',
  'franquia_bag_tipos',
  'unidade_bag_tipos',
  'franquia_cobrancas',
  'api_keys',
  'whatsapp_templates',
  'senhas_pagamento',
  'global_config',
  'system_config',
  'logs_auditoria',
  'auth_refresh_tokens',
] as const;

export function DataExportImport() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [sqlInput, setSqlInput] = useState('');
  const [exportResult, setExportResult] = useState('');

  const handleExportAll = async () => {
    setExporting(true);
    try {
      const allData: Record<string, any[]> = {};

      for (const table of TABLES) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .limit(10000);
          if (error) {
            console.error(`Erro ao exportar ${table}:`, error);
            allData[table] = [];
          } else {
            allData[table] = data || [];
          }
        } catch {
          allData[table] = [];
        }
      }

      // Gerar SQL de INSERT para cada tabela
      let sql = `-- Exportação completa do FilaLab\n-- Data: ${new Date().toISOString()}\n\n`;

      for (const [table, rows] of Object.entries(allData)) {
        if (rows.length === 0) {
          sql += `-- ${table}: sem dados\n\n`;
          continue;
        }

        sql += `-- ${table}: ${rows.length} registros\n`;

        for (const row of rows) {
          const columns = Object.keys(row);
          const values = columns.map((col) => {
            const val = row[col];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'boolean') return val ? 'true' : 'false';
            if (typeof val === 'number') return String(val);
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
            return `'${String(val).replace(/'/g, "''")}'`;
          });
          sql += `INSERT INTO public.${table} (${columns.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;\n`;
        }
        sql += '\n';
      }

      setExportResult(sql);

      // Download automático
      const blob = new Blob([sql], { type: 'text/sql' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `filalab_export_${new Date().toISOString().slice(0, 10)}.sql`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`Exportação completa! ${Object.values(allData).reduce((a, b) => a + b.length, 0)} registros exportados.`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao exportar dados');
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      for (const table of TABLES) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .limit(10000);
          if (error || !data || data.length === 0) continue;

          const headers = Object.keys(data[0]);
          const csvRows = [headers.join(',')];
          for (const row of data) {
            csvRows.push(
              headers
                .map((h) => {
                  const val = row[h];
                  if (val === null || val === undefined) return '';
                  const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
                  return `"${str.replace(/"/g, '""')}"`;
                })
                .join(','),
            );
          }

          const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${table}_export.csv`;
          a.click();
          URL.revokeObjectURL(url);
        } catch {
          // skip
        }
      }

      toast.success('CSVs exportados com sucesso!');
    } catch {
      toast.error('Erro ao exportar CSVs');
    } finally {
      setExporting(false);
    }
  };

  const handleImportSQL = async () => {
    if (!sqlInput.trim()) {
      toast.error('Cole o SQL antes de importar');
      return;
    }

    if (!confirm('Tem certeza que deseja executar este SQL? Isso pode modificar dados do banco.')) return;

    setImporting(true);
    try {
      // Split SQL by semicolons and execute each statement
      const statements = sqlInput
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--'));

      let success = 0;
      let errors = 0;

      for (const stmt of statements) {
        try {
          // Execute via direct insert/update - for import we use the Supabase client
          // Since we can't run arbitrary SQL from client, we use the REST API approach
          // The user should use the Supabase SQL Editor for complex imports
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/execute_sql`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: JSON.stringify({ sql_text: stmt + ';' }),
            }
          );
          if (!response.ok) {
            errors++;
          } else {
            success++;
          }
        } catch {
          errors++;
        }
      }

      toast.success(`Importação concluída: ${success} comandos executados, ${errors} erros`);
    } catch {
      toast.error('Erro ao importar SQL');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="w-5 h-5" />
          Exportar / Importar Dados
        </CardTitle>
        <CardDescription>
          Exporte todas as tabelas do banco de dados ou importe via SQL. Disponível apenas para super admin.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="export" className="space-y-4">
          <TabsList>
            <TabsTrigger value="export">Exportar</TabsTrigger>
            <TabsTrigger value="import">Importar SQL</TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Exporta todas as {TABLES.length} tabelas do sistema: usuários, motoboys, franquias, planos, histórico, configurações, áudios, etc.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleExportAll} disabled={exporting} className="gap-2">
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Exportar tudo (SQL)
              </Button>
              <Button onClick={handleExportCSV} disabled={exporting} variant="outline" className="gap-2">
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Exportar CSVs individuais
              </Button>
            </div>

            {exportResult && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Preview do SQL exportado (primeiros 2000 chars):</p>
                <Textarea
                  readOnly
                  value={exportResult.slice(0, 2000) + (exportResult.length > 2000 ? '\n\n... (truncado)' : '')}
                  className="font-mono text-xs h-48 resize-none"
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cole comandos SQL (INSERT, UPDATE, DELETE) para importar dados. Use com cuidado.
            </p>
            <Textarea
              value={sqlInput}
              onChange={(e) => setSqlInput(e.target.value)}
              placeholder="Cole seus comandos SQL aqui..."
              className="font-mono text-xs h-64 resize-none"
            />
            <Button onClick={handleImportSQL} disabled={importing} variant="destructive" className="gap-2">
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Executar SQL
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
