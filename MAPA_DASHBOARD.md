# MAPA DO DASHBOARD - Atividades BDI Serra

## Estrutura Atual do Dashboard (08/01/2026)

### Filtro - 1
- **Localização:** Topo da página
- **Elementos:** Data Início, Data Fim, Equipes, Categorias, Produtos, Consulta Texto
- **Botões:** Aplicar Filtros, Exportar PDF

---

### Linha 1 - 2 - Título "Indicadores (Filtro)"
- **Tipo:** Título de seção
- **Estilo:** Fundo cinza (var(--pbi-background)), texto negrito, centralizado, cor #1b1464
- **Texto:** "Indicadores (filtro)"

### Linha 2 - 2.1 - Indicadores (QTCs)
- **Layout:** 3 cards em linha
- **Cards:**
  1. Total de QTCs
  2. QTCs Internos
  3. Ações Conjuntas
- **Filtro:** ✅ Respeita filtros (excluindo categorias 3 e 8)

### Linha 3 - 2.2 - Indicadores (Produtos)
- **Layout:** Grid responsivo com 6 cards
- **Cards:**
  1. Veículos Recuperados (Categoria 11)
  2. Pessoas Presas (Categoria 7)
  3. Armas Apreendidas (Produtos 2 e 3)
  4. Munições (Produtos 4 e 5)
  5. Coletivas Imprensa (Produto 43)
  6. Demandas Intel. (Categoria 3)
- **Filtro:** ✅ Respeita filtros

---

### Linha 4 - 3 - Título "Gráficos (filtro)"
- **Tipo:** Título de seção
- **Estilo:** Fundo cinza, texto negrito, centralizado, cor #1b1464
- **Texto:** "Gráficos (filtro)"

### Linha 5 - 3.1 - Gráficos de Análise (2 itens)
- **Layout:** 2 colunas (50% cada)
- **Gráficos:**
  1. Atividades por Equipe (barras verticais)
  2. Produtos Apreendidos no Período (barras horizontais)
- **Filtro:** ✅ Respeita filtros
- **Altura:** 300px (mesmo tamanho dos gráficos da linha 8)

### Linha 6 - 3.2 - Gráficos e Tabelas Detalhadas (3 itens)
- **Layout:** 3 colunas (33% cada)
- **Elementos:**
  1. Demandas de Inteligência (barras horizontais)
  2. Documentos de Inteligência (pizza - produtos 33-38)
  3. Coletivas de Imprensa (tabela: Data | Descrição)
- **Filtro:** ✅ Respeita filtros
- **Altura:** 300px

---

### Linha 7 - 4 - Título "Gráficos (compilados anuais, sem filtro)"
- **Tipo:** Título de seção
- **Estilo:** Fundo cinza, texto negrito, centralizado, cor #1b1464
- **Texto:** "Gráficos (compilados anuais, sem filtro)"

### Linha 8 - 4.1 - Gráficos de Evolução Anual
- **Layout:** 2 colunas (50% cada)
- **Gráficos:**
  1. Evolução Anual - Veículos Recuperados (barras verticais)
  2. Evolução Anual - Pessoas Presas (barras verticais)
- **Filtro:** ❌ Ignora filtros (usa todasAtividades)
- **Altura:** 300px

### Linha 9 - 4.2 - Tabelas Estatísticas (2 itens)
- **Layout:** 2 colunas (50% cada)
- **Tabelas:**
  1. QTCs por Ano (Linhas: QTCs Internos, Ação Conjunta, Total QTCs | Colunas: Anos)
  2. Resultados Operacionais (Linhas: Produto x Categoria | Colunas: Anos)
- **Filtro:** ❌ Ignora filtros (usa todasAtividades)

### Linha 10 - 4.3 - Tabelas de Categorias Específicas (2 itens)
- **Layout:** 2 colunas (50% cada)
- **Tabelas:**
  1. Drogas Apreendidas (Categoria 5 - Linhas: Produtos | Colunas: Anos)
  2. Material Bélico (Categoria 2 - Linhas: Produtos | Colunas: Anos)
- **Filtro:** ❌ Ignora filtros (usa todasAtividades)

---

### Botão Final
- **Texto:** "📋 Abrir Lista de Atividades"
- **Ação:** Transfere filtros do dashboard para a tela de Atividades Cadastradas

---

## Notas de Desenvolvimento

### ⚠️ REGRAS DE DEPENDÊNCIA DE FILTROS (IMPORTANTE!)

**Elementos DEPENDENTES dos filtros (Data Início, Data Fim, Equipes, Categorias, Produtos, Consulta Texto):**
- ✅ Cards indicadores da seção **"Indicadores (filtro)"**:
  - Total de QTCs
  - QTCs Internos
  - Ações Conjuntas
  - Veículos Recuperados
  - Pessoas Presas
  - Armas Apreendidas
  - Munições
  - Coletivas Imprensa
  - Demandas Intel.

- ✅ Todos os elementos da seção **"Gráficos (filtro)"**:
  - Atividades por Equipe
  - Produtos Apreendidos no Período
  - Demandas de Inteligência
  - Documentos de Inteligência
  - Coletivas de Imprensa (tabela)

**Elementos NÃO DEPENDENTES dos filtros (sempre usa todasAtividades - todos os registros do banco):**
- ❌ Todos os elementos da seção **"Gráficos (compilados anuais, sem filtro)"**:
  - Evolução Anual - Veículos Recuperados
  - Evolução Anual - Pessoas Presas
  - QTCs por Ano
  - Resultados Operacionais
  - Drogas Apreendidas
  - Material Bélico

**Motivo:** Os gráficos anuais são comparativos históricos e devem sempre mostrar todos os anos disponíveis no banco, independente do filtro selecionado pelo usuário.

---

### Categorias Especiais
- **Categoria 2:** Material Bélico
- **Categoria 3:** Demandas de Inteligência (não conta como QTC)
- **Categoria 5:** Drogas
- **Categoria 7:** Pessoas
- **Categoria 8:** Não conta como QTC
- **Categoria 11:** Veículos

### Produtos Especiais
- **Produtos 2 e 3:** Armas (Curta e Longa)
- **Produtos 4 e 5:** Munições (Arma Curta e Longa)
- **Produto 43:** Coletiva de Imprensa
- **Produtos 33-38:** Documentos de Inteligência
  - 33: Mensagem
  - 34: RELINT
  - 35: REMI
  - 36: POI
  - 37: PI
  - 38: PS (Pesquisa Social)

### Lógica de QTCs
QTCs são atividades que possuem produtos de **categorias diferentes de 3 e 8** (resultados operacionais).

---

**Última atualização:** 08/01/2026
**Versão:** 1.3 (MARCA 6 - cache 30 dias + validações)
**Cache:** v=20260108u
**Data padrão:** Hoje (não mais ano corrente)
