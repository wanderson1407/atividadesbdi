# Análise do Projeto ROPOL Original

## 1. Visão Geral da Arquitetura

### 1.1 Stack Tecnológico
- **Linguagem**: Python 3.x
- **Framework Web**: Flask com CORS
- **Banco de Dados**: SQLite3
- **Processamento PDF**: pdfplumber, PyPDF2
- **Integrações**: Google Drive API, Google OAuth2
- **Hashing**: MD5 para detecção de duplicatas

### 1.2 Arquitetura Geral
O sistema segue uma arquitetura monolítica com separação de responsabilidades:

```
┌─────────────────┐
│  Google Drive   │
│   (Fonte PDFs)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   main.py       │  ◄─── Orquestrador principal
│   (Orquestrador)│
└────────┬────────┘
         │
    ┌────┴────┬────────────┬──────────────┐
    │         │            │              │
    ▼         ▼            ▼              ▼
┌────────┐ ┌──────┐ ┌─────────┐ ┌─────────────┐
│ Google │ │ PDF  │ │Database │ │   API REST  │
│ Drive  │ │Proc. │ │Handler  │ │   (Flask)   │
└────────┘ └──────┘ └─────────┘ └─────────────┘
                         │              │
                         ▼              ▼
                    ┌─────────┐   ┌─────────┐
                    │ SQLite  │   │Frontend │
                    │   DB    │   │(Consulta)│
                    └─────────┘   └─────────┘
```

### 1.3 Fluxo de Processamento

1. **Download**: `main.py` conecta ao Google Drive e lista PDFs
2. **Verificação**: Calcula hash MD5 do arquivo para evitar reprocessamento
3. **Extração**: Processa PDF com pdfplumber/PyPDF2
4. **Parsing**: Extrai dados estruturados usando regex
5. **Armazenamento**: Insere/atualiza dados no SQLite
6. **Consulta**: API REST expõe dados via Flask

---

## 2. Extração de Dados do PDF

### 2.1 bu_dados.py - Extração de Dados do BU (Boletim Único)

#### Funcionalidades Principais
- Extração de texto completo preservando estrutura de colunas
- Limpeza e pós-processamento de texto
- Separação por páginas
- Remoção de cabeçalhos e metadados

#### Técnicas de Extração

**Biblioteca**: `pdfplumber` com configurações personalizadas

```python
# Extração com tolerância de coluna/linha
text = page.extract_text(x_tolerance=3, y_tolerance=3)
```

**Parâmetros importantes**:
- `x_tolerance=3`: Agrupa caracteres próximos horizontalmente
- `y_tolerance=3`: Agrupa caracteres próximos verticalmente
- Preserva estrutura de colunas no BU

#### Processamento de Texto

1. **Quebra de páginas**: Marcador `<<<<QUEBRA_DE_PAGINA>>>>`
2. **Remoção de linhas**:
   - Primeiras 2 linhas (cabeçalho)
   - Últimas 2 linhas (rodapé)
   - Linhas com "CropBox missing"
   - Linhas vazias

3. **Pós-processamento**:
```python
def post_process_text(text):
    headers = [
        "Ordem Nome Completo",
        "Versão Tipo de envolvimento Data/hora",
        "DADOS BÁSICOS:",
    ]
    # Quebra linhas com múltiplas colunas
```

#### Limitações Identificadas
- ⚠️ Caminho hardcoded: `G:\Meu Drive\ROPOL\PYTHON\PDF`
- ⚠️ Processamento não incremental (processa todos os PDFs)
- ⚠️ Sem tratamento robusto de erros de encoding (caracteres como Ã, Ã©)

---

### 2.2 bu_pessoa.py - Extração de Dados de Pessoas Envolvidas

#### Funcionalidades Principais
Extrai informações completas de todas as pessoas envolvidas no BU, incluindo:
- Dados pessoais (nome, CPF, RG, data de nascimento)
- Filiação (nome do pai/mãe)
- Endereços completos
- Telefones (celular, residencial, comercial)
- E-mails
- Dados profissionais
- Características físicas

#### Campos Extraídos

