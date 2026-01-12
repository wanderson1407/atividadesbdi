# MARCA 2 - Atividades BDI Serra

**Data:** 07 de janeiro de 2026  
**Versão:** 2.0  
**Status:** ✅ Funcional

---

## Resumo desta Marcação

Esta marcação representa o segundo ponto estável do projeto com todas as funcionalidades principais do Dashboard, filtros e inserção de atividades funcionando corretamente.

## Funcionalidades Implementadas

### 1. Dashboard Principal
- ✅ Filtros por data (início e fim)
- ✅ Filtros por equipes (múltipla seleção com ✓Todas/✗Nenhuma)
- ✅ Filtros por categorias (múltipla seleção)
- ✅ Filtros por produtos (múltipla seleção)
- ✅ Busca textual
- ✅ Seleção automática de todas as opções ao carregar
- ✅ KPIs: Total de QTCs, QTCs Internos, Ações Conjuntas
- ✅ KPIs: Categoria 11 (Veículos) e Categoria 7 (Pessoas) - soma das quantidades
- ✅ Gráfico de atividades por data
- ✅ Gráfico de atividades por equipe
- ✅ Tabela de atividades com todas as informações
- ✅ Exportar PDF

### 2. Inserir Nova Atividade
- ✅ Formulário completo com data, CAI, descrição
- ✅ Seleção de múltiplas equipes
- ✅ Tabela de produtos com:
  - Campo de busca com autocomplete (ordenado alfabeticamente)
  - Quantidade com validação por tipo (inteiro, decimal, moeda)
  - Campo informativo Medida/Tipo (readonly)
  - Categoria preenchida automaticamente (readonly)
  - Botão remover produto
  - Cabeçalho com fundo cinza claro e texto preto
- ✅ Botão + Adicionar Produto
- ✅ Categorias derivadas automaticamente dos produtos selecionados

### 3. Atividades Cadastradas
- ✅ Layout idêntico ao Dashboard (mesmas classes CSS)
- ✅ Todos os filtros funcionais
- ✅ Seleção automática de todas as opções
- ✅ Contador de resultados
- ✅ Tabela com todas as colunas (ID, Data, Equipes, Categorias, Produtos, Descrição, CAI)
- ✅ Botão voltar ao Dashboard

### 4. Autenticação
- ✅ Login via Google OAuth (preparado)
- ✅ Modo desenvolvimento com DEV_AUTH=true aceita dummy_token
- ✅ Página autologin.html para desenvolvimento
- ✅ Proteção de rotas com JWT

### 5. Backend (FastAPI)
- ✅ Endpoints RESTful para todas as entidades
- ✅ Filtros server-side otimizados
- ✅ Filtro por categoria via produtos (não mais pelo campo vazio da atividade)
- ✅ CORS configurado para desenvolvimento
- ✅ MockFirestoreClient para desenvolvimento local

## Correções Importantes nesta Versão

1. **Race Condition no Token**: Adicionadas funções `refreshToken()` e `waitForToken()` para garantir que o token esteja disponível antes das requisições

2. **Filtro por Categoria**: Corrigido tanto no backend (`firestore_repo.py`) quanto no frontend (`filterActivities`) para usar as categorias dos **produtos** vinculados às atividades, não o campo `categorias` da atividade (que estava vazio)

3. **KPIs de Categoria 11 e 7**: Agora somam as **quantidades** dos produtos dessas categorias, não apenas contam atividades

4. **Seleção Automática**: Todas as opções de equipes, categorias e produtos são selecionadas por padrão ao carregar

## Estrutura de Arquivos Principais

```
atividades-bdi-serra/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app, rotas
│   ├── auth.py              # Autenticação JWT, Google OAuth
│   └── firestore_repo.py    # Repository pattern, MockFirestoreClient
├── static/
│   ├── script.js            # Lógica frontend (1050+ linhas)
│   ├── login.html           # Página de login
│   ├── autologin.html       # Auto-login para desenvolvimento
│   └── teste.html           # Página de teste de API
├── index.html               # Dashboard principal
├── requirements.txt         # Dependências Python
├── .env                     # Variáveis de ambiente (DEV_AUTH=true)
├── mock_firestore_atividades-bdi.json  # Dados mock (445 atividades)
├── MARCA_1.md               # Marcação anterior
└── MARCA_2.md               # Esta marcação
```

## Dados Atuais

- **445 atividades** importadas
- **71 atividades** em 2025
- **26 produtos** cadastrados
- **11 equipes** cadastradas
- **12 categorias** cadastradas

## Como Executar

```bash
# Ativar ambiente virtual
.\venv\Scripts\Activate.ps1

# Iniciar servidor
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# Acessar aplicação
# http://localhost:8000/static/autologin.html (desenvolvimento)
# http://localhost:8000/ (após autenticação)
```

## Próximos Passos Sugeridos

1. Implementar edição de atividades existentes
2. Implementar exclusão de atividades
3. Cadastro de novas equipes, categorias e produtos
4. Integração com Firestore real (Google Cloud)
5. Deploy no Google Cloud Run
6. Autenticação Google OAuth real (não dummy)

---

**Marcação criada em:** 07/01/2026  
**Desenvolvido com auxílio de:** GitHub Copilot (Claude Opus 4.5)
