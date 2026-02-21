# 06_docker_compose_vps.md

Este documento fornece um exemplo completo de **docker-compose.yml** para facilitar o deploy do projeto na VPS usando containers Docker.

> 💡 **Vantagens de usar Docker**:
> - Isolamento de ambientes
> - Deploy mais rápido e consistente
> - Fácil rollback em caso de problemas
> - Escalabilidade simplificada

---

## 1. Estrutura de pastas

```
/var/www/projeto/
├── docker-compose.yml
├── .env
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   └── ...
├── frontend/
│   ├── Dockerfile
│   ├── dist/
│   └── ...
├── nginx/
│   ├── Dockerfile
│   └── nginx.conf
└── storage/
    └── motoboy_voices/
```

---

## 2. Arquivo docker-compose.yml

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:14-alpine
    container_name: projeto-db
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./db/00_schema_estrutura.sql:/docker-entrypoint-initdb.d/01-schema.sql
      - ./db/01_policies_rls.sql:/docker-entrypoint-initdb.d/02-policies.sql
    ports:
      - "5432:5432"
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Backend API (Node.js)
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: projeto-api
    restart: always
    env_file:
      - .env
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
      DB_NAME: ${DB_NAME}
      JWT_SECRET: ${JWT_SECRET}
      PORT: 3000
    volumes:
      - ./storage:/var/www/storage
    ports:
      - "3000:3000"
    networks:
      - app-network
    depends_on:
      postgres:
        condition: service_healthy

  # Nginx Reverse Proxy
  nginx:
    build:
      context: ./nginx
      dockerfile: Dockerfile
    container_name: projeto-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./frontend/dist:/usr/share/nginx/html
      - ./storage:/var/www/storage
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    networks:
      - app-network
    depends_on:
      - backend

  # Certbot for SSL
  certbot:
    image: certbot/certbot
    container_name: projeto-certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"

volumes:
  postgres_data:

networks:
  app-network:
    driver: bridge
```

---

## 3. Dockerfile do Backend

**backend/Dockerfile**:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copiar package.json e instalar dependências
COPY package*.json ./
RUN npm ci --only=production

# Copiar código-fonte
COPY . .

# Expor porta
EXPOSE 3000

# Comando para iniciar o servidor
CMD ["node", "server.js"]
```

---

## 4. Dockerfile do Nginx

**nginx/Dockerfile**:

```dockerfile
FROM nginx:alpine

# Remover configuração padrão
RUN rm /etc/nginx/conf.d/default.conf

# Copiar configuração customizada
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80 443
```

---

## 5. Configuração do Nginx

**nginx/nginx.conf**:

```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    sendfile on;
    keepalive_timeout 65;

    # Logs
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript 
               application/x-javascript application/xml+rss 
               application/json application/javascript;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

    server {
        listen 80;
        server_name seudominio.com www.seudominio.com;

        # Certbot challenge
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        # Redirecionar para HTTPS
        location / {
            return 301 https://$host$request_uri;
        }
    }

    server {
        listen 443 ssl http2;
        server_name seudominio.com www.seudominio.com;

        # SSL certificates
        ssl_certificate /etc/letsencrypt/live/seudominio.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/seudominio.com/privkey.pem;

        # SSL settings
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Front-end (React build)
        root /usr/share/nginx/html;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }

        # API backend
        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;
            
            proxy_pass http://backend:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Storage de arquivos
        location /storage/ {
            alias /var/www/storage/;
            autoindex off;
            expires 30d;
            add_header Cache-Control "public, immutable";
        }

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;
    }
}
```

---

## 6. Arquivo .env

**.env**:

```bash
# Database
DB_USER=appuser
DB_PASSWORD=senha_forte_muito_segura_aqui
DB_NAME=appdb

# Backend
JWT_SECRET=seu_segredo_jwt_muito_forte_aqui_minimo_32_chars
PORT=3000
NODE_ENV=production

# Webhooks
WEBHOOK_SECRET=seu_segredo_webhook_aqui

# ElevenLabs (opcional)
ELEVENLABS_API_KEY=sua_api_key_elevenlabs

# Evolution API (WhatsApp)
EVOLUTION_API_URL=https://seu-evolution-api.com
EVOLUTION_API_KEY=sua_api_key_evolution

# Asaas (opcional)
ASAAS_API_KEY=sua_api_key_asaas
```