```python
regexes = {
    'tipo_envolvimento': r"Versão\s+Tipo\s+de\s+envolvimento\s+Data/hora\s*(?:[A-Z\s/]+\s+)?(.*?)\s+\d{2}/\d{2}/\d{4}",
    'cpf': r"CPF:?\s*(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11})",
    'rg': r"RG:?\s*(\d+(?:\s*[A-Z]{2})?)",
    'data_nascimento': r"NASCIDO\s+EM\s+(\d{2}/\d{2}/\d{4})",
    'nome_mae': r"(?:Nome\s+da\s+Mãe|FILHO\s+DE\s+(?:.*?)\s+E\s+DE|Mãe):?\s*(.+?)(?:\s*,|\s*$)",
    'nome_pai': r"(?:Nome\s+do\s+Pai|FILHO\s+DE):?\s*(.+?)(?:\s+E\s+DE|\s*,|\s*$)",
    'estado_civil': r"(?:ESTADO\s+CIVIL|ESTADO\s+CIVIL:)\s*(.+?)(?:\s*,|\s*$)",
    'naturalidade': r"NATURAL\s+DE\s+(.+?)(?:\s*,|\s*$)",
    'sexo': r"SEXO:?\s*(MASCULINO|FEMININO)",
    'orientacao_sexual': r"ORIENTAÇÃO\s+SEXUAL:?\s*(.+?)(?:\s*,|\s*$)",
    'cutis': r"CUTIS:\s*(.+?)(?:,|\s*$)",
    'escolaridade': r"Escolaridade:?\s*(.+?)(?:\s*,|\s*$)",
    'profissao': r"Profissão:?\s*(.+?)(?:\s*,|\s*$)",
    'altura_aproximada': r"Altura\s+Aproximada:?\s*(.+?)(?:\s*,|\s*$)",
    'alcunha': r"Apelido:?\s*(.+?)(?:\s*,|\s*$)",
}
```

#### Tipos de Envolvimento Reconhecidos
```python
tipos_envolvimento_validos = [
    "APREENDIDO (MENOR DE IDADE)",
    "ASSISTIDO/SOCORRIDO",
    "COMUNICANTE",
    "CONDUTOR VEÍCULO",
    "CONDUZIDO/AUTOR",
    "DESAPARECIDO",
    "INFORMAÇÃO",
    "SUSPEITO/INVESTIGADO",
    "TESTEMUNHA",
    "VITIMA",
    "TESTEMUNHA (AGENTE DA LEI)",
    "CONDUTOR (AGENTE DA LEI)",
    "CONDUTOR/APRESENTANTE (AGENTE DA LEI)",
    "COMUNICANTE (AGENTE DA LEI)"
]
```

#### Extração de Endereços

**Regex Pattern**:
```python
endereco_pattern = r"ENDEREÇO:\s*(.*?)(?=E\s+TENDO\s+COMO\s+TELEFONE|$)"
```

**Processamento**: Extrai logradouro completo até a palavra "E TENDO COMO TELEFONE"

**Estrutura de Dados**:
```python
endereco_processado = {
    'logradouro': '',
    'numero': '',
    'complemento': '',
    'bairro': '',
    'cidade': '',
    'estado': '',
    'cep': ''
}
```

#### Normalização de Localidades

**Integração com dados geográficos**: Usa arquivo `estados-cidades.json` para validação

```python
# Normalização de texto para comparação
def normalizar_texto(texto):
    import unicodedata
    texto = unicodedata.normalize('NFKD', texto).encode('ASCII', 'ignore').decode('ASCII')
    return re.sub(r'[^\w\s]', '', texto.lower().strip())

# Busca fuzzy com difflib
def encontrar_estado(texto):
    texto_norm = normalizar_texto(texto)
    return get_close_matches(texto_norm, estados_normalizados, n=1, cutoff=0.6)
```

#### Extração de Contatos

**Telefones**:
```python
telefone_pattern = r"TEL.\s*(CELULAR|RESIDENCIAL|COMERCIAL):\s*([^,\n]+)"
# Remove duplicatas com set
telefones_unicos = set()
```

**E-mails**:
```python
email_pattern = r"EMAIL:\s*(\S+@\S+\.\S+)"
```

#### Técnica de Parsing de Blocos

```python
# Identifica bloco de cada pessoa usando regex
person_block_pattern = rf"Ordem Nome Completo\s*\d+º?\s*{re.escape(name)}.*?(?=Ordem Nome Completo|\Z)"

# Extração da seção de envolvidos
involved_section = re.search(r"DOS ENVOLVIDOS.*?(?=DOS RECURSOS EMPENHADOS|\Z)", text, re.DOTALL | re.IGNORECASE)
```

#### Pontos de Atenção
- ⚠️ Processamento de endereço comentado (código parcial)
- ⚠️ Não separa logradouro/número/bairro de forma estruturada
- ⚠️ CEP extraído mas não processado completamente
- ✅ Boa normalização de estados/cidades
- ✅ Tratamento de duplicatas em telefones/emails

---

### 2.3 pdf_processor.py - Processamento Genérico de PDF

#### Funcionalidades
Processador básico e genérico de PDFs:

