# 🚀 Guia Completo de Deploy no Google Cloud Platform

## 📋 Pré-requisitos

Antes de fazer o deploy, você precisa:

1. ✅ Conta no Google Cloud Platform
2. ✅ Extensão Google Cloud Code instalada no VS Code
3. ✅ Projeto criado no Google Cloud Console
4. ✅ Billing (faturamento) ativado no projeto
5. ✅ APIs necessárias habilitadas

---

## 🔧 Passo 1: Configurar o Projeto no Google Cloud

### 1.1 Criar/Selecionar Projeto

No VS Code com a extensão Google Cloud Code:

1. Pressione `Ctrl+Shift+P` (ou `Cmd+Shift+P` no Mac)
2. Digite: `Cloud Code: New Application`
3. Ou acesse pela barra lateral do Cloud Code

Alternativamente, no [Google Cloud Console](https://console.cloud.google.com/):

1. Vá para: https://console.cloud.google.com/
2. Clique em "Select a project" no topo
3. Selecione o projeto existente: **atividades-intel** (ID: 945799576026)
   - Ou crie um novo se preferir: `atividades-bdi-serra`
4. Anote o **Project ID** (será necessário depois)

### 1.2 Habilitar APIs Necessárias

Execute no terminal integrado do VS Code ou no Cloud Shell:

```bash
# Faça login no gcloud
gcloud auth login

# Configure o projeto
gcloud config set project SEU-PROJECT-ID

# Habilite as APIs necessárias
gcloud services enable appengine.googleapis.com
gcloud services enable firestore.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

Ou habilite manualmente no [Console](https://console.cloud.google.com/apis/library):
- Cloud Firestore API
- App Engine Admin API
- Cloud Build API

### 1.3 Inicializar App Engine

```bash
# Inicializar App Engine (escolha a região mais próxima, ex: southamerica-east1)
gcloud app create --region=southamerica-east1
```

---

## 🔐 Passo 2: Configurar Autenticação Google OAuth2

### 2.1 Criar Credenciais OAuth2

1. Vá para: https://console.cloud.google.com/apis/credentials
2. Clique em **"Create Credentials"** → **"OAuth 2.0 Client IDs"**
3. Se solicitado, configure a tela de consentimento primeiro:
   - Tipo: **Internal** (apenas usuários da sua organização) ou **External**
   - Nome: `Atividades BDI Serra`
   - Email de suporte: seu email
   - Domínios autorizados: adicione seu domínio se tiver
   - Salve

4. Editar OAuth Client ID existente:
   - Você já tem: `945799576026-7dp9aeogap6hmrldi4kpedchitnirci5.apps.googleusercontent.com`
   - Vá para: https://console.cloud.google.com/apis/credentials
   - Clique no Client ID existente para editá-lo
   - **IMPORTANTE:** Adicione as seguintes URLs às origens JavaScript autorizadas:
     ```
     http://localhost:8000
     https://atividades-intel.uc.r.appspot.com
     ```
   - E aos URIs de redirecionamento autorizados:
     ```
     http://localhost:8000
     https://atividades-intel.uc.r.appspot.com
     ```
   - Clique em **Save**

5. O Client ID já está configurado: `945799576026-7dp9aeogap6hmrldi4kpedchitnirci5.apps.googleusercontent.com`

### 2.2 Configurar Firestore

1. Vá para: https://console.cloud.google.com/firestore
2. Clique em **"Create Database"**
3. Escolha:
   - **Firestore Native Mode** (recomendado)
   - Location: `southamerica-east1` (São Paulo) ou mais próximo
   - Start in **production mode**
4. Aguarde a criação do banco

### 2.3 Migrar Dados para o Firestore

Se você tem dados locais (no mock), migre para o Firestore real:

```bash
# Configure para usar Firestore real temporariamente
# Edite o arquivo .env:
USE_MOCK_FIRESTORE=false

# Execute o script de migração
python migrate_firestore.py migrate
```

### 2.4 Criar Usuários Autorizados

Você precisa adicionar os usuários que terão acesso ao sistema:

```bash
# Edite o arquivo create_usuarios.py com os emails autorizados
# Depois execute:
python create_usuarios.py
```

Ou adicione manualmente no Firestore Console:
1. Collection: `usuarios`
2. Document ID: auto ou personalizado
3. Campos:
   ```json
   {
     "email": "usuario@gmail.com",
     "nome": "Nome do Usuário",
     "nivel": "administrador",
     "ativo": true
   }
   ```

---

## ⚙️ Passo 3: Configurar o app.yaml

Edite o arquivo [app.yaml](app.yaml) e substitua os valores:

```yaml
env_variables:
  GOOGLE_CLOUD_PROJECT: "SEU-PROJECT-ID"
  GOOGLE_CLIENT_ID: "SEU-CLIENT-ID.apps.googleusercontent.com"
  SECRET_KEY: "GERE-UMA-CHAVE-FORTE-AQUI"
  USE_MOCK_FIRESTORE: "false"
  DEV_AUTH: "false"  # NUNCA true em produção!
```

### Gerar uma SECRET_KEY forte:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Copie a saída e cole em `SECRET_KEY` no app.yaml.

---

## 🔄 Passo 4: Atualizar o Frontend com o Client ID

Edite o arquivo [static/login-google.html](static/login-google.html):

Substitua:
```javascript
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID';
```

Por:
```javascript
const GOOGLE_CLIENT_ID = 'SEU-CLIENT-ID.apps.googleusercontent.com';
```

---

## 🚀 Passo 5: Fazer o Deploy

### 5.1 Deploy via VS Code (Recomendado)

1. Abra a Command Palette (`Ctrl+Shift+P`)
2. Digite: `Cloud Code: Deploy to App Engine`
3. Selecione seu projeto
4. Selecione o arquivo `app.yaml`
5. Confirme o deploy
6. Acompanhe o progresso no terminal

### 5.2 Deploy via Terminal/Cloud Shell

```bash
# Certifique-se de estar no diretório do projeto
cd c:\dev\atividades-bdi-serra

# Faça o deploy
gcloud app deploy

# Ou especifique o app.yaml
gcloud app deploy app.yaml

# Aguarde o processo (pode levar alguns minutos)
```

### 5.3 Abrir a Aplicação

Após o deploy bem-sucedido:

```bash
gcloud app browse
```

Ou acesse diretamente:
```
https://SEU-PROJECT-ID.uc.r.appspot.com
```

---

## 🔍 Passo 6: Verificar e Testar

### 6.1 Verificar Logs

Via VS Code:
1. Cloud Code sidebar → Logs Explorer
2. Filtre por seu serviço

Via Terminal:
```bash
gcloud app logs tail -s default
```

Via Console:
https://console.cloud.google.com/logs

### 6.2 Testar a Autenticação

1. Acesse a URL da aplicação
2. Deve aparecer o botão **"Entrar com Google"**
3. Clique e autentique com um email autorizado
4. Você deve ser redirecionado para o dashboard

### 6.3 Verificar Permissões

Teste com diferentes níveis de usuário:
- **Administrador**: acesso total
- **Operador**: pode criar atividades
- **Visualizador**: apenas leitura

---

## 🛠️ Troubleshooting

### ❌ Erro: "Token Google inválido"

**Causa**: Client ID incorreto ou não configurado

**Solução**:
1. Verifique se o `GOOGLE_CLIENT_ID` no `app.yaml` está correto
2. Verifique se o `GOOGLE_CLIENT_ID` no `login-google.html` está correto
3. Verifique se os domínios autorizados no OAuth2 incluem seu App Engine URL

### ❌ Erro: "Usuário não autorizado"

**Causa**: Email não está na coleção `usuarios` do Firestore

**Solução**:
1. Acesse o Firestore Console
2. Verifique se o email está na collection `usuarios`
3. Verifique se o campo `ativo` é `true`
4. Verifique se o `nivel` está correto

### ❌ Erro: "Failed to fetch"

**Causa**: CORS ou problema de conectividade

**Solução**:
1. Verifique os logs do App Engine
2. Verifique se as APIs estão habilitadas
3. Tente fazer deploy novamente

### ❌ Erro ao fazer deploy: "Permission denied"

**Solução**:
```bash
# Re-autentique
gcloud auth login

# Configure as permissões
gcloud auth application-default login
```

---

## 📊 Monitoramento e Manutenção

### Ver estatísticas do App Engine

```bash
# Status dos serviços
gcloud app services list

# Versões deployadas
gcloud app versions list

# Instâncias rodando
gcloud app instances list
```

### Atualizar a aplicação

Após fazer mudanças no código:

```bash
# Deploy da nova versão
gcloud app deploy

# Ou especifique uma versão
gcloud app deploy --version=v2
```

### Gerenciar versões

```bash
# Listar versões
gcloud app versions list

# Direcionar tráfego para uma versão específica
gcloud app services set-traffic default --splits v2=1

# Deletar versão antiga
gcloud app versions delete v1
```

---

## 💰 Custos e Limites

### Free Tier do App Engine

- 28 horas de instância F1 por dia
- 1 GB de saída de rede por dia
- Recursos compartilhados

### Firestore Free Tier

- 1 GB de armazenamento
- 50.000 leituras por dia
- 20.000 escritas por dia
- 20.000 exclusões por dia

### Monitorar custos

https://console.cloud.google.com/billing

---

## 🔒 Segurança em Produção

### ✅ Checklist de Segurança

- [ ] `DEV_AUTH=false` no app.yaml
- [ ] `SECRET_KEY` forte e única (mínimo 32 caracteres)
- [ ] CORS configurado com domínios específicos (não `*`)
- [ ] Credenciais OAuth2 configuradas corretamente
- [ ] Apenas emails autorizados na collection `usuarios`
- [ ] Regras de segurança do Firestore configuradas
- [ ] HTTPS habilitado (automático no App Engine)
- [ ] Logs monitorados regularmente

### Regras de Segurança do Firestore

Recomendado: Configure regras no Firestore Console

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Negar acesso por padrão
    match /{document=**} {
      allow read, write: if false;
    }
    
    // Permitir acesso apenas via backend autenticado
    // O backend usa credenciais de serviço
  }
}
```

---

## 📚 Recursos Adicionais

- [Documentação App Engine](https://cloud.google.com/appengine/docs)
- [Documentação Firestore](https://cloud.google.com/firestore/docs)
- [Google OAuth2](https://developers.google.com/identity/protocols/oauth2)
- [Cloud Code for VS Code](https://cloud.google.com/code/docs/vscode)

---

## 🆘 Suporte

Se encontrar problemas:

1. Verifique os logs: `gcloud app logs tail -s default`
2. Consulte este guia novamente
3. Verifique a documentação oficial do Google Cloud

---

**Boa sorte com seu deploy! 🚀**