---

## 7. Comandos para gerenciar o projeto

### 7.1. Primeira vez (setup inicial)

```bash
# Clonar repositório
git clone https://github.com/seu-usuario/seu-repo.git /var/www/projeto
cd /var/www/projeto

# Criar arquivo .env
cp .env.example .env
nano .env  # Editar com valores reais

# Build e iniciar containers
docker-compose up -d --build

# Ver logs
docker-compose logs -f
```

### 7.2. Deploy de atualizações

```bash
cd /var/www/projeto

# Atualizar código
git pull origin main

# Rebuild backend (se houver mudanças)
docker-compose up -d --build backend

# Rebuild frontend (se houver mudanças)
cd frontend
npm run build
cd ..
docker-compose restart nginx
```

### 7.3. Ver status dos containers

```bash
docker-compose ps
```

### 7.4. Ver logs

```bash
# Todos os containers
docker-compose logs -f

# Apenas backend
docker-compose logs -f backend

# Apenas nginx
docker-compose logs -f nginx
```

### 7.5. Reiniciar serviços

```bash
# Reiniciar todos
docker-compose restart

# Reiniciar apenas backend
docker-compose restart backend
```

### 7.6. Parar tudo

```bash
docker-compose down
```

### 7.7. Parar e remover volumes (limpar banco)

```bash
docker-compose down -v
```

---

## 8. Configurar SSL (primeira vez)

1. **Iniciar sem SSL**:
   
   Primeiro, comente as linhas de SSL no `nginx.conf` (server 443) e inicie apenas com HTTP:
   
   ```bash
   docker-compose up -d
   ```

2. **Obter certificado**:
   
   ```bash
   docker-compose run --rm certbot certonly --webroot \
     --webroot-path=/var/www/certbot \
     -d seudominio.com -d www.seudominio.com \
     --email seu-email@exemplo.com \
     --agree-tos \
     --no-eff-email
   ```

3. **Habilitar SSL**:
   
   Descomente as linhas de SSL no `nginx.conf` e reinicie:
   
   ```bash
   docker-compose restart nginx
   ```

---

## 9. Backup automatizado

### 9.1. Script de backup

**backup.sh**:

```bash
#!/bin/bash

BACKUP_DIR="/var/backups/projeto"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$DATE.sql"

mkdir -p $BACKUP_DIR

# Backup do banco de dados
docker exec projeto-db pg_dump -U appuser appdb > $BACKUP_FILE

# Comprimir
gzip $BACKUP_FILE

# Manter apenas os últimos 7 backups
ls -t $BACKUP_DIR/backup_*.sql.gz | tail -n +8 | xargs rm -f

echo "Backup concluído: $BACKUP_FILE.gz"
```

### 9.2. Configurar cron

```bash
chmod +x backup.sh

crontab -e

# Adicionar:
0 3 * * * /var/www/projeto/backup.sh
```

---

## 10. Monitoramento

### 10.1. Verificar saúde dos containers

```bash
docker ps
docker stats
```

### 10.2. Ver uso de recursos

```bash
docker stats projeto-api projeto-db projeto-nginx
```

### 10.3. Ver logs de erro

```bash
docker-compose logs --tail=100 backend | grep -i error
```

---

## 11. Troubleshooting

### Problema: Container não inicia

```bash
# Ver logs detalhados
docker-compose logs backend

# Reiniciar container
docker-compose restart backend
```

### Problema: Banco de dados não conecta

```bash
# Verificar se o PostgreSQL está rodando
docker exec projeto-db pg_isready -U appuser

# Conectar ao banco manualmente
docker exec -it projeto-db psql -U appuser -d appdb
```

### Problema: SSL não funciona

```bash
# Verificar certificados
docker exec projeto-nginx ls -la /etc/letsencrypt/live/seudominio.com/

# Renovar certificado
docker-compose run --rm certbot renew
```

---

**Fim do documento de Docker Compose para VPS.**