```python
def extract_text_from_pdf(pdf_path):
    try:
        with pdfplumber.open(pdf_path) as pdf:
            full_text = ""
            for page in pdf.pages:
                full_text += page.extract_text() + "\n"
            return full_text
```

#### Características
- **Simples**: Extração linear sem configurações de tolerância
- **Quebra de páginas**: Usa `\f` (form feed)
- **Limpeza básica**: Remove linhas vazias e espaços extras
- **Propósito**: Visualização e testes iniciais

#### Diferença de bu_dados.py
- `bu_dados.py`: Extração com preservação de colunas
- `pdf_processor.py`: Extração linear simples

---

## 3. Estrutura de Dados

### 3.1 Modelo de Dados Relacional (SQLite)

#### Tabela: `ropol`
```sql
CREATE TABLE IF NOT EXISTS ropol (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_ropol TEXT UNIQUE,
    versao_ropol TEXT,
    tipo TEXT,
    tipo_ropol TEXT,
    data_hora_registro DATETIME,
    unidade_registro TEXT,
    metodo_lavratura TEXT,
    observacao TEXT,
    data_hora_fato DATETIME,
    tipo_local TEXT,
    endereco_fato TEXT,
    forca_seguranca TEXT,
    unidade_policial TEXT,
    incidente_natureza TEXT,
    anexos_digitais TEXT,
    inicio_lavratura DATETIME,
    fim_lavratura DATETIME,
    bu_complementar TEXT,
    bu_origem TEXT,
    narrativa TEXT,
    file_hash TEXT UNIQUE  -- MD5 para evitar duplicatas
)
```

**Campos principais**:
- `numero_ropol`: Identificador único do boletim
- `file_hash`: Controle de duplicatas
- `data_hora_fato`: Quando o fato ocorreu
- `data_hora_registro`: Quando foi registrado
- `narrativa`: Descrição detalhada do ocorrido

#### Tabela: `pessoa`
```sql
CREATE TABLE IF NOT EXISTS pessoa (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT,
    cpf TEXT,
    rg TEXT,
    data_nascimento DATE,
    nome_mae TEXT,
    nome_pai TEXT
)
```

**Nota**: Tabela básica, não armazena todos os campos extraídos por `bu_pessoa.py` (tipo_envolvimento, naturalidade, etc.)

#### Tabela: `endereco`
```sql
CREATE TABLE IF NOT EXISTS endereco (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pessoa_id INTEGER,
    logradouro TEXT,
    numero TEXT,
    complemento TEXT,
    bairro TEXT,
    cidade TEXT,
    estado TEXT,
    cep TEXT,
    FOREIGN KEY (pessoa_id) REFERENCES pessoa (id)
)
```

#### Tabela: `telefone`
```sql
CREATE TABLE IF NOT EXISTS telefone (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pessoa_id INTEGER,
    numero TEXT,
    tipo TEXT,  -- CELULAR, RESIDENCIAL, COMERCIAL
    FOREIGN KEY (pessoa_id) REFERENCES pessoa (id)
)
```

#### Tabela: `veiculo`
```sql
CREATE TABLE IF NOT EXISTS veiculo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    placa TEXT,
    marca TEXT,
    modelo TEXT,
    ano TEXT,
    cor TEXT,
    chassi TEXT
)
```

#### Tabela: `objeto`
```sql
CREATE TABLE IF NOT EXISTS objeto (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT,
    descricao TEXT,
    numero_serie TEXT
)
```

### 3.2 Tabelas de Relacionamento (N:N)

#### `ropol_pessoa`
```sql
CREATE TABLE IF NOT EXISTS ropol_pessoa (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ropol_id INTEGER,
    pessoa_id INTEGER,
    classificacao TEXT,  -- VITIMA, AUTOR, TESTEMUNHA, etc.
    FOREIGN KEY (ropol_id) REFERENCES ropol (id),
    FOREIGN KEY (pessoa_id) REFERENCES pessoa (id)
)
```

#### `ropol_veiculo`
```sql
CREATE TABLE IF NOT EXISTS ropol_veiculo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ropol_id INTEGER,
    veiculo_id INTEGER,
    FOREIGN KEY (ropol_id) REFERENCES ropol (id),
    FOREIGN KEY (veiculo_id) REFERENCES veiculo (id)
)
```

#### `ropol_objeto`
```sql
CREATE TABLE IF NOT EXISTS ropol_objeto (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ropol_id INTEGER,
    objeto_id INTEGER,
    FOREIGN KEY (ropol_id) REFERENCES ropol (id),
    FOREIGN KEY (objeto_id) REFERENCES objeto (id)
)
```

