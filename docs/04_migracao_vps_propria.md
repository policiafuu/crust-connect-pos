# 04_migracao_vps_propria.md

Este documento explica **como migrar o projeto** do Lovable Cloud (Supabase) para **sua própria VPS** com banco de dados PostgreSQL e backend customizado.

> ⚠️ **Atenção**: Esta é uma migração complexa que envolve infraestrutura, backend, autenticação e storage. Recomendamos que seja feita por um desenvolvedor com experiência em DevOps.

---

## 1. Visão geral da arquitetura

### 1.1. Arquitetura atual (Lovable Cloud/Supabase)

```
┌─────────────────┐
│   Front-end     │ (React + Vite)
│   (Navegador)   │
└────────┬────────┘
         │
         │ HTTPS
         ▼
┌─────────────────────────────────────┐
│      Supabase (Lovable Cloud)       │
├─────────────────────────────────────┤
│ - PostgreSQL (banco de dados)       │
│ - Edge Functions (APIs serverless)  │
│ - Auth (autenticação JWT)           │
│ - Storage (arquivos de voz TTS)     │
│ - Realtime (subscriptions)          │
└─────────────────────────────────────┘
```

### 1.2. Arquitetura migrada (VPS própria)

```
┌─────────────────┐
│   Front-end     │ (React + Vite + Nginx)
│   (Navegador)   │
└────────┬────────┘
         │
         │ HTTPS
         ▼
┌─────────────────────────────────────┐
│           Sua VPS Linux             │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │  Nginx (Reverse Proxy + SSL)    │ │
│ └─────────┬───────────────────────┘ │
│           │                           │
│ ┌─────────▼───────────────────────┐ │
│ │  Backend API (Node.js/Python)   │ │
│ │  - REST APIs                    │ │
│ │  - JWT Authentication           │ │
│ │  - Webhooks                     │ │
│ └─────────┬───────────────────────┘ │
│           │                           │
│ ┌─────────▼───────────────────────┐ │
│ │  PostgreSQL 14+                 │ │
│ │  - Todas as tabelas             │ │
│ │  - RLS policies (opcional)      │ │
│ └─────────────────────────────────┘ │
│                                       │
│ ┌─────────────────────────────────┐ │
│ │  Storage Local / S3             │ │
│ │  - Arquivos de voz TTS          │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## 2. Requisitos da VPS

### 2.1. Especificações mínimas recomendadas

- **CPU**: 2 cores
- **RAM**: 4 GB
- **Disco**: 40 GB SSD
- **OS**: Ubuntu 22.04 LTS ou Debian 11+
- **Rede**: IP público fixo + domínio próprio

### 2.2. Software necessário

- **PostgreSQL 14+** (banco de dados)
- **Node.js 18+ ou Python 3.10+** (backend API)
- **Nginx** (servidor web + proxy reverso)
- **PM2 ou systemd** (gerenciador de processos)
- **Certbot** (SSL/TLS com Let's Encrypt)
- **Git** (para deploy do código)

---

## 3. Passo a passo da migração

### 3.1. Preparar a VPS

1. **Conectar via SSH**:
   ```bash
   ssh root@seu-ip-vps
   ```

2. **Atualizar o sistema**:
   ```bash
   apt update && apt upgrade -y
   ```

3. **Instalar dependências básicas**:
   ```bash
   apt install -y curl wget git build-essential
   ```

### 3.2. Instalar PostgreSQL

1. **Instalar PostgreSQL**:
   ```bash
   apt install -y postgresql postgresql-contrib
   ```

2. **Iniciar o serviço**:
   ```bash
   systemctl start postgresql
   systemctl enable postgresql
   ```

3. **Criar um usuário e banco de dados**:
   ```bash
   sudo -u postgres psql
   ```
   
   Dentro do psql:
   ```sql
   CREATE USER appuser WITH PASSWORD 'senha_forte_aqui';
   CREATE DATABASE appdb OWNER appuser;
   \q
   ```

4. **Rodar os schemas SQL**:
   
   Copie os arquivos `db/00_schema_estrutura.sql` e `db/01_policies_rls.sql` para a VPS e execute:
   
   ```bash
   psql -U appuser -d appdb -f db/00_schema_estrutura.sql
   psql -U appuser -d appdb -f db/01_policies_rls.sql
   ```

5. **Configurar acesso externo (opcional)**:
   
   Edite `/etc/postgresql/14/main/postgresql.conf`:
   ```conf
   listen_addresses = 'localhost'  # ou '*' para acesso externo
   ```
   
   Edite `/etc/postgresql/14/main/pg_hba.conf`:
   ```conf
   host    all             all             0.0.0.0/0               md5
   ```
   
   Reinicie o PostgreSQL:
   ```bash
   systemctl restart postgresql
   ```

> ⚠️ **Segurança**: Se habilitar acesso externo, use firewall (ufw) para liberar apenas IPs confiáveis na porta 5432.

### 3.3. Exportar dados do Supabase

Se você já tem dados em produção no Lovable Cloud, exporte-os:

1. **Via SQL Editor no painel Supabase**:
   ```sql
   COPY (SELECT * FROM entregadores) TO STDOUT WITH CSV HEADER;
   COPY (SELECT * FROM historico_entregas) TO STDOUT WITH CSV HEADER;
   -- Repita para outras tabelas
   ```

2. **Ou use pg_dump** (se tiver acesso ao banco):
   ```bash
   pg_dump -h SEU_HOST_SUPABASE -U postgres -d postgres -t public.entregadores > entregadores.sql
   ```

3. **Importar no novo banco**:
   ```bash
   psql -U appuser -d appdb < entregadores.sql
   ```

### 3.4. Instalar Node.js (ou Python)

#### Opção A: Node.js 18+

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs
node --version  # Verificar
npm --version
```

