# Pasta de Áudios dos Motoboys

Esta pasta documenta a estrutura de armazenamento dos áudios gerados para os motoboys.

**IMPORTANTE**: Os áudios NÃO são armazenados no repositório Git. Eles são armazenados no Supabase Storage (bucket: `motoboy_voices`).

## Estrutura no Supabase Storage

```
motoboy_voices/
├── {franquia_id}/
│   ├── {motoboy_id}.mp3      # Áudio personalizado do nome do motoboy
│   ├── bags/
│   │   ├── {bag_id}.mp3      # Áudio para cada tipo de bag
│   │   └── ...
│   └── bebida.mp3            # Áudio de alerta de bebida
└── ...
```

## Como Funciona

1. **Geração de Vozes**: Na página de Configuração, você pode gerar vozes personalizadas usando ElevenLabs TTS
2. **Armazenamento**: Os áudios são salvos automaticamente no Supabase Storage
3. **Uso na TV**: Os áudios são reproduzidos automaticamente quando um motoboy é chamado

## Backup e Download

Para fazer backup dos áudios:

1. Acesse a página de Configuração
2. Na aba "Motoboys", ao editar um motoboy com voz gerada, clique em "⬇️ Baixar"
3. Para backup em massa, use a API do Supabase Storage

## Gerenciamento

- **Gerar Vozes Motoboys**: Gera áudios para todos os motoboys sem voz
- **Gerar Áudios Bags/Bebida**: Gera áudios para tipos de bag e alerta de bebida
- **Limpar vozes**: Remove TODOS os áudios da franquia (motoboys + bags)
- **Limpar áudios bags**: Remove apenas áudios de bags, mantendo os dos motoboys