### 3.3 Diagrama ER

```
┌─────────────┐
│   ROPOL     │
│─────────────│
│ id (PK)     │
│ numero_ropol│◄─────┐
│ file_hash   │      │
│ narrativa   │      │
└─────────────┘      │
       ▲             │
       │ N           │
       │             │
       │ 1           │
┌──────┴────────┐    │
│ ropol_pessoa  │    │
│───────────────│    │
│ ropol_id (FK) │    │
│ pessoa_id(FK) │────┤
│ classificacao │    │
└───────────────┘    │
       ▲             │
       │ N           │
       │             │
       │ 1           │
┌──────┴──────┐      │
│   PESSOA    │      │
│─────────────│      │
│ id (PK)     │◄─────┤
│ nome        │      │
│ cpf         │      │
│ rg          │      │
└─────────────┘      │
    ▲                │
    │ 1              │
    │                │
    │ N              │
┌───┴────────┐       │
│ ENDERECO   │       │
│────────────│       │
│pessoa_id(FK)◄──────┘
│ logradouro │
│ cidade     │
└────────────┘

Similar para TELEFONE, VEICULO, OBJETO
```

### 3.4 Análise de Rede (Network Analysis)

O sistema implementa funções de análise de rede para relacionamento:

#### `get_person_network(person_id)`
Retorna:
- Pessoa
- ROPOLs relacionados
- Outras pessoas nos mesmos ROPOLs
- Veículos relacionados
- Objetos relacionados

#### `get_ropol_network(ropol_id)`
Retorna:
- ROPOL
- Pessoas envolvidas
- Veículos
- Objetos
- ROPOLs relacionados (por pessoas/veículos/objetos em comum)

#### `get_vehicle_network(vehicle_id)`
Retorna:
- Veículo
- ROPOLs relacionados
- Pessoas relacionadas
- Objetos relacionados

**Exemplo de consulta de rede**:
```python
cursor.execute("""
    SELECT DISTINCT r.*
    FROM ropol r
    LEFT JOIN ropol_pessoa rp ON r.id = rp.ropol_id
    LEFT JOIN ropol_veiculo rv ON r.id = rv.ropol_id
    LEFT JOIN ropol_objeto ro ON r.id = ro.objeto_id
    WHERE
        (rp.pessoa_id IN (SELECT pessoa_id FROM ropol_pessoa WHERE ropol_id = ?))
        OR (rv.veiculo_id IN (SELECT veiculo_id FROM ropol_veiculo WHERE ropol_id = ?))
        OR (ro.objeto_id IN (SELECT objeto_id FROM ropol_objeto WHERE ropol_id = ?))
        AND r.id != ?
""", (ropol_id, ropol_id, ropol_id, ropol_id))
```

---

## 4. Integrações

### 4.1 Google Drive

#### Biblioteca: `google_drive_handler.py`

**Dependências**:
```python
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
```

**Autenticação**:
```python
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

def get_drive_service():
    creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    return build('drive', 'v3', credentials=creds)
```

**Download de PDFs**:
```python
def download_pdf(service, file_id):
    request = service.files().get_media(fileId=file_id)
    file = io.BytesIO()
    downloader = MediaIoBaseDownload(file, request)
    done = False
    while done is False:
        status, done = downloader.next_chunk()
    return file.getvalue()
```

**Fluxo de Autenticação**:
1. Arquivo `token.json` precisa existir (gerado via OAuth2)
2. Permissão: somente leitura (`drive.readonly`)
3. Sem renovação automática de token (limitação)

#### Limitações
- ⚠️ Sem tratamento de expiração de token
- ⚠️ Sem paginação na listagem de arquivos (se houver muitos PDFs)
- ⚠️ Download em memória (pode causar problemas com PDFs grandes)
- ⚠️ Sem retry em caso de falha de rede

---

### 4.2 Google Sheets (Inferido, não implementado nos arquivos lidos)

Não há código explícito de integração com Google Sheets nos arquivos analisados, mas há menção de exportação em comentários.

**Implementação sugerida** (não presente):
```python
# Possível integração futura
from googleapiclient.discovery import build

def export_to_sheets(data, spreadsheet_id):
    service = build('sheets', 'v4', credentials=creds)
    body = {'values': data}
    service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range='Sheet1!A1',
        valueInputOption='RAW',
        body=body
    ).execute()
```

---

## 5. Pontos de Atenção

### 5.1 Problemas Identificados

#### 🔴 Críticos