#### Opção B: Python 3.10+

```bash
apt install -y python3 python3-pip python3-venv
python3 --version
```

### 3.5. Criar o backend API

O backend precisa substituir as Edge Functions do Supabase. Veja o documento `docs/05_apis_backend_vps.md` para o **detalhamento completo de todas as APIs** que precisam ser implementadas.

#### Estrutura básica (Node.js + Express)

1. **Criar pasta do backend**:
   ```bash
   mkdir -p /var/www/api
   cd /var/www/api
   ```

2. **Inicializar projeto Node.js**:
   ```bash
   npm init -y
   npm install express pg bcrypt jsonwebtoken cors dotenv
   ```

3. **Criar arquivo `server.js`** (exemplo simplificado):
   ```javascript
   const express = require('express');
   const { Pool } = require('pg');
   const jwt = require('jsonwebtoken');
   const bcrypt = require('bcrypt');
   const cors = require('cors');
   require('dotenv').config();

   const app = express();
   app.use(cors());
   app.use(express.json());

   const pool = new Pool({
     user: process.env.DB_USER,
     host: process.env.DB_HOST,
     database: process.env.DB_NAME,
     password: process.env.DB_PASSWORD,
     port: 5432,
   });

   // Exemplo: Login (substitui Supabase Auth)
   app.post('/api/auth/login', async (req, res) => {
     const { username, password } = req.body;
     
     const result = await pool.query(
       'SELECT * FROM system_users WHERE username = $1',
       [username]
     );
     
     if (result.rows.length === 0) {
       return res.status(401).json({ error: 'Credenciais inválidas' });
     }
     
     const user = result.rows[0];
     const valid = await bcrypt.compare(password, user.password_hash);
     
     if (!valid) {
       return res.status(401).json({ error: 'Credenciais inválidas' });
     }
     
     const token = jwt.sign(
       { id: user.id, username: user.username, role: user.role },
       process.env.JWT_SECRET,
       { expiresIn: '7d' }
     );
     
     res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
   });

   // Middleware de autenticação JWT
   const authMiddleware = (req, res, next) => {
     const authHeader = req.headers.authorization;
     if (!authHeader) return res.status(401).json({ error: 'Token não fornecido' });
     
     const token = authHeader.split(' ')[1];
     try {
       const decoded = jwt.verify(token, process.env.JWT_SECRET);
       req.user = decoded;
       next();
     } catch (err) {
       res.status(401).json({ error: 'Token inválido' });
     }
   };

   // Exemplo: Listar entregadores (substitui consulta direta ao Supabase)
   app.get('/api/entregadores', authMiddleware, async (req, res) => {
     const result = await pool.query('SELECT * FROM entregadores WHERE ativo = true');
     res.json(result.rows);
   });

   // Exemplo: Criar entregador
   app.post('/api/entregadores', authMiddleware, async (req, res) => {
     const { nome, telefone, unidade, unidade_id, franquia_id } = req.body;
     const result = await pool.query(
       'INSERT INTO entregadores (nome, telefone, unidade, unidade_id, franquia_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
       [nome, telefone, unidade, unidade_id, franquia_id]
     );
     res.json(result.rows[0]);
   });

   // Webhook de pagamento (substitui webhooks-payments edge function)
   app.post('/api/webhooks/payments', async (req, res) => {
     const gateway = req.query.gateway;
     const payload = req.body;
     
     // Validar webhook_secret
     // Processar pagamento
     // Atualizar franquia
     
     res.json({ success: true });
   });

   const PORT = process.env.PORT || 3000;
   app.listen(PORT, () => {
     console.log(`API rodando na porta ${PORT}`);
   });
   ```

