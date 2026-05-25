// ============================================================
// FUNÇÕES CRUD PARA EQUIPES, CATEGORIAS, PRODUTOS E USUÁRIOS
// ============================================================

// Atualizar token se mudou
function updateToken() {
    token = localStorage.getItem('token');
}

// Verificar se usuário atual é administrador
function isAdmin() {
    try {
        const userStr = localStorage.getItem('user');
        if (!userStr) return false;
        const user = JSON.parse(userStr);
        console.log('👤 Usuário atual:', user.email, 'Nível:', user.nivel);
        return user.nivel === 'administrador';
    } catch (e) {
        console.error('❌ Erro ao verificar nível do usuário:', e);
        return false;
    }
}

// ==================== EQUIPES ====================

async function carregarListaEquipes() {
    try {
        updateToken();
        const equipes = await fetchData('/equipes');
        const lista = document.getElementById('listaEquipes');
        if (!lista) return;

        if (!equipes || equipes.length === 0) {
            lista.innerHTML = '<p style="color:#666;">Nenhuma equipe cadastrada</p>';
            return;
        }

        // Constrói mapa id→equipe para lookup de nomes
        const eqMapLocal = {};
        equipes.forEach(e => { eqMapLocal[e.id_equipe] = e; });

        // Ordenação: ordena cada nível alfabeticamente
        const sortAlpha = arr => [...arr].sort((a, b) =>
            a.equipe.localeCompare(b.equipe, 'pt-BR', { sensitivity: 'base' }));

        // Monta árvore
        const roots = [];
        const children = {};
        equipes.forEach(e => {
            const pai = e.id_equipe_pai || null;
            if (pai && eqMapLocal[pai]) {
                if (!children[pai]) children[pai] = [];
                children[pai].push(e);
            } else {
                roots.push(e);
            }
        });

        // Renderiza linhas recursivamente
        const rows = [];
        const renderNode = (eq, depth) => {
            const indent = depth > 0
                ? `<span style="display:inline-block;width:${depth * 20}px;"></span>` +
                  `<span style="color:#aaa;margin-right:4px;">${'└─'}</span>`
                : '';
            const nomePai = eq.id_equipe_pai ? (eqMapLocal[eq.id_equipe_pai]?.equipe || eq.id_equipe_pai) : '—';
            rows.push(`
                <tr style="${depth > 0 ? 'background:#fafafa;' : ''}">
                    <td style="border:1px solid #dee2e6;padding:6px 8px;">${eq.id_equipe}</td>
                    <td style="border:1px solid #dee2e6;padding:6px 8px;">${indent}${eq.equipe}</td>
                    <td style="border:1px solid #dee2e6;padding:6px 8px;text-align:center;">${eq.interno_prf ? '✓' : ''}</td>
                    <td style="border:1px solid #dee2e6;padding:6px 8px;">${nomePai}</td>
                    <td style="border:1px solid #dee2e6;padding:6px 8px;text-align:center;">
                        <button onclick="editarEquipe(${eq.id_equipe})" style="padding:3px 8px;background:#ffc107;color:#000;border:none;border-radius:3px;cursor:pointer;margin-right:4px;">✏️</button>
                        <button onclick="excluirEquipe(${eq.id_equipe})" style="padding:3px 8px;background:#dc3545;color:#fff;border:none;border-radius:3px;cursor:pointer;">🗑️</button>
                    </td>
                </tr>`);
            const filhos = children[eq.id_equipe];
            if (filhos) sortAlpha(filhos).forEach(f => renderNode(f, depth + 1));
        };

        sortAlpha(roots).forEach(r => renderNode(r, 0));

        lista.innerHTML = `
            <table style="width:100%;border-collapse:collapse;">
                <thead>
                    <tr style="background:#f2f2f2;">
                        <th style="border:1px solid #dee2e6;padding:8px;text-align:left;width:50px;">ID</th>
                        <th style="border:1px solid #dee2e6;padding:8px;text-align:left;">Nome</th>
                        <th style="border:1px solid #dee2e6;padding:8px;text-align:center;width:80px;">PRF</th>
                        <th style="border:1px solid #dee2e6;padding:8px;text-align:left;">Equipe Pai</th>
                        <th style="border:1px solid #dee2e6;padding:8px;text-align:center;width:100px;">Ações</th>
                    </tr>
                </thead>
                <tbody>${rows.join('')}</tbody>
            </table>`;
    } catch (error) {
        console.error('Erro ao carregar lista de equipes:', error);
        const lista = document.getElementById('listaEquipes');
        if (lista) lista.innerHTML = '<p style="color:#dc3545;">Erro ao carregar lista</p>';
    }
}

