# Guia de Instalação - Atividades BDI Serra

## Pré-requisitos

- Conta Google
- Acesso às planilhas do projeto:
  - Planilha "Atividades BDI Serra"
  - Planilha "usuarios"
- Permissões de editor na planilha "Atividades BDI Serra"

## Passo 1: Preparar as Planilhas

### Planilha "Atividades BDI Serra"

1. Acesse: https://docs.google.com/spreadsheets/d/1_D2GrejU61QLvn_Unb6lgMuQh7JoP5Z7KiFelmoKuNE/edit

2. Certifique-se de que existem as seguintes abas:

**Aba "atividade"** com as colunas:
- A: id_atividade
- B: data
- C: descricao
- D: cai

**Aba "config"** com as colunas:
- A: id_equipe
- B: equipe
- C: interno_prf
- D: id_categoria_atividade
- E: categoria_atividade
- F: id_produto_atividade
- G: id_categoria_atividade (FK)
- H: produto_atividade
- I: medida
- J: tipo_numero

### Planilha "usuarios"

1. Acesse: https://docs.google.com/spreadsheets/d/1IHdIOepObWDrJ8BeY4cKJHWGc-_e9sqR7KGhfpdjVMc/edit

2. Certifique-se de que a primeira coluna (A) contém emails autorizados:
```
email
usuario1@email.com
usuario2@email.com
```

## Passo 2: Acessar o Editor do Apps Script

1. Na planilha "Atividades BDI Serra", vá em: **Extensões > Apps Script**

2. O editor do Google Apps Script será aberto em uma nova aba

## Passo 3: Criar os Arquivos do Projeto

No editor do Apps Script, você precisará criar os seguintes arquivos:

### Arquivos do Servidor (.gs)

1. **Code.gs** (já existe, substituir conteúdo)
   - Copiar conteúdo de: `src/server/Code.gs`

2. **Auth.gs** (criar novo)
   - No editor, clicar em **+** ao lado de "Arquivos"
   - Nomear como "Auth"
   - Copiar conteúdo de: `src/server/Auth.gs`

3. **Database.gs** (criar novo)
   - Criar arquivo "Database"
   - Copiar conteúdo de: `src/server/Database.gs`

4. **Utils.gs** (criar novo)
   - Criar arquivo "Utils"
   - Copiar conteúdo de: `src/server/Utils.gs`

### Arquivos HTML

1. **Index.html** (criar novo)
   - Clicar em **+** ao lado de "Arquivos"
   - Selecionar "HTML"
   - Nomear como "Index"
   - Copiar conteúdo de: `src/client/Index.html`

2. **Login.html** (criar novo)
   - Criar arquivo HTML "Login"
   - Copiar conteúdo de: `src/client/Login.html`

3. **Styles.html** (criar novo)
   - Criar arquivo HTML "Styles"
   - Copiar conteúdo de: `src/client/Styles.html`

4. **Scripts.html** (criar novo)
   - Criar arquivo HTML "Scripts"
   - Copiar conteúdo de: `src/client/Scripts.html`

### Arquivo de Configuração

1. No editor, ao lado do nome do projeto, clicar no ícone de engrenagem (Configurações do projeto)

2. Marcar a opção "Mostrar arquivo de manifesto 'appsscript.json' no editor"

3. Voltar ao editor e editar o arquivo **appsscript.json**
   - Copiar conteúdo de: `appsscript.json`

## Passo 4: Configurar os IDs das Planilhas

No arquivo **Code.gs**, verificar e ajustar os IDs das planilhas se necessário:

```javascript
const SHEET_ID_ATIVIDADES = '1_D2GrejU61QLvn_Unb6lgMuQh7JoP5Z7KiFelmoKuNE';
const SHEET_ID_USUARIOS = '1IHdIOepObWDrJ8BeY4cKJHWGc-_e9sqR7KGhfpdjVMc';
```

## Passo 5: Testar a Configuração

1. No editor do Apps Script, selecionar a função **testSetup** no menu dropdown

2. Clicar em **Executar** (▶️)

3. Na primeira execução, será solicitado autorizar o script:
   - Clicar em "Revisar permissões"
   - Selecionar sua conta Google
   - Clicar em "Avançado"
   - Clicar em "Acessar [nome do projeto] (não seguro)"
   - Clicar em "Permitir"

4. Verificar os logs (View > Logs) para confirmar que a configuração está OK

## Passo 6: Implantar como Web App

1. No editor, clicar em **Implantar > Nova implantação**

2. Clicar no ícone de engrenagem ao lado de "Selecionar tipo"

3. Selecionar **Aplicativo da Web**

4. Configurar:
   - **Descrição**: "Atividades BDI Serra v1.0"
   - **Executar como**: "Eu (seu email)"
   - **Quem tem acesso**: "Qualquer pessoa"

5. Clicar em **Implantar**

6. Autorizar o acesso se solicitado

7. Copiar a **URL do aplicativo da Web** fornecida

## Passo 7: Configurar Permissões das Planilhas

### Planilha "Atividades BDI Serra"
- Compartilhar com todos os usuários como **Editor**
- Cada usuário precisa poder adicionar/editar dados

### Planilha "usuarios"
- Manter permissão apenas de **Leitor** para o script
- Não compartilhar diretamente com usuários finais
- Apenas administradores devem ter acesso de edição

## Passo 8: Testar o Aplicativo

1. Abrir a URL do aplicativo em um navegador

2. Fazer login com uma conta Google que esteja na lista de usuários autorizados

3. Verificar se:
   - O sistema carrega corretamente
   - O menu lateral funciona
   - É possível navegar entre as páginas
   - Os dados são carregados das planilhas

## Solução de Problemas

### Erro: "Script function not found"
- Verificar se todos os arquivos .gs foram criados corretamente
- Salvar todos os arquivos no editor
- Tentar executar testSetup novamente

### Erro: "Access denied"
- Verificar se o email está na planilha de usuários
- Verificar permissões das planilhas
- Tentar autorizar novamente

### Erro: "Cannot read property"
- Verificar estrutura das abas nas planilhas
- Certificar-se de que as colunas estão na ordem correta
- Verificar se há dados de teste nas planilhas

### Interface não carrega
- Verificar se todos os arquivos HTML foram criados
- Verificar se o appsscript.json está correto
- Limpar cache do navegador e tentar novamente

## Atualizações Futuras

Para atualizar o aplicativo:

1. Fazer alterações nos arquivos no editor
2. Salvar todas as alterações
3. Ir em **Implantar > Gerenciar implantações**
4. Clicar no ícone de lápis (editar) na implantação ativa
5. Selecionar "Nova versão" na lista suspensa
6. Clicar em **Implantar**

## Suporte

Para problemas ou dúvidas:
- Consultar a documentação completa na pasta `docs/`
- Verificar os logs no Apps Script (View > Logs)
- Verificar a console do navegador (F12) para erros no cliente

## Próximos Passos

Após a instalação:
1. Cadastrar equipes na aba "config"
2. Cadastrar categorias de atividades
3. Cadastrar produtos relacionados às categorias
4. Começar a registrar atividades
5. Explorar o dashboard e relatórios
