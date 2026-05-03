# Como fazer deploy do Guilherme Agent na Railway

## ✅ Status do projeto
- [x] Código completo
- [x] Build testado e funcionando
- [ ] Deploy na Railway (precisa de token válido)

## ⚠️ Problema do Token Railway
O token `f135e178-8930-4562-b51b-128c2abaa1d1` está retornando "Unauthorized".

**Para criar um token válido:**
1. Acesse https://railway.app
2. Clique no seu foto/avatar (canto superior direito)
3. Vá em **Account Settings**
4. Clique na aba **Tokens**
5. Clique em **New Token**
6. Dê o nome "claude-deploy"
7. Escopo: **Full Account**
8. Copie o token gerado

## 🚀 Passos para deploy (com token válido)

Abra o terminal Claude Code e execute:

```
RAILWAY_TOKEN=SEU_TOKEN_AQUI bash .railway/deploy.sh
```

Ou passo a passo manual:

### 1. Login Railway
```bash
export RAILWAY_TOKEN=SEU_TOKEN_AQUI
cd "C:\Users\user\Desktop\cursor novo\guilherme-agent"
railway whoami
```

### 2. Criar projeto
```bash
railway init --name guilherme-agent
```

### 3. Adicionar Postgres
```bash
railway add --database postgres < /dev/null & sleep 15 && kill %1; wait
```

### 4. Gerar URL do app
```bash
railway domain --service app
```

### 5. Configurar variáveis (substituir SEU_APP_URL e POSTGRES_URL)
```bash
AUTH_SECRET=$(openssl rand -hex 32)
railway variable set \
  ANTHROPIC_API_KEY="sua-chave-anthropic-aqui" \
  EVOLUTION_BASE_URL="http://177.7.35.65:8080" \
  EVOLUTION_API_KEY="sua-evolution-api-key-aqui" \
  EVOLUTION_INSTANCE="default" \
  AUTH_SECRET="$AUTH_SECRET" \
  NEXT_PUBLIC_APP_URL="https://SEU-APP.up.railway.app" \
  NODE_ENV="production" \
  --skip-deploys
```

### 6. Deploy
```bash
cd apps/web
railway up --service app --detach
```

### 7. Rodar migrations (após o build terminar ~5min)
```bash
railway run --service app npx prisma migrate deploy
railway run --service app npx tsx prisma/seed.ts
```

## 🔑 Credenciais de acesso ao painel
- **URL:** https://SEU-APP.up.railway.app
- **Email:** guigaredesocial@gmail.com
- **Senha:** Guilherme2026!

## 📱 Conectar WhatsApp
1. Acesse o painel → clique em **QR Code**
2. Abra o WhatsApp no celular
3. Dispositivos Conectados → Conectar dispositivo
4. Escaneie o QR Code

## ✅ Verificação final
- [ ] `https://SEU-APP.up.railway.app/api/health` retorna `{"ok":true,"evolution":"WORKING"}`
- [ ] Login no painel funciona
- [ ] QR Code aparece e WhatsApp conecta
- [ ] Enviar mensagem de teste para o número 557183891648
