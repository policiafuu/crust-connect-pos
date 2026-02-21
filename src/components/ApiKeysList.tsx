import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';

interface ApiKeysListProps {
  ownerType: 'franquia' | 'unidade';
  ownerId: string;
}

export function ApiKeysList({ ownerType, ownerId }: ApiKeysListProps) {
  const { data: apiKeys = [], refetch } = useQuery({
    queryKey: ['api-keys', ownerType, ownerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('api_keys')
        .select('id, descricao, ativo, created_at, revoked_at')
        .eq('owner_type', ownerType)
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as {
        id: string;
        descricao: string | null;
        ativo: boolean;
        created_at: string;
        revoked_at: string | null;
      }[];
    },
    enabled: !!ownerId,
  });

  const handleRevoke = async (id: string) => {
    const { error } = await supabase
      .from('api_keys')
      .update({ ativo: false, revoked_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      console.error(error);
      return;
    }
    await refetch();
  };

  if (!ownerId) {
    return null;
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-sm font-mono">Chaves existentes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {apiKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma API Key cadastrada para este dono.</p>
        ) : (
          <div className="space-y-2">
            {apiKeys.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2 text-xs md:text-sm"
              >
                <div className="space-y-1">
                  <p className="font-mono text-[11px] md:text-xs">
                    Criada em {new Date(k.created_at).toLocaleString('pt-BR')}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {k.descricao || 'Sem descrição'}
                  </p>
                  <p className="text-[11px]">
                    Status:{' '}
                    <span className={k.ativo ? 'text-emerald-500' : 'text-muted-foreground'}>
                      {k.ativo ? 'Ativa' : 'Revogada'}
                    </span>
                  </p>
                  {k.revoked_at && (
                    <p className="text-[11px] text-muted-foreground">
                      Revogada em {new Date(k.revoked_at).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
                {k.ativo && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleRevoke(k.id)}
                  >
                    Revogar
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        <Separator className="mt-2" />
        <p className="text-[11px] text-muted-foreground">
          As API Keys são usadas apenas no backend e nunca são exibidas ou armazenadas em texto puro.
        </p>
      </CardContent>
    </Card>
  );
}