async function editarEquipe(id) {
    try {
        const equipes = await fetchData('/equipes');
        const equipe = equipes.find(e => e.id_equipe == id);
        
        if (!equipe) {
            alert('Equipe não encontrada');
            return;
        }
        
        document.getElementById('id_equipe_edit').value = equipe.id_equipe;
        document.getElementById('equipe').value = equipe.equipe;
        document.getElementById('interno_prf').checked = equipe.interno_prf;
        const selPai = document.getElementById('id_equipe_pai');
        if (selPai) selPai.value = equipe.id_equipe_pai || '';
        document.getElementById('btnCancelarEquipe').style.display = 'inline-block';
        
        // Scroll para o formulário
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        alert('Erro ao carregar dados da equipe');
    }
}

async function excluirEquipe(id) {
    if (!confirm(`Tem certeza que deseja excluir a equipe ID ${id}?`)) return;
    
    try {
        const response = await fetch(`${API_BASE}/equipes/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            alert('Equipe excluída com sucesso!');
            await loadEquipes();
            carregarListaEquipes();
        } else {
            const error = await response.json();
            alert(`Erro ao excluir: ${error.detail || 'Erro desconhecido'}`);
        }
    } catch (error) {
        alert(`Erro: ${error.message}`);
    }
}

function cancelarEdicaoEquipe() {
    document.getElementById('formEquipe').reset();
    document.getElementById('id_equipe_edit').value = '';
    const selPai = document.getElementById('id_equipe_pai');
    if (selPai) selPai.value = '';
    document.getElementById('btnCancelarEquipe').style.display = 'none';
}

// ==================== CATEGORIAS ====================

async function carregarListaCategorias() {
    try {
        const categorias = await fetchData('/categorias');
        const lista = document.getElementById('listaCategorias');
        
        if (!lista) return;
        
        if (Object.keys(categorias).length === 0) {
            lista.innerHTML = '<p style="color:#666;">Nenhuma categoria cadastrada</p>';
            return;
        }
        
        lista.innerHTML = `
            <table style="width:100%;border-collapse:collapse;">
                <thead>
                    <tr style="background:#f2f2f2;">
                        <th style="border:1px solid #dee2e6;padding:8px;text-align:left;">ID</th>
                        <th style="border:1px solid #dee2e6;padding:8px;text-align:left;">Nome</th>
                        <th style="border:1px solid #dee2e6;padding:8px;text-align:center;width:150px;">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.values(categorias).map(cat => `
                        <tr>
                            <td style="border:1px solid #dee2e6;padding:8px;">${cat.id_categoria_atividade}</td>
                            <td style="border:1px solid #dee2e6;padding:8px;">${cat.categoria_atividade}</td>
                            <td style="border:1px solid #dee2e6;padding:8px;text-align:center;">
                                <button onclick="editarCategoria(${cat.id_categoria_atividade})" style="padding:4px 8px;background:#ffc107;color:#000;border:none;border-radius:3px;cursor:pointer;margin-right:4px;">✏️ Editar</button>
                                <button onclick="excluirCategoria(${cat.id_categoria_atividade})" style="padding:4px 8px;background:#dc3545;color:#fff;border:none;border-radius:3px;cursor:pointer;">🗑️ Excluir</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Erro ao carregar lista de categorias:', error);
    }
}

async function editarCategoria(id) {
    try {
        const categorias = await fetchData('/categorias');
        const categoria = categorias.find(c => c.id_categoria_atividade == id);
        
        if (!categoria) {
            alert('Categoria não encontrada');
            return;
        }
        
        document.getElementById('id_categoria_edit').value = categoria.id_categoria_atividade;
        document.getElementById('categoria_atividade').value = categoria.categoria_atividade;
        document.getElementById('btnCancelarCategoria').style.display = 'inline-block';
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        alert('Erro ao carregar dados da categoria');
    }
}

async function excluirCategoria(id) {
    if (!confirm(`Tem certeza que deseja excluir a categoria ID ${id}?`)) return;
    
    try {
        const response = await fetch(`${API_BASE}/categorias/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            alert('Categoria excluída com sucesso!');
            await loadCategorias();
            carregarListaCategorias();
        } else {
            const error = await response.json();
            alert(`Erro ao excluir: ${error.detail || 'Erro desconhecido'}`);
        }
    } catch (error) {
        alert(`Erro: ${error.message}`);
    }
}

function cancelarEdicaoCategoria() {
    document.getElementById('formCategoria').reset();
    document.getElementById('id_categoria_edit').value = '';
    document.getElementById('btnCancelarCategoria').style.display = 'none';
}

// ==================== PRODUTOS ====================

async function carregarListaProdutos() {
    try {
        const produtos = await fetchData('/produtos');
        const lista = document.getElementById('listaProdutos');
        
        if (!lista) return;
        
        if (produtos.length === 0) {
            lista.innerHTML = '<p style="color:#666;">Nenhum produto cadastrado</p>';
            return;
        }
        
        lista.innerHTML = `
            <table style="width:100%;border-collapse:collapse;">
                <thead>
                    <tr style="background:#f2f2f2;">
                        <th style="border:1px solid #dee2e6;padding:8px;text-align:left;">ID</th>
                        <th style="border:1px solid #dee2e6;padding:8px;text-align:left;">Produto</th>
                        <th style="border:1px solid #dee2e6;padding:8px;text-align:left;">Categoria</th>
                        <th style="border:1px solid #dee2e6;padding:8px;text-align:left;">Medida</th>
                        <th style="border:1px solid #dee2e6;padding:8px;text-align:left;">Tipo</th>
                        <th style="border:1px solid #dee2e6;padding:8px;text-align:center;width:150px;">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${produtos.map(prod => `
                        <tr>
                            <td style="border:1px solid #dee2e6;padding:8px;">${prod.id_produto_atividade}</td>
                            <td style="border:1px solid #dee2e6;padding:8px;">${prod.produto_atividade}</td>
                            <td style="border:1px solid #dee2e6;padding:8px;">${categoriaMap[prod.id_categoria_atividade] || prod.id_categoria_atividade}</td>
                            <td style="border:1px solid #dee2e6;padding:8px;">${prod.medida}</td>
                            <td style="border:1px solid #dee2e6;padding:8px;">${prod.tipo_numero}</td>
                            <td style="border:1px solid #dee2e6;padding:8px;text-align:center;">
                                <button onclick="editarProduto(${prod.id_produto_atividade})" style="padding:4px 8px;background:#ffc107;color:#000;border:none;border-radius:3px;cursor:pointer;margin-right:4px;">✏️ Editar</button>
                                <button onclick="excluirProduto(${prod.id_produto_atividade})" style="padding:4px 8px;background:#dc3545;color:#fff;border:none;border-radius:3px;cursor:pointer;">🗑️ Excluir</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Erro ao carregar lista de produtos:', error);
    }
}

async function editarProduto(id) {
    try {
        const produto = produtosData.find(p => p.id_produto_atividade == id);
        
        if (!produto) {
            alert('Produto não encontrado');
            return;
        }
        
        document.getElementById('id_produto_edit').value = produto.id_produto_atividade;
        document.getElementById('id_categoria_atividade').value = produto.id_categoria_atividade;
        document.getElementById('produto_atividade').value = produto.produto_atividade;
        document.getElementById('medida').value = produto.medida;
        document.getElementById('tipo_numero').value = produto.tipo_numero;
        document.getElementById('btnCancelarProduto').style.display = 'inline-block';
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        alert('Erro ao carregar dados do produto');
    }
}

async function excluirProduto(id) {
    if (!confirm(`Tem certeza que deseja excluir o produto ID ${id}?`)) return;
    
    try {
        const response = await fetch(`${API_BASE}/produtos/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            alert('Produto excluído com sucesso!');
            await loadProdutos();
            carregarListaProdutos();
        } else {
            const error = await response.json();
            alert(`Erro ao excluir: ${error.detail || 'Erro desconhecido'}`);
        }
    } catch (error) {
        alert(`Erro: ${error.message}`);
    }
}

function cancelarEdicaoProduto() {
    document.getElementById('formProduto').reset();
    document.getElementById('id_produto_edit').value = '';
    document.getElementById('btnCancelarProduto').style.display = 'none';
}

// ==================== USUÁRIOS ====================

async function carregarListaUsuarios() {
    try {
        updateToken(); // Atualizar token antes de fazer requisição
        console.log('🔑 Token para /usuarios:', token ? 'Presente' : 'Ausente');
        
        const lista = document.getElementById('listaUsuarios');
        if (!lista) return;
        
        // Verificar se usuário é admin
        if (!isAdmin()) {
            lista.innerHTML = '<p style="color:#dc3545;">⚠️ Acesso negado. Apenas administradores podem gerenciar usuários.</p>';
            console.warn('⚠️ Usuário sem permissão de admin para acessar /usuarios');
            return;
        }
        
        const response = await fetch(`${API_BASE}/usuarios`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log('📡 Response status /usuarios:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Erro ao carregar usuários:', response.status, errorText);
            lista.innerHTML = '<p style="color:#dc3545;">Erro ao carregar usuários. Status: ' + response.status + '</p>';
            return;
        }
        
        const usuarios = await response.json();
        
        if (usuarios.length === 0) {
            lista.innerHTML = '<p style="color:#666;">Nenhum usuário cadastrado</p>';
            return;
        }
        
        lista.innerHTML = `
            <table style="width:100%;border-collapse:collapse;">
                <thead>
                    <tr style="background:#f2f2f2;">
                        <th style="border:1px solid #dee2e6;padding:8px;text-align:left;">Email</th>
                        <th style="border:1px solid #dee2e6;padding:8px;text-align:left;">Nome</th>
                        <th style="border:1px solid #dee2e6;padding:8px;text-align:left;">Nível</th>
                        <th style="border:1px solid #dee2e6;padding:8px;text-align:center;width:150px;">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${usuarios.map(user => `
                        <tr>
                            <td style="border:1px solid #dee2e6;padding:8px;">${user.email}</td>
                            <td style="border:1px solid #dee2e6;padding:8px;">${user.nome}</td>
                            <td style="border:1px solid #dee2e6;padding:8px;">${user.nivel}</td>
                            <td style="border:1px solid #dee2e6;padding:8px;text-align:center;">
                                <button onclick="editarUsuario('${user.email}')" style="padding:4px 8px;background:#ffc107;color:#000;border:none;border-radius:3px;cursor:pointer;margin-right:4px;">✏️ Editar</button>
                                <button onclick="excluirUsuario('${user.email}')" style="padding:4px 8px;background:#dc3545;color:#fff;border:none;border-radius:3px;cursor:pointer;">🗑️ Excluir</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Erro ao carregar lista de usuários:', error);
    }
}

async function editarUsuario(email) {
    try {
        const response = await fetch(`${API_BASE}/usuarios/${encodeURIComponent(email)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            alert('Erro ao carregar dados do usuário');
            return;
        }
        
        const usuario = await response.json();
        
        document.getElementById('email').value = usuario.email;
        document.getElementById('email').disabled = true; // Email não pode ser alterado
        document.getElementById('nome').value = usuario.nome;
        document.getElementById('nivel').value = usuario.nivel;
        document.getElementById('email_edit').value = usuario.email;
        document.getElementById('btnCancelarUsuario').style.display = 'inline-block';
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        alert('Erro ao carregar dados do usuário');
    }
}

async function excluirUsuario(email) {
    if (!confirm(`Tem certeza que deseja excluir o usuário ${email}?`)) return;
    
    try {
        const response = await fetch(`${API_BASE}/usuarios/${encodeURIComponent(email)}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            alert('Usuário excluído com sucesso!');
            carregarListaUsuarios();
        } else {
            const error = await response.json();
            alert(`Erro ao excluir: ${error.detail || 'Erro desconhecido'}`);
        }
    } catch (error) {
        alert(`Erro: ${error.message}`);
    }
}

function cancelarEdicaoUsuario() {
    document.getElementById('formUsuario').reset();
    document.getElementById('email').disabled = false;
    document.getElementById('email_edit').value = '';
    document.getElementById('btnCancelarUsuario').style.display = 'none';
}

// ==================== ATIVIDADES ====================

async function editarAtividade(id) {
    try {
        // Marcar que está editando da lista (para voltar à lista após salvar)
        localStorage.setItem('editingFromList', 'true');
        
        // Salvar estado atual da lista (filtros + dados)
        const _contEquipeLista = document.getElementById('tmsListaEquipe');
        const _contCategoriaLista = document.getElementById('tmsListaCategoria');
        const _contProdutoLista = document.getElementById('tmsListaProduto');
        const filtrosAtuais = {
            dataInicio: document.getElementById('listaDataInicio')?.value,
            dataFim: document.getElementById('listaDataFim')?.value,
            equipe: (_contEquipeLista && _contEquipeLista._tmsInstance) ? _contEquipeLista._tmsInstance.getValue().map(String) : [],
            categoria: (_contCategoriaLista && _contCategoriaLista._tmsInstance) ? _contCategoriaLista._tmsInstance.getValue().map(String) : [],
            produto: (_contProdutoLista && _contProdutoLista._tmsInstance) ? _contProdutoLista._tmsInstance.getValue().map(String) : [],
            consultaTexto: document.getElementById('buscaAtividades')?.value
        };
        localStorage.setItem('listaAtividadesFiltros', JSON.stringify(filtrosAtuais));
        
        // Salvar atividades já carregadas (se existirem)
        if (typeof atividadesListaGlobal !== 'undefined' && atividadesListaGlobal.length > 0) {
            localStorage.setItem('listaAtividadesDados', JSON.stringify(atividadesListaGlobal));
        }
        
        // Buscar dados da atividade
        const response = await fetch(`${API_BASE}/atividades?id_atividade=${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            alert('Erro ao carregar atividade');
            return;
        }
        
        const atividades = await response.json();
        const atividade = atividades.find(a => a.id_atividade === id);
        
        if (!atividade) {
            alert('Atividade não encontrada');
            return;
        }
        
        // Ir para a tela de inserir atividade
        showInserirAtividade();
        
        // Aguardar a tela renderizar
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Preencher formulário (IDs corretos da tela de Inserir)
        document.getElementById('novaData').value = atividade.data;
        document.getElementById('novaDescricao').value = atividade.descricao || '';
        document.getElementById('novaCai').value = atividade.cai ? 'true' : 'false';
        
        // Selecionar equipes via TreeMultiSelect
        const _contInserirEquipe = document.getElementById('tmsInserirEquipe');
        if (_contInserirEquipe && _contInserirEquipe._tmsInstance) {
            _contInserirEquipe._tmsInstance.setValue(atividade.equipes);
        }
        
        // Limpar produtos existentes (a tabela tem tbody com ID produtosRows)
        const produtosRows = document.getElementById('produtosRows');
        produtosRows.innerHTML = ''; // Limpar linhas existentes
        
        // Adicionar produtos da atividade
        const PRODUTOS_COM_TIPIFICACAO = [18, 19, 20];
        atividade.produtos.forEach(prod => {
            const produto = produtosData.find(p => p.id_produto_atividade === prod.id_produto);
            if (produto) {
                const row = document.createElement('tr');
                const rowId = Date.now() + Math.random();
                const temTipificacao = PRODUTOS_COM_TIPIFICACAO.includes(prod.id_produto);
                
                row.innerHTML = `
                    <td style="padding:8px;border:1px solid var(--taura-border);">
                        <input type="text" class="produtoSearch" placeholder="Digite para buscar produto..." 
                            style="width:100%;padding:8px;" autocomplete="off" list="produtosList_${rowId}" value="${produtoMap[prod.id_produto] || ''}">
                        <datalist id="produtosList_${rowId}"></datalist>
                        <select class="selectProduto" style="display:none;">
                            <option value="${prod.id_produto}" selected>${produtoMap[prod.id_produto] || ''}</option>
                        </select>
                    </td>
                    <td style="padding:8px;border:1px solid var(--taura-border);">
                        <input type="text" class="inputQuantidade" value="${prod.quantidade}" 
                            style="width:100%;padding:8px;" placeholder="" inputmode="decimal">
                    </td>
                    <td style="padding:8px;border:1px solid var(--taura-border);">
                        <input type="text" class="inputMedidaTipo" readonly value="${produto.medida} - ${produto.tipo_numero}"
                            style="width:100%;padding:8px;background:#e8f4fd;color:#1b1464;font-weight:500;text-align:center;">
                    </td>
                    <td style="padding:8px;border:1px solid var(--taura-border);">
                        <input type="text" class="inputCategoria" readonly value="${categoriaMap[produto.id_categoria_atividade] || ''}"
                            style="width:100%;padding:8px;background:#f0f0f0;">
                    </td>
                    <td class="tdTipificacao" style="padding:8px;border:1px solid var(--taura-border);min-width:300px;${temTipificacao ? '' : 'display:none;'}">
                        <div class="tmsTipificacaoContainer"></div>
                        <div style="font-size:11px;color:#666;margin-top:4px;">
                            <button type="button" class="btnNovaTipificacao" style="font-size:11px;padding:2px 6px;background:var(--pbi-accent-blue);color:#fff;border:none;border-radius:3px;cursor:pointer;">+ Nova</button>
                        </div>
                    </td>
                    <td style="padding:8px;border:1px solid var(--taura-border);text-align:center;">
                        <button type="button" class="btnRemoveProduto" style="background:#dc3545;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;">✕</button>
                    </td>
                `;
                
                produtosRows.appendChild(row);
                
                // Inicializar multiselectw de tipificação
                const tipContainer = row.querySelector('.tmsTipificacaoContainer');
                const tmsTip = new TreeMultiSelect(tipContainer, {
                    placeholder: 'Buscar tipificação...',
                    maxChips: 2
                });
                row._tmsTipificacao = tmsTip;

                // Carregar e restaurar tipificações selecionadas
                function popularERestaurarTip() {
                    const items = tipificacoesData.map(t => ({
                        id: t.id_tipificacao,
                        label: [t.lei || '', `art.${t.artigo}`, t.paragrafo ? `§${t.paragrafo}` : '', t.inciso ? `inc.${t.inciso}` : '', '-', t.descricao].filter(Boolean).join(' ').trim(),
                        parentId: null
                    }));
                    tmsTip.refresh(items);
                    if (prod.tipificacoes && prod.tipificacoes.length > 0) {
                        tmsTip.setValue(prod.tipificacoes);
                    }
                }
                if (tipificacoesData.length === 0) {
                    fetchData('/tipificacoes').then(data => { tipificacoesData = data; popularERestaurarTip(); });
                } else {
                    popularERestaurarTip();
                }

                // Botão nova tipificação
                row.querySelector('.btnNovaTipificacao').addEventListener('click', () => {
                    showModalNovaTipificacao((novaTip) => {
                        tipificacoesData.push(novaTip);
                        const items = tipificacoesData.map(t => ({
                            id: t.id_tipificacao,
                            label: [t.lei || '', `art.${t.artigo}`, t.paragrafo ? `§${t.paragrafo}` : '', t.inciso ? `inc.${t.inciso}` : '', '-', t.descricao].filter(Boolean).join(' ').trim(),
                            parentId: null
                        }));
                        tmsTip.refresh(items);
                    });
                });

                // Adicionar event listener para remover linha
                row.querySelector('.btnRemoveProduto').addEventListener('click', () => row.remove());
            }
        });
        
        // Adicionar campo oculto com ID da atividade para indicar modo de edição
        let idEditInput = document.getElementById('id_atividade_edit');
        if (!idEditInput) {
            idEditInput = document.createElement('input');
            idEditInput.type = 'hidden';
            idEditInput.id = 'id_atividade_edit';
            document.getElementById('formNovaAtividade').appendChild(idEditInput);
        }
        idEditInput.value = id;
        
        // Adicionar botão de excluir (antes do botão Salvar)
        const formButtons = document.querySelector('#formNovaAtividade button[type="submit"]').parentElement;
        if (!document.getElementById('btnExcluirAtividade')) {
            const btnExcluir = document.createElement('button');
            btnExcluir.type = 'button';
            btnExcluir.id = 'btnExcluirAtividade';
            btnExcluir.onclick = () => excluirAtividade(id);
            btnExcluir.style.cssText = 'padding:10px 24px;background:#dc3545;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:16px;margin-right:10px;';
            btnExcluir.textContent = '🗑️ Excluir Atividade';
            formButtons.insertBefore(btnExcluir, formButtons.firstChild);
        }
        
        // Trocar texto do botão salvar
        const btnSalvar = document.querySelector('#formNovaAtividade button[type="submit"]');
        btnSalvar.textContent = '💾 Atualizar Atividade';
        
        // Scroll para o topo
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
    } catch (error) {
        console.error('Erro ao editar atividade:', error);
        alert('Erro ao carregar dados da atividade');
    }
}

async function excluirAtividade(id) {
    if (!confirm(`Tem certeza que deseja excluir a atividade ID ${id}?`)) return;
    
    try {
        const response = await fetch(`${API_BASE}/atividades/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            alert('Atividade excluída com sucesso!');
            showAtividadesCadastradas();
        } else {
            const error = await response.json();
            alert(`Erro ao excluir: ${error.detail || 'Erro desconhecido'}`);
        }
    } catch (error) {
        alert(`Erro: ${error.message}`);
    }
}
