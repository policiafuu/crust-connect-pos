# 05_apis_backend_vps.md

Este documento lista **todas as APIs** que precisam ser implementadas no backend da VPS para substituir as Edge Functions do Supabase/Lovable Cloud.

> 📋 Use este documento como checklist para garantir que todo o backend foi migrado corretamente.

---

## 1. Autenticação (substitui Supabase Auth)

### 1.1. POST `/api/auth/login`

**Substitui**: Supabase Auth (sign in with password)

**Descrição**: Autentica o usuário e retorna um token JWT.

**Body**:
```json
{
  "username": "expitaqua",
  "password": "1324"
}
```

**Response**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "username": "expitaqua",
    "role": "user",
    "unidade_id": "uuid",
    "franquia_id": "uuid"
  }
}
```

**Lógica**:
1. Buscar usuário na tabela `system_users` por `username`
2. Comparar senha com `bcrypt.compare(password, user.password_hash)`
3. Gerar token JWT com `jwt.sign({ id, username, role }, JWT_SECRET, { expiresIn: '7d' })`
4. Retornar token e dados do usuário

---

### 1.2. GET `/api/auth/me`

**Substitui**: Supabase Auth (get user)

**Descrição**: Retorna os dados do usuário autenticado.

**Headers**:
```
Authorization: Bearer <token>
```

**Response**:
```json
{
  "id": "uuid",
  "username": "expitaqua",
  "role": "user",
  "unidade_id": "uuid",
  "franquia_id": "uuid"
}
```

**Lógica**:
1. Validar token JWT com `jwt.verify(token, JWT_SECRET)`
2. Buscar usuário na tabela `system_users` por `id`
3. Retornar dados do usuário

---

### 1.3. POST `/api/auth/register` (opcional)

**Descrição**: Cria um novo usuário.

**Body**:
```json
{
  "username": "novousuario",
  "password": "senha123",
  "role": "user",
  "unidade_id": "uuid",
  "franquia_id": "uuid"
}
```

**Response**:
```json
{
  "id": "uuid",
  "username": "novousuario",
  "role": "user"
}
```

**Lógica**:
1. Hash da senha com `bcrypt.hash(password, 10)`
2. Inserir novo usuário na tabela `system_users`
3. Retornar dados do usuário criado

---

## 2. Entregadores (CRUD básico)

### 2.1. GET `/api/entregadores`

**Substitui**: `supabase.from('entregadores').select('*')`

**Descrição**: Lista todos os entregadores ativos.

**Query Params** (opcionais):
- `unidade_id`: filtrar por unidade
- `franquia_id`: filtrar por franquia
- `status`: filtrar por status (disponivel, em_entrega, ausente)

**Response**:
```json
[
  {
    "id": "uuid",
    "nome": "João Silva",
    "telefone": "11999999999",
    "status": "disponivel",
    "unidade": "ITAQUA",
    "unidade_id": "uuid",
    "franquia_id": "uuid",
    "tipo_bag": "normal",
    "fila_posicao": "2025-12-31T10:00:00Z",
    "ativo": true,
    "created_at": "2025-12-31T09:00:00Z"
  }
]
```

---

### 2.2. GET `/api/entregadores/:id`

**Substitui**: `supabase.from('entregadores').select('*').eq('id', id).single()`

**Descrição**: Retorna um entregador específico.

**Response**:
```json
{
  "id": "uuid",
  "nome": "João Silva",
  "telefone": "11999999999",
  "status": "disponivel",
  "unidade": "ITAQUA",
  "unidade_id": "uuid",
  "franquia_id": "uuid",
  "tipo_bag": "normal",
  "fila_posicao": "2025-12-31T10:00:00Z",
  "ativo": true,
  "created_at": "2025-12-31T09:00:00Z"
}
```

---

### 2.3. POST `/api/entregadores`

**Substitui**: `supabase.from('entregadores').insert(...)`

**Descrição**: Cria um novo entregador.

**Body**:
```json
{
  "nome": "João Silva",
  "telefone": "11999999999",
  "unidade": "ITAQUA",
  "unidade_id": "uuid",
  "franquia_id": "uuid",
  "tipo_bag": "normal"
}
```

**Response**:
```json
{
  "id": "uuid",
  "nome": "João Silva",
  "telefone": "11999999999",
  "status": "disponivel",
  "unidade": "ITAQUA",
  "unidade_id": "uuid",
  "franquia_id": "uuid",
  "tipo_bag": "normal",
  "ativo": true,
  "created_at": "2025-12-31T10:00:00Z"
}
```

---

### 2.4. PATCH `/api/entregadores/:id`

**Substitui**: `supabase.from('entregadores').update(...).eq('id', id)`

**Descrição**: Atualiza um entregador.

**Body** (campos opcionais):
```json
{
  "nome": "João Silva Atualizado",
  "telefone": "11888888888",
  "status": "em_entrega",
  "tipo_bag": "metro"
}
```

**Response**:
```json
{
  "id": "uuid",
  "nome": "João Silva Atualizado",
  "telefone": "11888888888",
  "status": "em_entrega",
  "tipo_bag": "metro",
  "updated_at": "2025-12-31T11:00:00Z"
}
```

---

### 2.5. DELETE `/api/entregadores/:id`

**Substitui**: `supabase.from('entregadores').delete().eq('id', id)`

**Descrição**: Desativa (soft delete) um entregador.

**Response**:
```json
{
  "success": true,
  "message": "Entregador desativado com sucesso"
}
```

**Lógica**:
- Não deletar do banco, apenas setar `ativo = false`

---

## 3. Histórico de entregas

### 3.1. GET `/api/historico-entregas`

**Substitui**: `supabase.from('historico_entregas').select('*')`

**Query Params**:
- `unidade_id`: filtrar por unidade
- `franquia_id`: filtrar por franquia
- `data_inicio`: filtrar por data inicial (YYYY-MM-DD)
- `data_fim`: filtrar por data final (YYYY-MM-DD)
- `entregador_id`: filtrar por entregador

**Response**:
```json
[
  {
    "id": "uuid",
    "entregador_id": "uuid",
    "entregador_nome": "João Silva",
    "unidade": "ITAQUA",
    "unidade_id": "uuid",
    "franquia_id": "uuid",
    "tipo_bag": "normal",
    "hora_saida": "2025-12-31T10:00:00Z",
    "hora_retorno": "2025-12-31T11:30:00Z",
    "created_at": "2025-12-31T10:00:00Z"
  }
]
```

---

### 3.2. POST `/api/historico-entregas`

**Substitui**: `supabase.from('historico_entregas').insert(...)`

**Descrição**: Registra uma nova entrega.

**Body**:
```json
{
  "entregador_id": "uuid",
  "unidade": "ITAQUA",
  "unidade_id": "uuid",
  "franquia_id": "uuid",
  "tipo_bag": "normal",
  "hora_saida": "2025-12-31T10:00:00Z",
  "hora_retorno": null
}
```

**Response**:
```json
{
  "id": "uuid",
  "entregador_id": "uuid",
  "unidade": "ITAQUA",
  "hora_saida": "2025-12-31T10:00:00Z",
  "created_at": "2025-12-31T10:00:00Z"
}
```

---

### 3.3. PATCH `/api/historico-entregas/:id`

**Substitui**: `supabase.from('historico_entregas').update(...).eq('id', id)`

**Descrição**: Atualiza uma entrega (ex: registrar retorno).

**Body**:
```json
{
  "hora_retorno": "2025-12-31T11:30:00Z"
}
```

**Response**:
```json
{
  "id": "uuid",
  "hora_retorno": "2025-12-31T11:30:00Z",
  "updated_at": "2025-12-31T11:30:00Z"
}
```

---

## 4. Franquias e Unidades

### 4.1. GET `/api/franquias`

**Substitui**: `supabase.from('franquias').select('*')`

**Response**:
```json
[
  {
    "id": "uuid",
    "nome_franquia": "Dom Fiorentino",
    "slug": "dom-fiorentino",
    "status_pagamento": "ativo",
    "data_vencimento": "2026-01-27",
    "plano_limite_lojas": 3,
    "created_at": "2025-12-27T09:42:57Z"
  }
]
```

---

### 4.2. GET `/api/franquias/:id/unidades`

**Substitui**: `supabase.from('unidades').select('*').eq('franquia_id', id)`

**Response**:
```json
[
  {
    "id": "uuid",
    "franquia_id": "uuid",
    "nome_loja": "Itaquaquecetuba",
    "created_at": "2025-12-27T10:16:39Z"
  },
  {
    "id": "uuid",
    "franquia_id": "uuid",
    "nome_loja": "Poá",
    "created_at": "2025-12-27T10:16:39Z"
  }
]
```

---

### 4.3. PATCH `/api/franquias/:id`

**Substitui**: `supabase.from('franquias').update(...).eq('id', id)`

**Descrição**: Atualiza uma franquia (ex: config de pagamento).

**Body**:
```json
{
  "config_pagamento": {
    "provider": "asas",
    "api_key": "sua_api_key_aqui",
    "webhook_url": "https://seudominio.com/api/webhooks/payments?gateway=asaas&secret=SEU_SEGREDO"
  }
}
```

**Response**:
```json
{
  "id": "uuid",
  "config_pagamento": { ... },
  "updated_at": "2025-12-31T12:00:00Z"
}
```

---

## 5. Webhooks

### 5.1. POST `/api/webhooks/payments`

**Substitui**: Edge Function `webhooks-payments`

**Descrição**: Recebe notificações de pagamento dos gateways (Asaas, Seabra).

**Query Params**:
- `gateway`: asas | seabra
- `secret`: segredo para validação

**Body** (exemplo Asaas):
```json
{
  "event": "PAYMENT_RECEIVED",
  "payment": {
    "id": "pay_123",
    "status": "RECEIVED",
    "value": 250.00,
    "externalReference": "uuid-da-franquia",
    "dateCreated": "2025-12-31",
    "confirmedDate": "2025-12-31"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Pagamento processado e franquia renovada"
}
```

**Lógica**:
1. Validar `secret` contra o configurado no `.env` ou `global_config`
2. Extrair `franquiaId` do campo `externalReference`
3. Registrar/atualizar cobrança na tabela `franquia_cobrancas`:
   ```sql
   INSERT INTO franquia_cobrancas (franquia_id, gateway, external_id, status, valor, payload)
   VALUES ($1, $2, $3, $4, $5, $6)
   ON CONFLICT (external_id) DO UPDATE SET status = $4, payload = $6
   ```
4. Se status for `RECEIVED` ou `CONFIRMED`:
   - Buscar plano da franquia para saber `duracao_meses`
   - Calcular nova data de vencimento: `new Date() + duracao_meses meses`
   - Atualizar franquia:
     ```sql
     UPDATE franquias 
     SET status_pagamento = 'ativo', data_vencimento = $1 
     WHERE id = $2
     ```

---

### 5.2. POST `/api/webhooks/store`

**Substitui**: Edge Function `send-webhook`

**Descrição**: Envia notificação webhook para URL configurada na unidade (ex: notificar sistema externo sobre mudanças na fila).

**Body**:
```json
{
  "event": "entregador_saiu",
  "entregador": {
    "id": "uuid",
    "nome": "João Silva",
    "telefone": "11999999999"
  },
  "unidade": "ITAQUA",
  "timestamp": "2025-12-31T10:00:00Z"
}
```

**Lógica**:
1. Buscar `webhook_url` da tabela `system_config` por `unidade`
2. Fazer POST para a URL com o payload
3. Registrar resposta/erro em logs

---

## 6. WhatsApp (Evolution API)

### 6.1. POST `/api/whatsapp/send`

**Substitui**: Edge Function `send-whatsapp`

**Descrição**: Envia mensagem via Evolution API.

**Body**:
```json
{
  "telefone": "5511999999999",
  "message": "Olá, João! Sua entrega está pronta.",
  "unidade_id": "uuid",
  "franquia_id": "uuid",
  "entregador_id": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "message_id": "msg_123"
}
```

**Lógica**:
1. Buscar configuração WhatsApp da franquia (`config_pagamento.whatsapp`)
2. Fazer POST para Evolution API:
   ```
   POST https://evolution-api-url/message/sendText/instance
   Headers: { apikey: "evolution_api_key" }
   Body: { number: "5511999999999", text: "mensagem" }
   ```
3. Registrar histórico na tabela `whatsapp_historico`

---

## 7. Text-to-Speech (ElevenLabs)

### 7.1. POST `/api/tts/generate`

**Substitui**: Edge Function `elevenlabs-tts`

**Descrição**: Gera áudio de voz usando ElevenLabs.

**Body**:
```json
{
  "text": "João Silva, entrega pronta no balcão",
  "entregador_id": "uuid"
}
```

**Response**:
```json
{
  "audio_url": "https://seudominio.com/storage/motoboy_voices/uuid.mp3",
  "tts_voice_path": "/storage/motoboy_voices/uuid.mp3"
}
```

**Lógica**:
1. Buscar `ELEVENLABS_API_KEY` do `.env`
2. Fazer POST para ElevenLabs API:
   ```
   POST https://api.elevenlabs.io/v1/text-to-speech/VOICE_ID
   Headers: { xi-api-key: "API_KEY" }
   Body: { text: "texto", model_id: "eleven_monolingual_v1" }
   ```
3. Salvar áudio em `/var/www/storage/motoboy_voices/{uuid}.mp3`
4. Atualizar entregador com `tts_voice_path`

---

## 8. Pagamentos (cobranças)

### 8.1. POST `/api/pagamentos/criar-cobranca`

**Substitui**: Edge Function `criar-cobranca-franquia`

**Descrição**: Cria uma cobrança no gateway de pagamento (Asaas ou Seabra).

**Body**:
```json
{
  "franquia_id": "uuid",
  "valor": 250.00,
  "vencimento": "2025-01-31"
}
```

**Response**:
```json
{
  "success": true,
  "cobranca_id": "pay_123",
  "payment_url": "https://asaas.com/cobranca/pay_123",
  "qr_code_pix": "00020126....",
  "pix_copia_cola": "00020126...."
}
```

**Lógica**:
1. Buscar configuração de pagamento da franquia (`config_pagamento`)
2. Se `provider === 'asas'`:
   - Fazer POST para Asaas:
     ```
     POST https://www.asaas.com/api/v3/payments
     Headers: { access_token: "api_key" }
     Body: {
       customer: "customer_id",
       billingType: "PIX",
       value: 250.00,
       dueDate: "2025-01-31",
       externalReference: "franquia_id"
     }
     ```
3. Registrar cobrança na tabela `franquia_cobrancas`
4. Retornar URL de pagamento

---

### 8.2. POST `/api/pagamentos/sincronizar`

**Substitui**: Edge Function `sync-payment-status`

**Descrição**: Sincroniza manualmente o status de uma cobrança com o gateway.

**Body**:
```json
{
  "franquia_id": "uuid",
  "cobranca_id": "pay_123"
}
```

**Response**:
```json
{
  "success": true,
  "status": "RECEIVED",
  "message": "Pagamento confirmado e franquia renovada"
}
```

**Lógica**:
1. Buscar API Key do gateway da franquia
2. Fazer GET para gateway para buscar status da cobrança:
   ```
   GET https://www.asaas.com/api/v3/payments/{cobranca_id}
   ```
3. Atualizar tabela `franquia_cobrancas` com novo status
4. Se status for `RECEIVED` ou `CONFIRMED`, renovar franquia

---

## 9. Tarefas agendadas (Cron Jobs)

### 9.1. GET `/api/cron/reset-daily`

**Substitui**: Edge Function `reset-daily`

**Descrição**: Reseta a fila de entregadores diariamente (ex: 3h da manhã).

**Lógica**:
1. Para cada franquia:
   - Buscar `horario_reset` (ex: 03:00)
   - Se horário atual === horário de reset:
     - Resetar status de todos os entregadores para `disponivel`
     - Resetar `fila_posicao` para `now()`
     - Resetar `hora_saida` para `null`

**Configuração**:
- Configurar cron no servidor para chamar esta rota a cada hora:
  ```bash
  crontab -e
  
  # Adicionar:
  0 * * * * curl https://seudominio.com/api/cron/reset-daily
  ```

---

### 9.2. GET `/api/cron/cleanup-old-data`

**Substitui**: Edge Function `cleanup-old-data`

**Descrição**: Remove dados antigos do banco (ex: histórico > 90 dias).

**Lógica**:
1. Deletar registros antigos:
   ```sql
   DELETE FROM historico_entregas WHERE created_at < NOW() - INTERVAL '90 days';
   DELETE FROM logs_auditoria WHERE created_at < NOW() - INTERVAL '180 days';
   ```

**Configuração**:
- Rodar semanalmente via cron:
  ```bash
  0 2 * * 0 curl https://seudominio.com/api/cron/cleanup-old-data
  ```

---

### 9.3. GET `/api/cron/update-franquias-status`

**Substitui**: Edge Function `update-franquias-status`

**Descrição**: Verifica diariamente se franquias venceram e bloqueia acesso.

**Lógica**:
1. Buscar franquias com `data_vencimento < hoje` e `status_pagamento = 'ativo'`
2. Atualizar para `status_pagamento = 'vencido'`:
   ```sql
   UPDATE franquias 
   SET status_pagamento = 'vencido' 
   WHERE data_vencimento < CURRENT_DATE AND status_pagamento = 'ativo';
   ```

**Configuração**:
- Rodar diariamente às 6h:
  ```bash
  0 6 * * * curl https://seudominio.com/api/cron/update-franquias-status
  ```

---

## 10. APIs públicas (sem autenticação)

### 10.1. GET `/api/public/store-status`

**Substitui**: Edge Function `api-store-status`

**Descrição**: Retorna status público de uma loja (ex: fila de entregadores para TV).

**Query Params**:
- `unidade_id`: ID da unidade

**Response**:
```json
{
  "unidade": "ITAQUA",
  "nome_loja": "Itaquaquecetuba",
  "entregadores_disponiveis": 5,
  "entregadores_em_entrega": 3,
  "fila": [
    {
      "nome": "João Silva",
      "status": "disponivel",
      "fila_posicao": 1
    },
    {
      "nome": "Maria Santos",
      "status": "disponivel",
      "fila_posicao": 2
    }
  ]
}
```

---

### 10.2. POST `/api/public/payments/create`

**Substitui**: Edge Function `api-payments-create`

**Descrição**: Cria cobrança via API pública (B2B).

**Headers**:
```
X-API-Key: api_key_aqui
```

**Body**:
```json
{
  "franquia_id": "uuid",
  "valor": 250.00,
  "vencimento": "2025-01-31"
}
```

**Response**:
```json
{
  "success": true,
  "cobranca_id": "pay_123",
  "payment_url": "https://asaas.com/cobranca/pay_123"
}
```

**Lógica**:
1. Validar `X-API-Key` contra tabela `api_keys`
2. Criar cobrança (mesma lógica de `criar-cobranca-franquia`)

---

## 11. Storage (upload de arquivos)

### 11.1. POST `/api/storage/upload`

**Substitui**: Supabase Storage

**Descrição**: Faz upload de arquivo (ex: áudio TTS).

**Body** (multipart/form-data):
```
file: <arquivo>
bucket: motoboy_voices
```

**Response**:
```json
{
  "path": "/storage/motoboy_voices/uuid.mp3",
  "publicUrl": "https://seudominio.com/storage/motoboy_voices/uuid.mp3"
}
```

**Lógica**:
1. Usar `multer` para receber arquivo
2. Salvar em `/var/www/storage/{bucket}/{uuid}.{ext}`
3. Retornar path público

---

### 11.2. DELETE `/api/storage/delete`

**Substitui**: Supabase Storage (delete)

**Descrição**: Remove arquivo do storage.

**Body**:
```json
{
  "path": "/storage/motoboy_voices/uuid.mp3"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Arquivo deletado"
}
```

**Lógica**:
1. Validar path para evitar directory traversal
2. Deletar arquivo com `fs.unlink()`

---

## 12. Checklist de implementação

- [ ] Auth: login, register, me
- [ ] Entregadores: GET, POST, PATCH, DELETE
- [ ] Histórico: GET, POST, PATCH
- [ ] Franquias: GET, PATCH
- [ ] Unidades: GET
- [ ] Webhook de pagamento (Asaas/Seabra)
- [ ] Webhook de loja (notificações externas)
- [ ] WhatsApp (Evolution API)
- [ ] TTS (ElevenLabs)
- [ ] Criar cobrança
- [ ] Sincronizar pagamento
- [ ] Cron: reset daily
- [ ] Cron: cleanup old data
- [ ] Cron: update franquias status
- [ ] API pública: store status
- [ ] API pública: create payment
- [ ] Storage: upload
- [ ] Storage: delete

---

**Fim do documento de APIs do backend.**
