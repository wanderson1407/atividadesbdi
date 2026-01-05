# Atividades BDI Serra

Sistema de gerenciamento de atividades para BDI Serra utilizando Google Apps Script e Google Sheets como banco de dados.

## Descrição

Esta aplicação foi projetada para gerenciar e visualizar estatísticas de atividades realizadas pela PRF (Polícia Rodoviária Federal) na região de Serra. O sistema utiliza Google Sheets como base de dados e Google Apps Script para o backend e frontend.

## Estrutura do Projeto

```
/
├── src/
│   ├── server/          # Código do servidor (Apps Script)
│   │   ├── Code.gs      # Arquivo principal
│   │   ├── Auth.gs      # Autenticação
│   │   ├── Database.gs  # Acesso aos dados
│   │   └── Utils.gs     # Funções utilitárias
│   └── client/          # Código do cliente (HTML/CSS/JS)
│       ├── Index.html   # Página principal
│       ├── Login.html   # Página de login
│       └── styles/      # Estilos CSS
├── docs/                # Documentação
├── appsscript.json     # Configuração do Apps Script
└── README.md           # Este arquivo
```

## Planilhas do Projeto

### Planilha Principal - Atividades BDI Serra
- **URL**: https://docs.google.com/spreadsheets/d/1_D2GrejU61QLvn_Unb6lgMuQh7JoP5Z7KiFelmoKuNE/edit
- **Abas**:
  - `atividade`: Registros de atividades realizadas (2021-2025)
  - `config`: Configurações de equipes, categorias e produtos

### Planilha de Usuários
- **URL**: https://docs.google.com/spreadsheets/d/1IHdIOepObWDrJ8BeY4cKJHWGc-_e9sqR7KGhfpdjVMc/edit
- **Finalidade**: Controle de acesso (autenticação por email)

## Funcionalidades Principais

### Autenticação
- Login com conta Google
- Validação de email contra planilha de usuários autorizados
- Maior segurança mantendo usuários em planilha separada (apenas leitura)

### Gerenciamento de Atividades
- **Cadastro**: Incluir novas atividades com data, descrição, equipes, produtos e quantidades
- **Visualização**: Lista de atividades cadastradas com filtros
- **Dashboard**: Visualização estatística com gráficos e indicadores
- **Relatórios**: Exportação em PDF com dados filtrados

### Configurações
- Cadastro de equipes (internas PRF ou externas)
- Cadastro de categorias de atividades
- Cadastro de produtos com medidas e tipos numéricos

## Estrutura de Dados

### Aba "atividade"
- `id_atividade`: Identificador único (automático)
- `data`: Data da atividade (DD/MM/AAAA)
- `descricao`: Descrição detalhada (opcional)
- `cai`: Indicador de CAI PLANOP (sim/não)
- Múltiplas equipes por atividade
- Múltiplos produtos com quantidades

### Aba "config"

**Equipes:**
- `id_equipe`: Identificador único
- `equipe`: Nome da equipe
- `interno_prf`: Indicador se é equipe interna da PRF

**Categorias:**
- `id_categoria_atividade`: Identificador único
- `categoria_atividade`: Nome da categoria

**Produtos:**
- `id_produto_atividade`: Identificador único
- `id_categoria_atividade`: Relacionamento com categoria
- `produto_atividade`: Nome do produto
- `medida`: Unidade de medida (unidade, maços, litros, etc.)
- `tipo_numero`: Tipo de formatação (inteiro, decimal, moeda)

## Tipos de Ação

- **Ação Interna**: Todas as equipes são internas da PRF
- **Ação Conjunta**: Pelo menos uma equipe é externa (ex: Polícia Militar)

## Instalação e Configuração

Consulte o arquivo [docs/INSTALACAO.md](docs/INSTALACAO.md) para instruções detalhadas de instalação.

### Pré-requisitos
- Conta Google
- Acesso às planilhas do projeto
- Permissões necessárias no Google Apps Script

## Desenvolvimento

Este projeto utiliza:
- Google Apps Script (.gs para server-side JavaScript)
- HTML5, CSS3, JavaScript (para interface)
- Google Sheets API (para acesso aos dados)

## Segurança

- Autenticação via Google OAuth
- Lista de usuários autorizados em planilha separada
- Planilha de usuários mantida com permissão apenas de leitura
- Validação de acesso em todas as operações

## Filtros e Dashboard

O sistema permite filtragem por:
- Data início/fim
- Categoria
- Produto
- Equipe
- CAI (sim/não)

Filtros múltiplos e concomitantes são suportados.

## Suporte e Documentação

Consulte a pasta `docs/` para documentação detalhada sobre:
- Guia de instalação
- Estrutura de dados
- API do sistema
- Troubleshooting

## Autor

Projeto desenvolvido para o curso BDI (Banco de Dados I) - Serra

## Licença

Uso interno - PRF Serra