1. **Caminhos Hardcoded**
   - `PDF_FOLDER_PATH = r'G:\Meu Drive\ROPOL\PYTHON\PDF'`
   - `G:\\Meu Drive\\ROPOL\\python\\estados-cidades.json`
   - ❌ Não portável entre ambientes

2. **Encoding de Caracteres**
   - Acentuação corrompida: `Ã©`, `Ã§`, `Ã£`
   - Problema: leitura de arquivos sem especificar `encoding='utf-8'`
   - Impacto: Dados mal formatados no banco

3. **Falta de Tratamento de Erros**
   - Try/except genéricos com apenas `print()`
   - Sem logging estruturado
   - Falhas silenciosas

4. **Controle de Duplicatas Básico**
   - Usa apenas MD5 do arquivo inteiro
   - Se o PDF for regerado com mesma informação, será reprocessado

5. **Sem Validação de Dados**
   - CPF/RG não validados
   - Datas não parseadas
   - CEP não normalizado

#### ⚠️ Médios

6. **Extração de Endereço Incompleta**
   - Código de parsing detalhado está comentado
   - Só captura logradouro completo
   - Não separa número, bairro, complemento

7. **Tabela `pessoa` Incompleta**
   - Muitos campos extraídos não são salvos:
     - `tipo_envolvimento`
     - `naturalidade`
     - `profissao`
     - `escolaridade`
     - `orientacao_sexual`
     - `cutis`, `altura_aproximada`, `alcunha`

8. **Sem Transações de Banco**
   - Inserção de dados sem transações atômicas
   - Risco de inconsistência

9. **Performance**
   - Processa todos os PDFs a cada execução
   - Sem processamento paralelo
   - Sem cache de resultados

10. **Google Drive**
    - Token de autenticação não renovado
    - Sem paginação na listagem
    - Download em memória (problema com arquivos grandes)

#### 💡 Melhorias

11. **Regex Complexas**
    - Difíceis de manter
    - Sem testes unitários
    - Frágeis a mudanças no formato do PDF

12. **Sem Interface de Administração**
    - Não há UI para revisar dados extraídos
    - Correção manual de erros difícil

13. **Sem Auditoria**
    - Não registra quem/quando processou
    - Sem histórico de alterações

14. **API REST Minimalista**
    - Só consulta por `numero_ropol`
    - Sem paginação
    - Sem filtros
    - Sem autenticação

---

### 5.2 Análise de Regex

#### Complexidade Alta
```python
# Tipo de envolvimento - muito específica
r"Versão\s+Tipo\s+de\s+envolvimento\s+Data/hora\s*(?:[A-Z\s/]+\s+)?(.*?)\s+\d{2}/\d{2}/\d{4}"

# Bloco de pessoa - regex aninhada
rf"Ordem Nome Completo\s*\d+º?\s*{re.escape(name)}.*?(?=Ordem Nome Completo|\Z)"
```

**Problemas**:
- Sensível a quebras de linha
- Sensível a espaços extras
- Depende de palavras-chave exatas

**Recomendação**: Usar parsers mais robustos (spaCy, regex mais simples)

---

### 5.3 Limitações de Escala

#### Processamento
- **Arquivo por vez**: Sem paralelização
- **Re-processamento**: Processa todos os PDFs sempre
- **Memória**: Download de PDF inteiro em memória

#### Banco de Dados
- **SQLite**: Bom para desenvolvimento, limitado para produção
- **Sem índices**: Consultas podem ficar lentas
- **Sem replicação**: Backup manual

---

## 6. Recomendações para Nova Arquitetura

### 6.1 Arquitetura Sugerida

```
┌──────────────────────────────────────────┐
│       CAMADA DE ENTRADA                  │
│  ┌────────────┐  ┌──────────────┐        │
│  │Google Drive│  │Local Upload  │        │
│  └──────┬─────┘  └──────┬───────┘        │
└─────────┼────────────────┼────────────────┘
          │                │
          ▼                ▼
┌──────────────────────────────────────────┐
│       CAMADA DE PROCESSAMENTO            │
│  ┌────────────────────────────────────┐  │
│  │  Fila de Processamento (Celery)   │  │
│  │  - Worker paralelos                │  │
│  │  - Retry automático                │  │
│  │  - Priorização                     │  │
│  └────────────────────────────────────┘  │
│          │                                │
│          ▼                                │
│  ┌────────────────────────────────────┐  │
│  │  Pipeline de Extração              │  │
│  │  1. Extração de texto (pdfplumber) │  │
│  │  2. Parsing (regex + ML)           │  │
│  │  3. Validação (pydantic)           │  │
│  │  4. Normalização                   │  │
│  └────────────────────────────────────┘  │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│       CAMADA DE DADOS                    │
│  ┌──────────────┐  ┌─────────────────┐   │
│  │ PostgreSQL   │  │ Elasticsearch   │   │
│  │ (dados       │  │ (busca full-    │   │
│  │  estruturados)│  │  text)          │   │
│  └──────────────┘  └─────────────────┘   │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│       CAMADA DE API                      │
│  ┌────────────────────────────────────┐  │
│  │  FastAPI + Pydantic                │  │
│  │  - REST API                        │  │
│  │  - GraphQL (opcional)              │  │
│  │  - WebSocket (notificações)        │  │
│  └────────────────────────────────────┘  │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│       CAMADA DE APRESENTAÇÃO             │
│  ┌──────────┐  ┌──────────┐              │
│  │React/Vue │  │Dashboard │              │
│  │Frontend  │  │Analytics │              │
│  └──────────┘  └──────────┘              │
└──────────────────────────────────────────┘
```

