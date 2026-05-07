# multiselectw

**Elemento padrão de seleção múltipla com dropdown e suporte hierárquico.**

Arquivo: `static/tree-multiselect.js`  
Nome interno da classe: `TreeMultiSelect`  
Nome do padrão de UX: **multiselectw**

---

## O que é

Campo combo-box compacto para seleção múltipla de itens, com ou sem hierarquia (pai/filho). Exibe os itens selecionados como **chips inline** dentro do campo. Ao clicar, abre um **dropdown** com lista de checkboxes. Suporta **filtro por substring** ao digitar.

---

## Copiar para outro projeto

1. Copiar `static/tree-multiselect.js` para o projeto destino (ex: `static/multiselectw.js`)
2. Incluir no HTML **antes** do script principal:
   ```html
   <script src="static/tree-multiselect.js"></script>
   ```
3. Criar um container `<div>` onde o componente será renderizado:
   ```html
   <div id="meuFiltro"></div>
   ```
4. Instanciar via JavaScript:
   ```javascript
   const tms = new TreeMultiSelect('meuFiltro', {
       items: [...],         // array de itens (ver formato abaixo)
       placeholder: 'Buscar...',
       onchange: (ids) => { console.log(ids); }
   });
   ```

O CSS é **injetado automaticamente** pelo próprio componente (uma única vez por página). Não é necessário importar nenhuma folha de estilos.

---

## Formato dos itens

```javascript
// Lista plana (sem hierarquia):
[
    { id: 1, label: 'Item A', parentId: null },
    { id: 2, label: 'Item B', parentId: null },
]

// Com hierarquia (pai/filho):
[
    { id: 10, label: 'PRF',        parentId: null },
    { id: 11, label: 'BDI Serra',  parentId: 10   },
    { id: 12, label: 'BPMA',       parentId: 10   },
    { id: 20, label: 'PC',         parentId: null },
]
```

| Campo      | Tipo             | Descrição                              |
|------------|------------------|----------------------------------------|
| `id`       | `number`         | Identificador único                    |
| `label`    | `string`         | Texto exibido na lista e nos chips     |
| `parentId` | `number \| null` | ID do pai; `null` ou ausente = raiz    |

---

## Opções do construtor

```javascript
new TreeMultiSelect(container, {
    items:       [],          // array de itens (obrigatório para popular)
    selected:    [1, 3],      // IDs pré-selecionados (opcional)
    placeholder: 'Buscar...', // placeholder do campo de texto
    maxChips:    3,           // máx de chips mostrados (padrão: 3, depois "+N")
    onchange:    (ids) => {}  // callback chamado quando seleção muda
})
```

---

## API pública

```javascript
tms.getValue()          // → [id, ...]   todos os IDs marcados
tms.getEffective()      // → [id, ...]   IDs efetivos (nó mais profundo de cada galho)
tms.setValue([1, 2])    // define seleção programaticamente
tms.selectAll()         // marca todos
tms.deselectAll()       // desmarca todos
tms.refresh(items)      // recarrega a lista de itens (mantém seleção válida)
tms.destroy()           // remove event listeners e limpa o container
```

### `getValue()` vs `getEffective()`

- **`getValue()`**: retorna todos os IDs cujos checkboxes estão marcados.
- **`getEffective()`**: aplica a regra "nó mais profundo de cada galho". Se pai e filho ambos marcados, retorna apenas o filho. Útil para enviar ao backend somente as equipes/categorias mais específicas.

---

## Comportamento do dropdown

- **Clicar no campo** → abre o dropdown
- **Digitar** → filtra a lista por substring (ignora acentos)
- **Clicar fora** ou pressionar **Escape** → fecha e limpa o filtro
- Itens **selecionados** ficam com fundo azul na lista
- Items com filhos mostram seta **▶/▼** para expandir/colapsar (somente sem filtro ativo)
- Botões **Todas** / **Nenhuma** no rodapé do dropdown

---

## Exemplo completo

```html
<div id="filtroEquipes"></div>

<script src="static/tree-multiselect.js"></script>
<script>
const equipes = [
    { id: 1, label: 'PRF',        parentId: null },
    { id: 2, label: 'BDI Serra',  parentId: 1    },
    { id: 3, label: 'BPMA',       parentId: null },
];

const tms = new TreeMultiSelect('filtroEquipes', {
    items: equipes,
    placeholder: 'Filtrar equipes...',
    onchange: (ids) => aplicarFiltro(ids)
});

// Pré-selecionar programaticamente
tms.setValue([2, 3]);

// Ler seleção
console.log(tms.getValue());     // [2, 3]
console.log(tms.getEffective()); // [2, 3]  (2 é filho de 1 que não está marcado)

// Recarregar lista após fetch
fetch('/api/equipes')
    .then(r => r.json())
    .then(data => tms.refresh(data.map(e => ({
        id: e.id_equipe,
        label: e.equipe,
        parentId: e.id_equipe_pai || null
    }))));
</script>
```

---

## Classes CSS geradas (para override)

| Classe           | Elemento                                  |
|------------------|-------------------------------------------|
| `.tms-wrapper`   | container externo (position:relative)     |
| `.tms-field`     | campo visível com chips e input           |
| `.tms-chip`      | tag de item selecionado — pill transparente, borda cinza, texto preto, `×` antes do label |
| `.tms-chip-more` | contador "+N" quando há mais que maxChips — fundo cinza claro, borda cinza |
| `.tms-input`     | input de busca interno                    |
| `.tms-panel`     | dropdown (position:absolute)              |
| `.tms-list`      | lista de itens dentro do dropdown         |
| `.tms-row`       | linha de item na lista                    |
| `.tms-row.tms-selected` | linha com item selecionado         |
| `.tms-row-lbl`   | label do item; `<mark>` para highlight    |
| `.tms-toggle`    | seta ▶/▼ de expand/collapse              |
| `.tms-panel-footer` | rodapé com botões Todas/Nenhuma       |

Para sobrescrever estilos, use seletores mais específicos ou `!important` após o carregamento do script.
