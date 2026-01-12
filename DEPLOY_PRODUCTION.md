# 🚀 Guia de Deploy para Produção

## 📋 Checklist Pré-Produção

### 1. **Preparar Dados no Firestore Real**

Antes de ir para produção, você precisa migrar os dados do MockFirestore (arquivo JSON local) para o Google Cloud Firestore real.

#### Passo 1: Verificar estado atual do Firestore
```bash
python migrate_firestore.py verify
```

Isso vai mostrar quais dados já existem no Firestore real e se estão completos.

#### Passo 2: Migrar dados do Mock para o Firestore real
```bash
python migrate_firestore.py migrate
```

Este script vai:
- ✅ Copiar todos os usuários, equipes, categorias, produtos e atividades
- ✅ Validar que os dados estão completos (campos obrigatórios presentes)
- ✅ Sobrescrever dados existentes (cuidado!)

---

### 2. **Testar com Firestore Real (Ambiente de Staging)**

Antes de ir para produção, teste com o Firestore real em ambiente de desenvolvimento:

#### Passo 1: Criar arquivo `.env` com configuração de teste
```bash
# .env
USE_MOCK_FIRESTORE=false  # <-- Usar Firestore real
DEV_AUTH=true              # <-- Ainda em modo dev
DEV_USER_EMAIL=seu-email@gmail.com
SECRET_KEY=your-secret-key
```

#### Passo 2: Reiniciar o servidor
```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Você deve ver no console:
```
☁️ Usando Google Cloud Firestore
```

#### Passo 3: Testar todas as funcionalidades
- [ ] Login funciona
- [ ] Dashboard carrega atividades
- [ ] Cadastro de atividades funciona
- [ ] CRUD de Equipes/Categorias/Produtos/Usuários funciona
- [ ] Relatórios funcionam
- [ ] Filtros e buscas funcionam

---

### 3. **Configurar Produção**

#### Arquivo `.env` de Produção:
```bash
# .env (PRODUÇÃO)
USE_MOCK_FIRESTORE=false    # Firestore real
DEV_AUTH=false               # Autenticação real do Google
SECRET_KEY=<chave-super-secreta-gerada-aleatoriamente>
GOOGLE_CLIENT_ID=<seu-client-id>.apps.googleusercontent.com
```

#### Gerar SECRET_KEY segura:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## 🔄 Processo de Migração de Dados

### Estrutura de Dados Esperada no Firestore

#### Coleção: `usuarios`
```json
{
  "email": "usuario@exemplo.com",
  "nome": "Nome do Usuário",
  "nivel": "administrador" | "operador" | "inativo"
}
```
**Chave do documento:** `email` do usuário

#### Coleção: `equipes`
```json
{
  "id_equipe": 1,
  "equipe": "Nome da Equipe",
  "interno_prf": true | false
}
```
**Chave do documento:** `id_equipe` (string)

#### Coleção: `categorias`
```json
{
  "id_categoria_atividade": 1,
  "categoria_atividade": "Nome da Categoria"
}
```
**Chave do documento:** `id_categoria_atividade` (string)

#### Coleção: `produtos`
```json
{
  "id_produto_atividade": 1,
  "id_categoria_atividade": 1,
  "produto_atividade": "Nome do Produto",
  "medida": "unidade",
  "tipo_numero": "inteiro" | "decimal" | "moeda"
}
```
**Chave do documento:** `id_produto_atividade` (string)

#### Coleção: `atividades`
```json
{
  "id_atividade": 1,
  "data": "2024-01-15",
  "descricao": "Descrição da atividade",
  "cai": true | false,
  "equipes": [1, 2, 3],
  "categorias": [1, 2],
  "produtos": [
    {"id_produto": 1, "quantidade": 10.5},
    {"id_produto": 2, "quantidade": 5}
  ]
}
```
**Chave do documento:** `id_atividade` (string)

---

## ⚠️ Problemas Comuns e Soluções

### Problema 1: "Nenhum usuário cadastrado" ou dados vazios

**Causa:** Dados incompletos no Firestore real (faltam campos obrigatórios)

**Solução:**
```bash
# 1. Verificar o problema
python migrate_firestore.py verify

# 2. Corrigir migrando dados corretos
python migrate_firestore.py migrate
```

### Problema 2: Erro de validação Pydantic

**Causa:** Documento no Firestore sem campos obrigatórios

**Exemplo de erro:**
```
ValidationError: 2 validation errors for Usuario
email: Field required
nivel: Field required
```

**Solução:** Use o script de migração ou corrija manualmente no Console do Firebase

### Problema 3: "USE_MOCK_FIRESTORE not defined"

**Causa:** Variável de ambiente não definida

**Solução:**
```bash
# Criar arquivo .env
cp .env.example .env

# Ou definir diretamente
export USE_MOCK_FIRESTORE=false  # Linux/Mac
$env:USE_MOCK_FIRESTORE="false"  # Windows PowerShell
```

---

## 🧪 Testes Antes de Produção

### Teste 1: Listar Usuários
```bash
curl -X GET "http://localhost:8000/usuarios" \
  -H "Authorization: Bearer dummy_token"
```

Deve retornar array com usuários completos (email, nome, nivel).

### Teste 2: Criar Equipe
```bash
curl -X POST "http://localhost:8000/equipes" \
  -H "Authorization: Bearer dummy_token" \
  -H "Content-Type: application/json" \
  -d '{"equipe":"Teste","interno_prf":true}'
```

Deve criar sem especificar `id_equipe` (auto-incremento).

### Teste 3: Atualizar Produto
```bash
curl -X PUT "http://localhost:8000/produtos/1" \
  -H "Authorization: Bearer dummy_token" \
  -H "Content-Type: application/json" \
  -d '{"id_categoria_atividade":1,"produto_atividade":"Produto Atualizado","medida":"kg","tipo_numero":"decimal"}'
```

### Teste 4: Excluir Categoria
```bash
curl -X DELETE "http://localhost:8000/categorias/99" \
  -H "Authorization: Bearer dummy_token"
```

---

## 📊 Monitoramento em Produção

### Logs importantes para monitorar:

1. **Tipo de banco usado:**
   ```
   🔧 Usando MockFirestoreClient (desenvolvimento)  ← DEV
   ☁️ Usando Google Cloud Firestore                 ← PRODUÇÃO
   ```

2. **Erros de validação Pydantic:** Indicam dados incompletos

3. **Erros 500:** Geralmente problemas de conexão ou dados

---

## 🔐 Segurança em Produção

- ✅ **USE_MOCK_FIRESTORE=false** (usar banco real)
- ✅ **DEV_AUTH=false** (desabilitar modo dev)
- ✅ **SECRET_KEY** gerada aleatoriamente (não usar default)
- ✅ **GOOGLE_CLIENT_ID** configurado corretamente
- ✅ Configurar regras de segurança no Firestore
- ✅ Habilitar HTTPS
- ✅ Configurar CORS adequadamente

---

## 📝 Resumo

1. **Desenvolvimento:** `USE_MOCK_FIRESTORE=true` (dados locais JSON)
2. **Teste/Staging:** `USE_MOCK_FIRESTORE=false` + `DEV_AUTH=true` (Firestore real + auth dev)
3. **Produção:** `USE_MOCK_FIRESTORE=false` + `DEV_AUTH=false` (tudo real)

**Comando para ir para produção:**
```bash
# 1. Migrar dados
python migrate_firestore.py migrate

# 2. Configurar .env
USE_MOCK_FIRESTORE=false
DEV_AUTH=false

# 3. Reiniciar servidor
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```