---

### 6.2 Tecnologias Recomendadas

#### Backend
- **Framework**: FastAPI (em vez de Flask)
  - Validação automática (Pydantic)
  - Documentação automática (OpenAPI)
  - Async/await nativo
  - Type hints

- **Banco de Dados**: PostgreSQL
  - Suporte a JSON (campos flexíveis)
  - Full-text search nativo
  - Índices GIN/GIST para buscas
  - Replicação e backup

- **Cache**: Redis
  - Cache de consultas frequentes
  - Fila de processamento

- **Task Queue**: Celery + Redis
  - Processamento assíncrono
  - Retry automático
  - Monitoramento (Flower)

#### Extração de Dados
- **PDF**: pdfplumber (atual) + PyMuPDF (alternativa)
- **OCR** (se necessário): Tesseract OCR
- **NER** (entidades): spaCy ou BERT fine-tuned
- **Validação**: pydantic
- **Normalização**: bibliotecas específicas
  - `python-cpf` para CPF
  - `pycep-correios` para CEP
  - `brazilnum` para RG, CNH, etc.

#### Frontend
- **Framework**: React ou Vue.js
- **Estado**: Redux/Vuex ou Context API
- **UI**: Material-UI ou Ant Design
- **Gráficos**: D3.js ou Chart.js
- **Tabelas**: AG Grid ou React Table

#### DevOps
- **Containers**: Docker + Docker Compose
- **Orquestração**: Kubernetes (produção)
- **CI/CD**: GitHub Actions ou GitLab CI
- **Monitoramento**: 
  - Logs: ELK Stack (Elasticsearch, Logstash, Kibana)
  - Métricas: Prometheus + Grafana
  - Erros: Sentry

---

### 6.3 Melhorias Específicas

#### 1. Extração de PDF Melhorada

```python
from pydantic import BaseModel, validator
from typing import Optional, List
import re

class PessoaBU(BaseModel):
    nome: str
    cpf: Optional[str] = None
    rg: Optional[str] = None
    tipo_envolvimento: str
    
    @validator('cpf')
    def validar_cpf(cls, v):
        if v:
            # Remove caracteres não numéricos
            cpf = re.sub(r'\D', '', v)
            if len(cpf) != 11:
                raise ValueError('CPF deve ter 11 dígitos')
            # Validação de dígitos verificadores
            # ... implementar
        return v
    
    @validator('tipo_envolvimento')
    def validar_tipo(cls, v):
        tipos_validos = [
            "VITIMA", "AUTOR", "TESTEMUNHA", 
            "COMUNICANTE", "CONDUTOR VEICULO"
        ]
        if v.upper() not in tipos_validos:
            raise ValueError(f'Tipo inválido: {v}')
        return v.upper()

class ExtractorBU:
    def __init__(self):
        self.patterns = self._compile_patterns()
    
    def _compile_patterns(self):
        """Pré-compila regex para performance"""
        return {
            'cpf': re.compile(r'CPF:?\s*(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11})'),
            'rg': re.compile(r'RG:?\s*(\d+(?:\s*[A-Z]{2})?)'),
            # ... outros patterns
        }
    
    def extrair_pessoa(self, texto: str, nome: str) -> PessoaBU:
        """Extrai dados de uma pessoa com validação"""
        dados = {'nome': nome}
        
        # Extração com regex pré-compilado
        for campo, pattern in self.patterns.items():
            match = pattern.search(texto)
            if match:
                dados[campo] = match.group(1).strip()
        
        # Validação automática via Pydantic
        return PessoaBU(**dados)
```

#### 2. Pipeline de Processamento

