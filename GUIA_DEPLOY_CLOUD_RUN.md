# 🚀 Guia de Deploy no Google Cloud Run

## Por que Cloud Run?

Cloud Run é superior ao App Engine para este projeto:
- ✅ **Containerização**: Total controle sobre o ambiente
- ✅ **Escala para zero**: Não paga quando não está em uso
- ✅ **Deploy mais rápido**: ~2 minutos vs ~5-10 do App Engine
- ✅ **Mais barato**: Paga apenas pelo uso real
- ✅ **Melhor integração**: Com Docker e CI/CD

---

## 📋 Pré-requisitos

- ✅ Extensão **Google Cloud Code** instalada no VS Code
- ✅ Projeto **atividades-intel** no Google Cloud
- ✅ Conta com billing ativado

---

## 🔧 Passo 1: Preparar as Credenciais OAuth2

### 1.1 Atualizar Origens Autorizadas

1. Acesse: https://console.cloud.google.com/apis/credentials
2. Clique no Client ID: `945799576026-7dp9aeogap6hmrldi4kpedchitnirci5`
3. Adicione às **Authorized JavaScript origins**:
   ```
   http://localhost:8000
   https://atividades-intel-XXXXXXXX.run.app
   ```
   *Nota: A URL exata do Cloud Run será mostrada após o primeiro deploy*

4. Adicione aos **Authorized redirect URIs**:
   ```
   http://localhost:8000
   https://atividades-intel-XXXXXXXX.run.app
   ```

5. Clique em **Save**

### 1.2 Gerar SECRET_KEY Forte

No terminal do VS Code:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Copie o resultado (você vai usar no passo 3.3).

---

## 🔐 Passo 2: Habilitar APIs Necessárias

No terminal do VS Code:

```powershell
gcloud auth login
gcloud config set project atividades-intel
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable firestore.googleapis.com
```

---

## 🚀 Passo 3: Deploy via Cloud Code (VS Code)

### 3.1 Iniciar o Deploy

1. Pressione `Ctrl+Shift+P` (Command Palette)
2. Digite: **`Cloud Code: Deploy to Cloud Run`**
3. Selecione **`Create a new service`**

### 3.2 Configurar o Serviço

Quando solicitado, configure:

- **Service name**: `atividades-bdi-serra`
- **Region**: `us-central1` (ou `southamerica-east1` se disponível)
- **Platform**: `Cloud Run (fully managed)`
- **Allow unauthenticated requests**: `Yes` (o backend controla auth)

### 3.3 Configurar Variáveis de Ambiente

Após o deploy inicial, configure as variáveis de ambiente:

1. Acesse: https://console.cloud.google.com/run
2. Clique no serviço `atividades-bdi-serra`
3. Clique em **EDIT & DEPLOY NEW REVISION**
4. Vá até **Container > Variables & Secrets**
5. Adicione as seguintes variáveis:

```bash
GOOGLE_CLOUD_PROJECT=atividades-intel
GOOGLE_CLIENT_ID=945799576026-7dp9aeogap6hmrldi4kpedchitnirci5.apps.googleusercontent.com
SECRET_KEY=[COLE_A_CHAVE_FORTE_GERADA]
USE_MOCK_FIRESTORE=false
DEV_AUTH=false
ENVIRONMENT=production
PORT=8080
```

6. Clique em **DEPLOY**

---

## 🔄 Passo 4: Atualizar URL no OAuth2

Após o deploy bem-sucedido:

1. Copie a URL gerada (ex: `https://atividades-bdi-serra-XXXXXXXX.run.app`)
2. Volte para: https://console.cloud.google.com/apis/credentials
3. Edite o Client ID
4. **Substitua** `https://atividades-intel-XXXXXXXX.run.app` pela URL real
5. Salve

---

## 🗄️ Passo 5: Verificar Firestore

### 5.1 Certificar que o Firestore está Configurado

```powershell
gcloud firestore databases list
```

Deve mostrar: `(default)` em `nam5`

### 5.2 Verificar/Criar Usuários Autorizados

1. Acesse: https://console.cloud.google.com/firestore/data
2. Collection: `usuarios`
3. Certifique-se de ter pelo menos um usuário:

```json
{
  "email": "seu-email@gmail.com",
  "nome": "Seu Nome",
  "nivel": "administrador",
  "ativo": true
}
```

---

## ✅ Passo 6: Testar a Aplicação

### 6.1 Acessar a Aplicação

```powershell
gcloud run services describe atividades-bdi-serra --region=us-central1 --format="value(status.url)"
```

Ou acesse diretamente pelo console.

### 6.2 Testar Login

1. Acesse a URL do Cloud Run
2. Deve aparecer o botão **"Entrar com Google"**
3. Clique e autentique
4. Verifique se consegue acessar o dashboard

---

## 📊 Comandos Úteis

### Ver Logs em Tempo Real

Via VS Code:
- Cloud Code sidebar → **Logs Explorer**

Via Terminal:
```powershell
gcloud run services logs read atividades-bdi-serra --region=us-central1 --tail
```

### Ver Informações do Serviço

```powershell
gcloud run services describe atividades-bdi-serra --region=us-central1
```

### Listar Revisões

```powershell
gcloud run revisions list --service=atividades-bdi-serra --region=us-central1
```

### Fazer Deploy Manual (sem VS Code)

```powershell
gcloud run deploy atividades-bdi-serra `
  --source . `
  --region=us-central1 `
  --allow-unauthenticated `
  --set-env-vars="GOOGLE_CLOUD_PROJECT=atividades-intel,GOOGLE_CLIENT_ID=945799576026-7dp9aeogap6hmrldi4kpedchitnirci5.apps.googleusercontent.com,SECRET_KEY=YOUR_SECRET,USE_MOCK_FIRESTORE=false,DEV_AUTH=false"
```

---

## 🛠️ Troubleshooting

### ❌ Erro: "Container failed to start"

**Solução:**
```powershell
gcloud run services logs read atividades-bdi-serra --region=us-central1 --limit=50
```

Verifique se todas as variáveis de ambiente estão configuradas.

### ❌ Erro: "Token Google inválido"

**Causa**: URL não está nas origens autorizadas

**Solução:**
1. Verifique a URL exata do Cloud Run
2. Adicione nas origens autorizadas do OAuth2

### ❌ Erro: "Usuário não autorizado"

**Causa**: Email não está no Firestore

**Solução:**
1. Adicione o email na collection `usuarios`
2. Certifique-se de que `ativo: true`

---

## 💰 Custos Estimados

### Cloud Run Free Tier (Mensal)

- 2 milhões de requisições
- 360.000 GB-segundos de memória
- 180.000 vCPU-segundos

### Estimativa para Uso Moderado

- ~100 usuários/dia
- ~1000 requisições/dia
- **Custo estimado**: $0-5/mês

### Firestore

- Free tier: 50.000 leituras/dia
- Com cache (30 dias): economia de 98%
- **Custo estimado**: $0-2/mês

---

## 🔒 Checklist de Segurança

- [ ] `DEV_AUTH=false` nas variáveis de ambiente
- [ ] `SECRET_KEY` forte e única configurada
- [ ] URLs do Cloud Run nas origens OAuth2
- [ ] Apenas emails autorizados no Firestore
- [ ] HTTPS automático (Cloud Run)
- [ ] Logs monitorados

---

## 🔄 Atualizações Futuras

Para fazer deploy de uma nova versão:

### Via VS Code (Recomendado)

1. `Ctrl+Shift+P`
2. `Cloud Code: Deploy to Cloud Run`
3. Selecione o serviço existente
4. Confirme

### Via Terminal

```powershell
gcloud run deploy atividades-bdi-serra --source . --region=us-central1
```

O Cloud Run faz **zero-downtime deployment** automaticamente!

---

## 📚 Recursos

- [Documentação Cloud Run](https://cloud.google.com/run/docs)
- [Preços Cloud Run](https://cloud.google.com/run/pricing)
- [Firestore Docs](https://cloud.google.com/firestore/docs)

---

**Pronto para o deploy! 🚀**

*Cloud Run é a escolha moderna para aplicações containerizadas no Google Cloud.*