4. **Criar arquivo `.env`**:
   ```bash
   DB_USER=appuser
   DB_HOST=localhost
   DB_NAME=appdb
   DB_PASSWORD=senha_forte_aqui
   JWT_SECRET=seu_segredo_jwt_muito_forte_aqui
   PORT=3000
   ```

5. **Testar o backend localmente**:
   ```bash
   node server.js
   ```

6. **Instalar PM2** (gerenciador de processos):
   ```bash
   npm install -g pm2
   pm2 start server.js --name api
   pm2 save
   pm2 startup  # Configurar para iniciar no boot
   ```

> 📚 **Importante**: Veja `docs/05_apis_backend_vps.md` para a lista completa de endpoints que precisam ser implementados.

### 3.6. Configurar Nginx

1. **Instalar Nginx**:
   ```bash
   apt install -y nginx
   ```

2. **Criar configuração para o site**:
   
   Crie `/etc/nginx/sites-available/seuapp`:
   ```nginx
   server {
       listen 80;
       server_name seudominio.com www.seudominio.com;

       # Front-end (React build)
       root /var/www/html/dist;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }

       # Proxy para API backend
       location /api/ {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

3. **Habilitar site**:
   ```bash
   ln -s /etc/nginx/sites-available/seuapp /etc/nginx/sites-enabled/
   nginx -t  # Testar configuração
   systemctl restart nginx
   ```

4. **Configurar SSL com Let's Encrypt**:
   ```bash
   apt install -y certbot python3-certbot-nginx
   certbot --nginx -d seudominio.com -d www.seudominio.com
   ```

### 3.7. Fazer deploy do front-end

1. **No seu ambiente local, fazer build do React**:
   ```bash
   # Editar .env para apontar para a nova API
   VITE_API_URL=https://seudominio.com/api
   
   npm run build
   ```

2. **Copiar o build para a VPS**:
   ```bash
   scp -r dist/* root@seu-ip-vps:/var/www/html/
   ```

3. **Ou usar Git + hook de deploy** (mais profissional):
   ```bash
   # Na VPS
   cd /var/www/html
   git clone https://github.com/seu-usuario/seu-repo.git .
   npm install
   npm run build
   ```

### 3.8. Configurar storage de arquivos

Para substituir o Supabase Storage (usado para arquivos de voz TTS):

#### Opção A: Storage local na VPS

1. **Criar pasta de uploads**:
   ```bash
   mkdir -p /var/www/storage/motoboy_voices
   chown -R www-data:www-data /var/www/storage
   ```

2. **No backend, adicionar rota de upload**:
   ```javascript
   const multer = require('multer');
   const upload = multer({ dest: '/var/www/storage/motoboy_voices/' });

   app.post('/api/storage/upload', authMiddleware, upload.single('file'), (req, res) => {
     res.json({ 
       path: `/storage/motoboy_voices/${req.file.filename}`,
       publicUrl: `https://seudominio.com/storage/motoboy_voices/${req.file.filename}`
     });
   });
   ```

3. **Configurar Nginx para servir arquivos estáticos**:
   ```nginx
   location /storage/ {
       alias /var/www/storage/;
       autoindex off;
   }
   ```

#### Opção B: Usar S3 ou MinIO

Para produção, considere usar S3 (AWS), MinIO (auto-hospedado) ou DigitalOcean Spaces.

---

## 4. Migração da autenticação

O Supabase Auth será substituído por JWT próprio.

### 4.1. Backend (já implementado no exemplo acima)

- Rota `/api/auth/login` para login
- Rota `/api/auth/register` para criar novos usuários (opcional)
- Middleware `authMiddleware` para validar token JWT em rotas protegidas

### 4.2. Front-end: Atualizar `AuthContext.tsx`

No front-end, substitua as chamadas ao Supabase pela sua API:

```typescript
// src/contexts/AuthContext.tsx

const login = async (username: string, password: string) => {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  
  if (!response.ok) {
    throw new Error('Credenciais inválidas');
  }
  
  const data = await response.json();
  localStorage.setItem('auth_token', data.token);
  setUser(data.user);
};

const logout = () => {
  localStorage.removeItem('auth_token');
  setUser(null);
};
```

### 4.3. Adicionar token JWT em todas as requisições

Crie um helper para fazer requisições autenticadas:

```typescript
// src/lib/api.ts

export const apiClient = {
  get: async (url: string) => {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${import.meta.env.VITE_API_URL}${url}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },
  
  post: async (url: string, data: any) => {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${import.meta.env.VITE_API_URL}${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    return response.json();
  },
  
  // ... put, delete, etc.
};
```

---

## 5. Configurar webhooks de pagamento

Os webhooks de pagamento (Asaas, Seabra) precisam apontar para a nova URL da VPS:

### 5.1. Atualizar URL no painel do gateway

- **Asaas**: `https://seudominio.com/api/webhooks/payments?gateway=asaas&secret=SEU_SEGREDO`
- **Seabra**: `https://seudominio.com/api/webhooks/payments?gateway=seabra&secret=SEU_SEGREDO`

### 5.2. Implementar validação de webhook no backend

```javascript
app.post('/api/webhooks/payments', async (req, res) => {
  const { gateway } = req.query;
  const payload = req.body;
  
  // 1. Validar secret
  const expectedSecret = process.env.WEBHOOK_SECRET;
  if (req.query.secret !== expectedSecret) {
    return res.status(401).json({ error: 'Secret inválido' });
  }
  
  // 2. Processar payload conforme gateway
  if (gateway === 'asaas') {
    // Lógica Asaas (ver webhook-asaas edge function)
    const { event, payment } = payload;
    
    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      const franquiaId = payment.externalReference;
      
      // Registrar cobrança
      await pool.query(
        'INSERT INTO franquia_cobrancas (franquia_id, gateway, external_id, status, valor, payload) VALUES ($1, $2, $3, $4, $5, $6)',
        [franquiaId, 'asas', payment.id, payment.status, payment.value, JSON.stringify(payload)]
      );
      
      // Atualizar franquia
      const plano = await pool.query('SELECT duracao_meses FROM planos WHERE id = $1', [payment.subscriptionId]);
      const novaData = new Date();
      novaData.setMonth(novaData.getMonth() + plano.rows[0].duracao_meses);
      
      await pool.query(
        'UPDATE franquias SET status_pagamento = $1, data_vencimento = $2 WHERE id = $3',
        ['ativo', novaData.toISOString().split('T')[0], franquiaId]
      );
    }
  }
  
  res.json({ success: true });
});
```

---

## 6. Substituir Realtime (opcional)

Se você usa Supabase Realtime para subscriptions (ex: atualização em tempo real da fila de entregadores), você pode:

### Opção A: Usar WebSockets com Socket.io

```bash
npm install socket.io
```

```javascript
const { Server } = require('socket.io');
const io = new Server(3001, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  console.log('Cliente conectado');
  
  socket.on('subscribe', (table) => {
    socket.join(table);
  });
});

// Emitir eventos quando houver mudanças no banco
app.post('/api/entregadores', authMiddleware, async (req, res) => {
  // ... criar entregador
  io.to('entregadores').emit('insert', result.rows[0]);
  res.json(result.rows[0]);
});
```

### Opção B: Usar polling (mais simples)

No front-end, fazer polling a cada X segundos:

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    fetch('/api/entregadores').then(res => res.json()).then(setEntregadores);
  }, 5000);
  
  return () => clearInterval(interval);
}, []);
```

---

## 7. Checklist final de migração

- [ ] PostgreSQL instalado e rodando
- [ ] Schemas e policies criados (`00_schema_estrutura.sql`, `01_policies_rls.sql`)
- [ ] Dados exportados do Supabase e importados no novo banco
- [ ] Backend API implementado com todas as rotas necessárias (veja `docs/05_apis_backend_vps.md`)
- [ ] Autenticação JWT funcionando
- [ ] Storage de arquivos configurado (local ou S3)
- [ ] Nginx configurado como reverse proxy
- [ ] SSL/TLS configurado com Let's Encrypt
- [ ] Front-end atualizado para usar a nova API (variáveis de ambiente)
- [ ] Front-end deployado na VPS
- [ ] Webhooks de pagamento atualizados nos painéis dos gateways
- [ ] Testes de integração (login, CRUD, webhooks, upload de arquivos)
- [ ] Backup automático do banco configurado (cron + pg_dump)
- [ ] Monitoramento configurado (opcional: Grafana, Prometheus, PM2 logs)

---

## 8. Manutenção e boas práticas

### 8.1. Backups automáticos do banco

Crie um script de backup:

```bash
#!/bin/bash
# /root/backup-db.sh

BACKUP_DIR="/root/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$DATE.sql"

mkdir -p $BACKUP_DIR

pg_dump -U appuser -d appdb > $BACKUP_FILE

# Manter apenas os últimos 7 backups
ls -t $BACKUP_DIR/backup_*.sql | tail -n +8 | xargs rm -f

echo "Backup concluído: $BACKUP_FILE"
```

Configure no cron:

```bash
crontab -e

# Adicionar:
0 3 * * * /root/backup-db.sh
```

### 8.2. Logs e monitoramento

- **Logs do backend**: `pm2 logs api`
- **Logs do Nginx**: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`
- **Logs do PostgreSQL**: `/var/log/postgresql/postgresql-14-main.log`

### 8.3. Atualizações de segurança

```bash
apt update && apt upgrade -y
```

Configure atualizações automáticas:

```bash
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

### 8.4. Firewall (UFW)

```bash
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable
```

---

## 9. Próximos passos

Após concluir a migração básica, considere:

1. **Implementar CI/CD** com GitHub Actions para deploy automatizado
2. **Adicionar monitoramento** com Grafana + Prometheus
3. **Configurar cache** com Redis para melhorar performance
4. **Implementar rate limiting** para proteger a API
5. **Adicionar testes automatizados** (Jest, Pytest, etc.)
6. **Documentar a API** com Swagger/OpenAPI

---

## 10. Suporte e troubleshooting

### Problema: "Connection refused" ao acessar a API

- Verifique se o backend está rodando: `pm2 status`
- Verifique se a porta está aberta: `netstat -tlnp | grep 3000`
- Verifique logs: `pm2 logs api`

### Problema: Erro de autenticação JWT

- Verifique se o `JWT_SECRET` está configurado no `.env`
- Verifique se o token está sendo enviado no header: `Authorization: Bearer <token>`

### Problema: Webhook não funciona

- Verifique se a URL está acessível externamente: `curl https://seudominio.com/api/webhooks/payments`
- Verifique logs do backend para ver se a requisição chegou
- Teste localmente com ngrok: `ngrok http 3000`

---

**Fim do documento de migração para VPS própria.**