```python
from celery import Celery
from typing import Dict, Any
import hashlib

app = Celery('ropol_processor', broker='redis://localhost:6379/0')

@app.task(bind=True, max_retries=3)
def processar_pdf(self, file_path: str, file_id: str) -> Dict[str, Any]:
    """
    Processa um PDF de forma assíncrona com retry
    """
    try:
        # 1. Calcular hash para deduplicação
        file_hash = calcular_hash(file_path)
        if arquivo_ja_processado(file_hash):
            return {'status': 'skipped', 'reason': 'duplicate'}
        
        # 2. Extrair texto
        texto = extrair_texto_pdf(file_path)
        
        # 3. Extrair entidades
        ropol_data = extrair_dados_ropol(texto)
        pessoas = extrair_pessoas(texto)
        veiculos = extrair_veiculos(texto)
        
        # 4. Validar dados (Pydantic)
        ropol_validado = ROPOLSchema(**ropol_data)
        pessoas_validadas = [PessoaBU(**p) for p in pessoas]
        
        # 5. Salvar no banco
        with transaction():
            ropol_id = salvar_ropol(ropol_validado, file_hash)
            salvar_pessoas(ropol_id, pessoas_validadas)
            salvar_veiculos(ropol_id, veiculos)
        
        # 6. Indexar no Elasticsearch
        indexar_ropol(ropol_id, ropol_validado)
        
        return {'status': 'success', 'ropol_id': ropol_id}
    
    except Exception as exc:
        # Retry com backoff exponencial
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))

@app.task
def monitorar_google_drive():
    """
    Task periódica para verificar novos arquivos no Drive
    """
    service = get_drive_service()
    novos_arquivos = listar_novos_arquivos(service)
    
    for arquivo in novos_arquivos:
        # Dispara task de processamento
        processar_pdf.delay(arquivo['path'], arquivo['id'])
```

#### 3. API REST Melhorada

```python
from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session

app = FastAPI(
    title="ROPOL API",
    description="API para consulta de Boletins Únicos",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ROPOLResponse(BaseModel):
    id: int
    numero_ropol: str
    data_hora_fato: str
    tipo: str
    narrativa: str
    pessoas: List[PessoaBU]
    
    class Config:
        orm_mode = True

@app.get("/api/v1/ropol/{numero_ropol}", response_model=ROPOLResponse)
async def buscar_ropol(
    numero_ropol: str,
    db: Session = Depends(get_db)
):
    """
    Busca um ROPOL por número
    """
    ropol = db.query(ROPOL).filter(ROPOL.numero_ropol == numero_ropol).first()
    if not ropol:
        raise HTTPException(status_code=404, detail="ROPOL não encontrado")
    return ropol

@app.get("/api/v1/ropol/search", response_model=List[ROPOLResponse])
async def buscar_ropols(
    q: Optional[str] = Query(None, description="Busca full-text"),
    tipo: Optional[str] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Busca ROPOLs com filtros e paginação
    """
    query = db.query(ROPOL)
    
    if q:
        # Busca full-text no PostgreSQL
        query = query.filter(ROPOL.narrativa.match(q))
    
    if tipo:
        query = query.filter(ROPOL.tipo == tipo)
    
    if data_inicio:
        query = query.filter(ROPOL.data_hora_fato >= data_inicio)
    
    if data_fim:
        query = query.filter(ROPOL.data_hora_fato <= data_fim)
    
    # Paginação
    offset = (page - 1) * limit
    results = query.offset(offset).limit(limit).all()
    
    return results

@app.get("/api/v1/pessoa/{cpf}/ropols", response_model=List[ROPOLResponse])
async def buscar_ropols_pessoa(
    cpf: str,
    db: Session = Depends(get_db)
):
    """
    Busca todos os ROPOLs relacionados a uma pessoa (por CPF)
    """
    pessoa = db.query(Pessoa).filter(Pessoa.cpf == cpf).first()
    if not pessoa:
        raise HTTPException(status_code=404, detail="Pessoa não encontrada")
    
    ropols = db.query(ROPOL).join(ROPOLPessoa).filter(
        ROPOLPessoa.pessoa_id == pessoa.id
    ).all()
    
    return ropols

@app.get("/api/v1/analytics/tipos-ocorrencia")
async def analytics_tipos(db: Session = Depends(get_db)):
    """
    Estatísticas de tipos de ocorrência
    """
    from sqlalchemy import func
    
    resultado = db.query(
        ROPOL.tipo,
        func.count(ROPOL.id).label('total')
    ).group_by(ROPOL.tipo).all()
    
    return [{'tipo': r.tipo, 'total': r.total} for r in resultado]
```

#### 4. Estrutura de Projeto Moderna

