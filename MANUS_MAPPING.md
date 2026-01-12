Resumo de alterações propostas (Prioridades 1-3)

Objetivo: mapear mudanças concretas por arquivo para implementar os três primeiros itens do roadmap mantendo FastAPI + Firestore.

Prioridade 1 — Autenticação Google completa
- Arquivos a alterar:
  - `app/auth.py`:
    - Remover aceitação irrestrita de `dummy_token` em produção; manter somente em modo dev controlado por variável de ambiente (`DEV_AUTH=true`).
    - Assegurar que `GOOGLE_CLIENT_ID` seja lido de `.env` e lançar erro claro se ausente.
    - Retornar `user` serializável (usar `model_dump()` se Pydantic v2 estiver presente).
  - `index.html` / `login.html` / `script.js`:
    - Implementar fluxo de OAuth (Google Sign-In) no frontend ou instruir a usar fluxo server-side: obter `id_token` e POST para `/auth/google`.

Prioridade 2 — Sincronizar estrutura Sheets → Firestore (ETL)
- Arquivos a alterar/usar:
  - `import_csv_data.py` e `populate_data.py`: executar e verificar mapeamento de campos; adicionar logging e checagens de integridade.
  - `planilhas/` (CSV): garantir encoding UTF-8 e cabeçalhos esperados (`id_equipe`, `equipe`, `interno_prf`, etc.).
  - `app/firestore_repo.py`: revisar formatos de data (usar ISO) e adaptar `_get_next_id` para concorrência baixa/segura.

Prioridade 3 — Multi-select UI e queries filtradas
- Arquivos a alterar:
  - `index.html`:
    - Tornar `<select>` de `equipeSelect`, `categoriaSelect` e `produtoSelect` multi-select (`multiple` attribute).
    - Adicionar elemento `#loader` e atribuir `id` aos botões para poder desabilitá-los enquanto carrega.
  - `script.js`:
    - Coletar múltiplas opções selecionadas usando `Array.from(select.selectedOptions).map(o => o.value)`.
    - Serializar múltiplos parâmetros para a query (ex.: `id_equipe=1&id_equipe=2`), ou usar CSV (`id_equipe=1,2`) e interpretar no backend.
    - Implementar `showLoader()` / `hideLoader()` que mostram `#loader` e desabilitam botões (`applyFilters`, `exportPdf`).
    - Proteger chamadas com try/catch e exibir mensagens de erro ao usuário.

Exemplo de trecho a ser inserido em `script.js` (serialização de múltiplos valores):

```javascript
const select = document.getElementById('equipeSelect');
const selected = Array.from(select.selectedOptions).map(o => o.value);
const params = new URLSearchParams();
selected.forEach(v => params.append('id_equipe', v));
const url = '/atividades?' + params.toString();
```

Como proceder: vou aplicar as mudanças de A2 (multi-select + spinner) automaticamente e em seguida inserir um registro no `README.md` com data/hora.
