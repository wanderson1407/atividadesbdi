/**
 * TreeMultiSelect — Combo-box compacto com seleção múltipla e hierarquia
 *
 * Uso:
 *   const tms = new TreeMultiSelect(containerEl, {
 *     label: 'Equipes',
 *     items: [{id, label, parentId}],   // parentId null = raiz
 *     selected: [id1, id2],              // IDs selecionados inicialmente
 *     placeholder: 'Buscar...',
 *     onchange: (ids) => {}              // callback ao mudar seleção
 *   });
 *   tms.getValue()        → [id, ...] selecionados
 *   tms.getEffective()    → [id, ...] nó mais profundo de cada galho
 *   tms.setValue([...])   → define seleção programaticamente
 *   tms.selectAll()
 *   tms.deselectAll()
 *   tms.refresh(items)    → recarrega items (ex: após novo cadastro)
 *   tms.destroy()         → remove listeners e limpa container
 */
(function () {
    // ── Injetar CSS uma única vez ─────────────────────────────────────────
    if (!document.getElementById('tms-styles')) {
        const style = document.createElement('style');
        style.id = 'tms-styles';
        style.textContent = `
            .tms-wrapper { position: relative; font-size: 13px; box-sizing: border-box; }
            .tms-field {
                display: flex; flex-wrap: wrap; align-items: center; gap: 4px;
                min-height: 36px; padding: 4px 8px; cursor: text;
                border: 1px solid #ccc; border-radius: 4px; background: #fff;
                box-sizing: border-box;
            }
            .tms-field:focus-within {
                border-color: #4a90e2;
                box-shadow: 0 0 0 2px rgba(74,144,226,.2);
            }
            .tms-chip {
                display: inline-flex; align-items: center; gap: 4px;
                background: transparent; color: #222;
                border: 1px solid #999; border-radius: 12px;
                padding: 2px 8px; font-size: 12px; max-width: 100%;
                overflow: hidden; flex-shrink: 1; min-width: 0;
            }
            .tms-chip > span:first-child {
                overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
            }
            .tms-chip-x {
                cursor: pointer; font-size: 13px; line-height: 1; opacity: .6;
                flex-shrink: 0; order: -1;
            }
            .tms-chip-x:hover { opacity: 1; }
            .tms-chip-more { background: #f0f0f0; color: #555; border: 1px solid #ccc; }
            .tms-input {
                border: none; outline: none; font-size: 13px; background: transparent;
                flex: 1 1 80px; min-width: 60px; padding: 0;
            }
            .tms-panel {
                position: absolute; top: calc(100% + 2px); left: 0; right: 0;
                min-width: 360px;
                z-index: 9999; background: #fff; border: 1px solid #ccc;
                border-radius: 4px; box-shadow: 0 4px 14px rgba(0,0,0,.18);
                display: none; flex-direction: column; max-height: 370px;
            }
            .tms-panel.tms-open { display: flex; }
            .tms-panel-footer {
                display: flex; gap: 6px; padding: 5px 8px;
                border-top: 1px solid #eee; flex-shrink: 0;
            }
            .tms-btn {
                font-size: 11px; padding: 2px 9px; border-radius: 3px;
                border: 1px solid #d0d0d0; background: #f5f5f5;
                color: #333; cursor: pointer;
            }
            .tms-btn:hover { background: #e5e5e5; }
            .tms-list { overflow-y: auto; flex: 1; }
            .tms-row {
                display: flex; align-items: center; gap: 4px;
                padding: 5px 8px; cursor: pointer; user-select: none;
                box-sizing: border-box;
            }
            .tms-row:hover { background: #f0f5fc; }
            .tms-row.tms-selected { background: #dbeafe; }
            .tms-row input[type=checkbox] { cursor: pointer; flex-shrink: 0; margin: 0; }
            .tms-row-lbl { flex: 1; font-size: 13px; line-height: 1.4; white-space: normal; word-break: break-word; }
            .tms-row-lbl mark { background: #fef08a; border-radius: 2px; padding: 0 1px; font-style: normal; }
            .tms-toggle {
                width: 16px; text-align: center; flex-shrink: 0;
                font-size: 10px; color: #888; cursor: pointer;
            }
            .tms-empty { padding: 10px 12px; color: #999; font-size: 12px; text-align: center; }
        `;
        document.head.appendChild(style);
    }

class TreeMultiSelect {
    constructor(container, opts = {}) {
        this.container = typeof container === 'string'
            ? document.getElementById(container)
            : container;
        this.items = opts.items || [];
        this.selectedIds = new Set((opts.selected || []).map(Number));
        this.placeholder = opts.placeholder || 'Buscar...';
        this.onchange = opts.onchange || null;
        this.maxChips = opts.maxChips != null ? opts.maxChips : 3;
        this._expanded = new Set();
        this._filter = '';
        this._open = false;
        this._render();
    }

    // ── Árvore ────────────────────────────────────────────────────────────
    _buildTree(items) {
        const map = {};
        items.forEach(it => { map[it.id] = { ...it, children: [] }; });
        const roots = [];
        items.forEach(it => {
            if (it.parentId && map[it.parentId]) {
                map[it.parentId].children.push(map[it.id]);
            } else {
                roots.push(map[it.id]);
            }
        });
        return roots;
    }

    _sortNodes(nodes) {
        return [...nodes].sort((a, b) =>
            a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' })
        );
    }

    // ── Render inicial ────────────────────────────────────────────────────
    _render() {
        this.container.innerHTML = '';

        // wrapper
        this.el = document.createElement('div');
        this.el.className = 'tms-wrapper';

        // campo (trigger)
        this.field = document.createElement('div');
        this.field.className = 'tms-field';

        this.chipsEl = document.createElement('span');
        this.chipsEl.style.display = 'contents';

        this.inputEl = document.createElement('input');
        this.inputEl.type = 'text';
        this.inputEl.className = 'tms-input';
        this.inputEl.placeholder = this.placeholder;
        this.inputEl.autocomplete = 'off';
        this.inputEl.spellcheck = false;

        this.field.appendChild(this.chipsEl);
        this.field.appendChild(this.inputEl);

        // painel dropdown
        this.panel = document.createElement('div');
        this.panel.className = 'tms-panel';

        this.listEl = document.createElement('div');
        this.listEl.className = 'tms-list';

        const footer = document.createElement('div');
        footer.className = 'tms-panel-footer';

        const btnAll = document.createElement('button');
        btnAll.type = 'button';
        btnAll.className = 'tms-btn';
        btnAll.textContent = 'Todas';
        btnAll.addEventListener('mousedown', e => {
            e.preventDefault(); e.stopPropagation(); this.selectAll();
        });

        const btnNone = document.createElement('button');
        btnNone.type = 'button';
        btnNone.className = 'tms-btn';
        btnNone.textContent = 'Nenhuma';
        btnNone.addEventListener('mousedown', e => {
            e.preventDefault(); e.stopPropagation(); this.deselectAll();
        });

        footer.appendChild(btnAll);
        footer.appendChild(btnNone);

        this.panel.appendChild(this.listEl);
        this.panel.appendChild(footer);

        this.el.appendChild(this.field);
        this.el.appendChild(this.panel);
        this.container.appendChild(this.el);

        // ── Eventos ───────────────────────────────────────────────────────
        this.field.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('tms-chip-x')) return;
            if (!this._open) {
                e.preventDefault();
                this._openDropdown();
            }
        });

        this.inputEl.addEventListener('input', () => {
            this._filter = this.inputEl.value;
            if (!this._open) this._openDropdown();
            this._updateList();
        });

        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { e.stopPropagation(); this._closeDropdown(); }
        });

        this._outsideHandler = (e) => {
            if (!this.el.contains(e.target)) this._closeDropdown();
        };
        document.addEventListener('mousedown', this._outsideHandler);

        this._updateChips();
        this._updateList();
    }

    // ── Dropdown ──────────────────────────────────────────────────────────
    _openDropdown() {
        this._open = true;
        this.panel.classList.add('tms-open');
        this.inputEl.focus();
    }

    _closeDropdown() {
        if (!this._open) return;
        this._open = false;
        this.panel.classList.remove('tms-open');
        this._filter = '';
        this.inputEl.value = '';
        this._updateList();
    }

    // ── Chips no campo ────────────────────────────────────────────────────
    _updateChips() {
        this.chipsEl.innerHTML = '';
        const sel = this.items.filter(it => this.selectedIds.has(it.id));

        if (sel.length === 0) {
            this.inputEl.placeholder = this.placeholder;
            return;
        }

        this.inputEl.placeholder = '';
        const show = sel.slice(0, this.maxChips);
        const extra = sel.length - show.length;

        show.forEach(it => {
            const chip = this._makeChip(it.label, () => {
                this.selectedIds.delete(it.id);
                this._updateChips();
                if (this._open) this._updateList();
                if (this.onchange) this.onchange(this.getValue());
            });
            this.chipsEl.appendChild(chip);
        });

        if (extra > 0) {
            const more = document.createElement('span');
            more.className = 'tms-chip tms-chip-more';
            more.textContent = `+${extra}`;
            this.chipsEl.appendChild(more);
        }
    }

    _makeChip(text, onRemove) {
        const chip = document.createElement('span');
        chip.className = 'tms-chip';
        chip.title = text;

        const lbl = document.createElement('span');
        lbl.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;';
        lbl.textContent = text;

        const x = document.createElement('span');
        x.className = 'tms-chip-x';
        x.textContent = '×';
        x.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
        });

        chip.appendChild(lbl);
        chip.appendChild(x);
        return chip;
    }

    // ── Lista de itens ────────────────────────────────────────────────────
    _updateList() {
        this.listEl.innerHTML = '';
        const filter = this._filter.toLowerCase();

        if (filter) {
            const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const normFilter = norm(filter);
            const matches = this.items.filter(it => norm(it.label).includes(normFilter));

            if (matches.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'tms-empty';
                empty.textContent = 'Nenhum resultado';
                this.listEl.appendChild(empty);
                return;
            }
            matches.forEach(it => this.listEl.appendChild(this._makeRow(it, 0, filter)));
            return;
        }

        const tree = this._buildTree(this.items);
        const renderNodes = (nodes, depth) => {
            this._sortNodes(nodes).forEach(node => {
                this.listEl.appendChild(this._makeRow(node, depth, ''));
                if (node.children.length > 0 && this._expanded.has(node.id)) {
                    renderNodes(node.children, depth + 1);
                }
            });
        };
        renderNodes(tree, 0);

        if (this.items.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'tms-empty';
            empty.textContent = 'Nenhum item';
            this.listEl.appendChild(empty);
        }
    }

    _makeRow(node, depth, rawFilter) {
        const row = document.createElement('div');
        row.className = 'tms-row' + (this.selectedIds.has(node.id) ? ' tms-selected' : '');

        if (depth > 0) {
            const pad = document.createElement('span');
            pad.style.cssText = `display:inline-block;width:${depth * 14}px;flex-shrink:0`;
            row.appendChild(pad);
        }

        const toggle = document.createElement('span');
        toggle.className = 'tms-toggle';
        if (!rawFilter && node.children && node.children.length > 0) {
            toggle.textContent = this._expanded.has(node.id) ? '▼' : '▶';
            toggle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this._expanded.has(node.id)) {
                    this._expanded.delete(node.id);
                } else {
                    this._expanded.add(node.id);
                }
                this._updateList();
            });
        }
        row.appendChild(toggle);

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = this.selectedIds.has(node.id);
        cb.addEventListener('change', (e) => {
            e.stopPropagation();
            this._toggle(node.id);
        });
        row.appendChild(cb);

        const lbl = document.createElement('span');
        lbl.className = 'tms-row-lbl';
        if (rawFilter) {
            lbl.innerHTML = this._highlight(node.label, rawFilter);
        } else {
            lbl.textContent = node.label;
        }
        row.appendChild(lbl);

        row.addEventListener('mousedown', (e) => {
            if (e.target === toggle || e.target === cb) return;
            e.preventDefault();
            this._toggle(node.id);
        });

        return row;
    }

    _highlight(text, rawFilter) {
        const idx = text.toLowerCase().indexOf(rawFilter.toLowerCase());
        if (idx < 0) return this._esc(text);
        return this._esc(text.slice(0, idx))
            + '<mark>' + this._esc(text.slice(idx, idx + rawFilter.length)) + '</mark>'
            + this._esc(text.slice(idx + rawFilter.length));
    }

    _esc(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ── Toggle com cascata pai→filhos ─────────────────────────────────────
    _getAllDescendants(id) {
        // Retorna todos os IDs descendentes (filhos, netos, etc.) de um nó
        const result = [];
        const map = {};
        this.items.forEach(it => { map[it.id] = it; });
        const visit = (nodeId) => {
            this.items.forEach(it => {
                if (Number(it.parentId) === Number(nodeId)) {
                    result.push(it.id);
                    visit(it.id);
                }
            });
        };
        visit(id);
        return result;
    }

    _toggle(id) {
        if (this.selectedIds.has(id)) {
            this.selectedIds.delete(id);
            // Desmarcar todos os descendentes também
            this._getAllDescendants(id).forEach(did => this.selectedIds.delete(did));
        } else {
            this.selectedIds.add(id);
            // Marcar todos os descendentes também
            this._getAllDescendants(id).forEach(did => this.selectedIds.add(did));
        }
        this._updateChips();
        if (this._open) this._updateList();
        if (this.onchange) this.onchange(this.getValue());
    }

    // ── API Pública ───────────────────────────────────────────────────────
    getValue() {
        return [...this.selectedIds];
    }

    getEffective() {
        if (this.selectedIds.size === 0) return [];
        const tree = this._buildTree(this.items);
        const result = [];

        const visit = (node) => {
            if (this.selectedIds.has(node.id)) {
                const selectedKids = (node.children || []).filter(c => this.selectedIds.has(c.id));
                if (selectedKids.length === 0) {
                    result.push(node.id);
                } else {
                    selectedKids.forEach(c => visit(c));
                }
            } else {
                (node.children || []).forEach(c => visit(c));
            }
        };

        tree.forEach(root => visit(root));
        return result.length > 0 ? result : [...this.selectedIds];
    }

    setValue(ids) {
        this.selectedIds = new Set((ids || []).map(Number));
        this._updateChips();
        if (this._open) this._updateList();
    }

    selectAll() {
        this.items.forEach(it => this.selectedIds.add(it.id));
        this._updateChips();
        if (this._open) this._updateList();
        if (this.onchange) this.onchange(this.getValue());
    }

    deselectAll() {
        this.selectedIds.clear();
        this._updateChips();
        if (this._open) this._updateList();
        if (this.onchange) this.onchange(this.getValue());
    }

    refresh(items) {
        this.items = items || [];
        const valid = new Set(this.items.map(it => it.id));
        for (const id of [...this.selectedIds]) {
            if (!valid.has(id)) this.selectedIds.delete(id);
        }
        this._updateChips();
        if (this._open) this._updateList();
    }

    destroy() {
        document.removeEventListener('mousedown', this._outsideHandler);
        this.container.innerHTML = '';
    }
}

window.TreeMultiSelect = TreeMultiSelect;
})();