```
ropol/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app
│   ├── config.py            # Settings (pydantic)
│   ├── database.py          # SQLAlchemy setup
│   ├── models/
│   │   ├── __init__.py
│   │   ├── ropol.py         # ORM models
│   │   ├── pessoa.py
│   │   └── veiculo.py
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── ropol.py         # Pydantic schemas
│   │   ├── pessoa.py
│   │   └── veiculo.py
│   ├── api/
│   │   ├── __init__.py
│   │   ├── v1/
│   │   │   ├── __init__.py
│   │   │   ├── ropol.py     # Endpoints
│   │   │   ├── pessoa.py
│   │   │   └── analytics.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── pdf_extractor.py
│   │   ├── google_drive.py
│   │   └── validator.py
│   ├── tasks/
│   │   ├── __init__.py
│   │   └── celery_tasks.py  # Celery tasks
│   └── utils/
│       ├── __init__.py
│       ├── regex_patterns.py
│       └── normalizers.py
├── tests/
│   ├── __init__.py
│   ├── test_pdf_extractor.py
│   ├── test_api.py
│   └── fixtures/
│       └── sample_bu.pdf
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── nginx.conf
├── scripts/
│   ├── migrate_old_data.py
│   └── seed_database.py
├── .env.example
├── requirements.txt
├── pyproject.toml
└── README.md
```

#### 5. Configuração com Pydantic Settings

```python
# app/config.py
from pydantic import BaseSettings, PostgresDsn, RedisDsn
from typing import Optional

class Settings(BaseSettings):
    # Database
    database_url: PostgresDsn = "postgresql://user:pass@localhost/ropol"
    
    # Redis
    redis_url: RedisDsn = "redis://localhost:6379/0"
    
    # Google Drive
    google_drive_folder_id: str
    google_credentials_path: str = "credentials.json"
    
    # PDF Processing
    pdf_temp_dir: str = "/tmp/ropol_pdfs"
    max_workers: int = 4
    
    # API
    api_v1_prefix: str = "/api/v1"
    debug: bool = False
    
    # Security
    secret_key: str
    allowed_origins: list = ["http://localhost:3000"]
    
    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()
```

---

### 6.4 Roadmap de Migração

#### Fase 1: Infraestrutura (Semana 1-2)
- [ ] Setup PostgreSQL
- [ ] Setup Redis
- [ ] Docker Compose para ambiente local
- [ ] Migração de schema SQLite → PostgreSQL

#### Fase 2: Backend Core (Semana 3-4)
- [ ] FastAPI básico com endpoints CRUD
- [ ] Modelos Pydantic para validação
- [ ] Serviço de extração de PDF refatorado
- [ ] Testes unitários

#### Fase 3: Processamento Assíncrono (Semana 5)
- [ ] Setup Celery + Redis
- [ ] Tasks de processamento de PDF
- [ ] Monitoramento de Google Drive
- [ ] Retry e error handling

#### Fase 4: Frontend (Semana 6-7)
- [ ] Setup React/Vue
- [ ] Interface de busca
- [ ] Dashboard de analytics
- [ ] Upload manual de PDFs

#### Fase 5: Produção (Semana 8)
- [ ] Deployment no Google Cloud Run
- [ ] CI/CD pipeline
- [ ] Monitoramento (Sentry, Prometheus)
- [ ] Documentação

---

## 7. Conclusão

### Pontos Fortes do Projeto Original
✅ Separação clara de responsabilidades  
✅ Extração robusta com pdfplumber  
✅ Modelo de dados relacional bem estruturado  
✅ Análise de rede implementada  
✅ Integração com Google Drive funcional  

### Principais Desafios
❌ Caminhos hardcoded não portáveis  
❌ Falta de validação de dados  
❌ Processamento síncrono e não escalável  
❌ API REST muito básica  
❌ Extração de endereço incompleta  
❌ Sem interface de administração  
❌ Tratamento de erros insuficiente  

### Prioridades para Nova Versão
1. **Validação com Pydantic** (crítico)
2. **Processamento assíncrono** (performance)
3. **API REST moderna** (usabilidade)
4. **Frontend de administração** (operação)
5. **Normalização de endereços** (qualidade de dados)
6. **Logs e monitoramento** (observabilidade)

### Estimativa de Esforço
- **Refatoração completa**: 8-10 semanas
- **MVP com melhorias críticas**: 4-5 semanas
- **Migração de dados**: 1 semana
- **Testes e validação**: 2 semanas

---

**Documentação gerada em**: {{ data_atual }}  
**Versão**: 1.0  
**Autor**: Análise automatizada do projeto ROPOL original
