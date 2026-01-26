const API_BASE = window.location.origin;
let token = localStorage.getItem('token');
let equipeMap = {};
let categoriaMap = {};
let produtoMap = {};
let equipeInternalMap = {}; // id_equipe -> interno_prf boolean
let chartAtividadesInstance = null;
let chartEquipesInstance = null;

function checkAuth() {
    if (!token) {
        window.location.href = '/static/login-google.html';
    }
}

function logout() {
    console.log('🚪 Executando logout...');
    try {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('user_name');
        console.log('✅ localStorage limpo com sucesso');
        console.log('🔄 Redirecionando para login...');
        window.location.replace('/static/login-google.html');
    } catch (error) {
        console.error('❌ Erro no logout:', error);
        // Forçar redirecionamento mesmo com erro
        window.location.replace('/static/login-google.html');
    }
}

async function loadUserName() {
    console.log('🚀 Iniciando loadUserName() no script.js...');
    try {
        // Primeiro, tenta pegar do localStorage (salvo no login)
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                if (user && user.nome) {
                    const userNameEl = document.getElementById('userName');
                    if (userNameEl) {
                        userNameEl.textContent = user.nome.toUpperCase();
                        console.log('✅ Nome carregado do localStorage:', user.nome);
                    }
                    return;
                }
            } catch (e) {
                console.warn('⚠️ Erro ao parsear user do localStorage:', e);
            }
        }
        
        // Se não tem no localStorage, busca pela API
        const token = localStorage.getItem('token');
        console.log('🔑 Token encontrado:', token ? 'Sim' : 'Não');
        if (!token) {
            console.log('⚠️ Sem token - não é possível carregar nome');
            return;
        }
        
        // Decodificar o payload do JWT (sem validar assinatura - apenas para ler dados)
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        
        const payload = JSON.parse(jsonPayload);
        const email = payload.sub;
        console.log('📧 Email do token:', email);
        
        // Buscar dados do usuário pelo email específico
        const emailEncoded = encodeURIComponent(email);
        const response = await fetch(`${API_BASE}/usuarios/${emailEncoded}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log('🌐 Response status:', response.status);
        
        if (response.ok) {
            const usuario = await response.json();
            console.log('👤 Usuário encontrado:', usuario);
            if (usuario && usuario.nome) {
                const userNameEl = document.getElementById('userName');
                if (userNameEl) {
                    userNameEl.textContent = usuario.nome.toUpperCase();
                    console.log('✅ Nome atualizado:', usuario.nome.toUpperCase());
                }
                // Salva no localStorage para próxima vez
                localStorage.setItem('user', JSON.stringify(usuario));
                localStorage.setItem('user_name', usuario.nome);
            } else {
                console.warn('⚠️ Usuário não tem nome');
            }
        } else {
            console.error('❌ Erro na resposta da API:', response.statusText);
        }
    } catch (error) {
        console.error('❌ Erro ao carregar nome do usuário:', error);
        // Fallback para nome salvo no localStorage
        const savedName = localStorage.getItem('user_name');
        if (savedName) {
            const userNameEl = document.getElementById('userName');
            if (userNameEl) {
                userNameEl.textContent = savedName.toUpperCase();
                console.log('💾 Nome do localStorage (fallback):', savedName.toUpperCase());
            }
        }
    }
}

function showLoader() {
    document.getElementById('loader').style.display = 'inline-block';
    document.getElementById('btnApply').disabled = true;
    document.getElementById('btnExport').disabled = true;
}

function hideLoader() {
    document.getElementById('loader').style.display = 'none';
    document.getElementById('btnApply').disabled = false;
    document.getElementById('btnExport').disabled = false;
}

async function fetchData(endpoint) {
    showLoader();
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (response.status === 401) {
            console.error('❌ Token inválido ou expirado (401). Redirecionando para login...');
            alert('Sua sessão expirou. Por favor, faça login novamente.');
            logout();
            throw new Error('Token expirado');
        }
        if (!response.ok) {
            throw new Error('Erro na requisição');
        }
        return await response.json();
    } finally {
        hideLoader();
    }
}

async function loadEquipes() {
    try {
        const equipes = await fetchData('/equipes');
        equipeMap = {};
        const select = document.getElementById('equipeSelect');
        select.innerHTML = '';
        equipes.forEach(equipe => {
            equipeMap[equipe.id_equipe] = equipe.equipe;
            equipeInternalMap[equipe.id_equipe] = !!equipe.interno_prf;
            const option = document.createElement('option');
            option.value = equipe.id_equipe;
            option.text = equipe.equipe;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar equipes:', error);
    }
}

async function loadCategorias() {
    try {
        const categorias = await fetchData('/categorias');
        categoriaMap = {};
        const select = document.getElementById('categoriaSelect');
        select.innerHTML = '';
        categorias.forEach(categoria => {
            categoriaMap[categoria.id_categoria_atividade] = categoria.categoria_atividade;
            const option = document.createElement('option');
            option.value = categoria.id_categoria_atividade;
            option.text = categoria.categoria_atividade;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
    }
}

async function loadProdutos() {
    try {
        const produtos = await fetchData('/produtos');
        produtoMap = {};
        const select = document.getElementById('produtoSelect');
        select.innerHTML = '';
        produtos.forEach(produto => {
            produtoMap[produto.id_produto_atividade] = produto.produto_atividade;
            const option = document.createElement('option');
            option.value = produto.id_produto_atividade;
            option.text = produto.produto_atividade;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
    }
}

async function loadAtividades(filtros = {}) {
    try {
        // Request filters to backend (server-side filtering when possible)
        let url = '/atividades';
        const params = new URLSearchParams();
        if (filtros.dataInicio) params.append('data_inicio', filtros.dataInicio);
        if (filtros.dataFim) params.append('data_fim', filtros.dataFim);
        (filtros.equipe || []).forEach(v => params.append('id_equipe', v));
        (filtros.categoria || []).forEach(v => params.append('id_categoria', v));
        (filtros.produto || []).forEach(v => params.append('id_produto', v));
        if (filtros.consultaTexto) params.append('consulta', filtros.consultaTexto);
        if (params.toString()) url += '?' + params.toString();

        const atividadesRaw = await fetchData(url);
        // ainda mantemos filtros client-side como segunda camada de segurança
        const atividades = filterActivities(atividadesRaw, filtros);
        renderTable(atividades);
        renderCharts(atividades);
        updateIndicators(atividades);
    } catch (error) {
        console.error('Erro ao carregar atividades:', error);
    }
}

function filterActivities(atividades, filtros){
    const dataQ = (s) => s === null || s === undefined ? '' : String(s).toLowerCase();
    const selectedEquipes = (filtros.equipe || []).map(v => Number(v)).filter(v => !isNaN(v) && v !== 0);
    const selectedCategorias = (filtros.categoria || []).map(v => Number(v)).filter(v => !isNaN(v) && v !== 0);
    const selectedProdutos = (filtros.produto || []).map(v => Number(v)).filter(v => !isNaN(v) && v !== 0);
    const consulta = (filtros.consultaTexto || '').trim().toLowerCase();

    return atividades.filter(a => {
        // equipe filter (if any selected)
        if (selectedEquipes.length){
            const equipesIds = (a.equipes || []).map(x => Number(x));
            const any = selectedEquipes.some(s => equipesIds.includes(s));
            if (!any) return false;
        }
        // categoria filter
        if (selectedCategorias.length){
            const catIds = (a.categorias || []).map(x => Number(x));
            const any = selectedCategorias.some(s => catIds.includes(s));
            if (!any) return false;
        }
        // produto filter
        if (selectedProdutos.length){
            const produtoIds = (a.produtos || []).map(p => Number(p.id_produto));
            const any = selectedProdutos.some(s => produtoIds.includes(s));
            if (!any) return false;
        }
        // consulta texto (buscar em campos relevantes)
        if (consulta){
            const fields = [];
            fields.push(dataQ(a.descricao));
            fields.push(dataQ(a.id_atividade));
            fields.push(dataQ(a.data));
            // equipes names
            if (a.equipes) fields.push(a.equipes.map(id => dataQ(equipeMap[id] || id)).join(' '));
            // categorias names
            if (a.categorias) fields.push(a.categorias.map(id => dataQ(categoriaMap[id] || id)).join(' '));
            // produtos names
            if (a.produtos) fields.push(a.produtos.map(p => dataQ(produtoMap[p.id_produto] || p.id_produto)).join(' '));
            const hay = fields.join(' ');
            if (!hay.includes(consulta)) return false;
        }
        return true;
    });
}

function updateIndicators(atividades){
    // Total de atividades
    const total = atividades.length;
    // Internos: todas as equipes da atividade têm interno_prf == true
    let internos = 0;
    let conjuntas = 0;
    atividades.forEach(a => {
        const equipes = a.equipes || [];
        if (equipes.length === 0) return;
        const allInternos = equipes.every(id => equipeInternalMap[id] === true);
        if (allInternos) internos += 1;
        else conjuntas += 1;
    });
    const elTotal = document.getElementById('totalQTC');
    if (elTotal) elTotal.querySelector('.kpi-value').innerText = total;
    const elInt = document.getElementById('qtInternos');
    if (elInt) elInt.querySelector('.kpi-value').innerText = internos;
    const elConj = document.getElementById('qtConjuntas');
    if (elConj) elConj.querySelector('.kpi-value').innerText = conjuntas;
    // Categoria 11 e 7 counts
    const cat11 = atividades.reduce((acc,a)=> acc + ((a.categorias||[]).map(x=>Number(x)).includes(11)?1:0), 0);
    const cat7 = atividades.reduce((acc,a)=> acc + ((a.categorias||[]).map(x=>Number(x)).includes(7)?1:0), 0);
    const el11 = document.getElementById('cat11');
    if (el11) el11.querySelector('.kpi-value').innerText = cat11;
    const el7 = document.getElementById('cat7');
    if (el7) el7.querySelector('.kpi-value').innerText = cat7;
}

function renderTable(atividades) {
    const tbody = document.querySelector('#tabelaAtividades tbody');
    tbody.innerHTML = '';
    atividades.forEach(atividade => {
        const equipes = atividade.equipes.map(id => equipeMap[id] || id).join(', ');
        const categorias = atividade.categorias.map(id => categoriaMap[id] || id).join(', ');
        const produtos = atividade.produtos.map(p => `${produtoMap[p.id_produto] || p.id_produto} (${p.quantidade})`).join(', ');
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${atividade.id_atividade}</td>
            <td>${atividade.data}</td>
            <td>${equipes}</td>
            <td>${categorias}</td>
            <td>${produtos}</td>
            <td>${atividade.descricao || ''}</td>
        `;
        tbody.appendChild(row);
    });
}

function renderCharts(atividades) {
    // Gráfico de atividades por data
    const dataCounts = {};
    atividades.forEach(a => {
        const date = a.data;
        dataCounts[date] = (dataCounts[date] || 0) + 1;
    });
    const labels = Object.keys(dataCounts);
    const data = Object.values(dataCounts);

    const ctx1 = document.getElementById('chartAtividades').getContext('2d');
    if (chartAtividadesInstance) chartAtividadesInstance.destroy();
    chartAtividadesInstance = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Atividades por Data',
                data: data,
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        }
    });

    // Gráfico de atividades por equipe
    const equipeCounts = {};
    atividades.forEach(a => {
        a.equipes.forEach(id => {
            const equipe = equipeMap[id] || id;
            equipeCounts[equipe] = (equipeCounts[equipe] || 0) + 1;
        });
    });
    const labels2 = Object.keys(equipeCounts);
    const data2 = Object.values(equipeCounts);

    const ctx2 = document.getElementById('chartEquipes').getContext('2d');
    if (chartEquipesInstance) chartEquipesInstance.destroy();
    chartEquipesInstance = new Chart(ctx2, {
        type: 'pie',
        data: {
            labels: labels2,
            datasets: [{
                label: 'Atividades por Equipe',
                data: data2,
                backgroundColor: ['red', 'blue', 'green', 'yellow']
            }]
        }
    });
}

function aplicarFiltros() {
    const filtros = {
        dataInicio: document.getElementById('dataInicio').value,
        dataFim: document.getElementById('dataFim').value,
        equipe: Array.from(document.getElementById('equipeSelect').selectedOptions).map(o => o.value),
        categoria: Array.from(document.getElementById('categoriaSelect').selectedOptions).map(o => o.value),
        produto: Array.from(document.getElementById('produtoSelect').selectedOptions).map(o => o.value)
    };
    loadAtividades(filtros);
}

function exportarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFontSize(14);
    doc.text('Relatório de Atividades', 10, 10);

    const indicators = [];
    const elTotal = document.getElementById('totalQTC');
    if (elTotal) indicators.push(['Total QTCs', elTotal.querySelector('.kpi-value').innerText]);
    const elInt = document.getElementById('qtInternos');
    if (elInt) indicators.push(['QTCs Internos', elInt.querySelector('.kpi-value').innerText]);
    const elConj = document.getElementById('qtConjuntas');
    if (elConj) indicators.push(['Ações Conjuntas', elConj.querySelector('.kpi-value').innerText]);

    let y = 18;
    doc.setFontSize(11);
    indicators.forEach(i => { doc.text(`${i[0]}: ${i[1]}`, 10, y); y += 6; });

    // Capture charts and table using html2canvas
    (async () => {
        try {
            y += 4;
            const c1 = document.getElementById('chartAtividades');
            const c2 = document.getElementById('chartEquipes');
            if (c1) {
                const img1 = c1.toDataURL('image/png', 1.0);
                doc.addImage(img1, 'PNG', 10, y, 190, 70);
                y += 75;
            }
            if (c2) {
                if (y + 80 > 280) { doc.addPage(); y = 10; }
                const img2 = c2.toDataURL('image/png', 1.0);
                doc.addImage(img2, 'PNG', 10, y, 90, 70);
            }

            // capture tabela
            const table = document.getElementById('tabelaAtividades');
            if (table) {
                if (y + 100 > 280) { doc.addPage(); y = 10; }
                const canvas = await html2canvas(table, {scale:1.2});
                const img = canvas.toDataURL('image/png');
                const iw = 190; const ih = (canvas.height * iw) / canvas.width;
                doc.addImage(img, 'PNG', 10, y + 4, iw, ih);
            }
            doc.save('relatorio.pdf');
        } catch (e) {
            console.error('Erro ao gerar PDF:', e);
        }
    })();
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 DOMContentLoaded disparado no script.js');
    console.log('🔑 Token no início:', localStorage.getItem('token') ? 'Presente' : 'Ausente');
    console.log('👤 User no início:', localStorage.getItem('user') ? 'Presente' : 'Ausente');
    
    checkAuth();
    console.log('✅ checkAuth() passou');
    
    loadUserName(); // Carregar nome do usuário
    console.log('✅ loadUserName() chamado');
    
    loadEquipes();
    loadCategorias();
    loadProdutos();
    // definir datas padrão: primeiro e último dia do ano corrente
    const now = new Date();
    const start = new Date(now.getFullYear(),0,1).toISOString().slice(0,10);
    const end = new Date(now.getFullYear(),11,31).toISOString().slice(0,10);
    document.getElementById('dataInicio').value = start;
    document.getElementById('dataFim').value = end;
    loadAtividades({dataInicio:start, dataFim:end});
    
    // Setup menu navigation
    setupMenuNavigation();
});

// Variável global para armazenar atividades filtradas (usada em outras telas)
let atividadesFiltradas = [];

function setupMenuNavigation(){
    const menuInicio = document.getElementById('menuInicio');
    const menuInserir = document.getElementById('menuInserir');
    const menuAtividades = document.getElementById('menuAtividades');
    const menuConfig = document.getElementById('menuConfig');
    
    const allMenus = [menuInicio, menuInserir, menuAtividades, menuConfig];
    
    function setActive(el){
        allMenus.forEach(m => m && m.classList.remove('active'));
        if (el) el.classList.add('active');
    }
    
    if (menuInicio) menuInicio.addEventListener('click', e => {
        e.preventDefault();
        setActive(menuInicio);
        showDashboard();
    });
    
    if (menuInserir) menuInserir.addEventListener('click', e => {
        e.preventDefault();
        setActive(menuInserir);
        showInserirAtividade();
    });
    
    if (menuAtividades) menuAtividades.addEventListener('click', e => {
        e.preventDefault();
        setActive(menuAtividades);
        showAtividadesCadastradas();
    });
    
    if (menuConfig) menuConfig.addEventListener('click', e => {
        e.preventDefault();
        setActive(menuConfig);
        showConfiguracao();
    });
}

function showDashboard(){
    // Reload main dashboard view
    location.reload();
}

function showInserirAtividade(){
    const main = document.querySelector('.main-content');
    main.innerHTML = `
        <header class="topbar"><h1>Inserir Nova Atividade</h1></header>
        <section class="visual-card" style="max-width:800px;">
            <form id="formNovaAtividade">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                    <label>Data <input type="date" id="novaData" required style="width:100%;padding:8px;"></label>
                    <label>CAI <select id="novaCai" style="width:100%;padding:8px;"><option value="false">Não</option><option value="true">Sim</option></select></label>
                </div>
                <label style="display:block;margin-top:12px;">Descrição<br><textarea id="novaDescricao" rows="3" style="width:100%;padding:8px;"></textarea></label>
                
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:16px;">
                    <label>Equipes<br><select id="novaEquipes" multiple size="5" style="width:100%;"></select></label>
                    <label>Categorias<br><select id="novaCategorias" multiple size="5" style="width:100%;"></select></label>
                    <label>Produtos<br><select id="novaProdutos" multiple size="5" style="width:100%;"></select></label>
                </div>
                
                <div id="produtosQuantidades" style="margin-top:16px;"></div>
                
                <div style="margin-top:20px;">
                    <button type="submit" style="padding:10px 20px;background:var(--pbi-accent-blue);color:#fff;border:none;border-radius:4px;cursor:pointer;">Salvar Atividade</button>
                    <button type="button" onclick="showDashboard()" style="padding:10px 20px;margin-left:10px;">Cancelar</button>
                </div>
            </form>
        </section>
    `;
    
    // Populate selects
    const selEquipes = document.getElementById('novaEquipes');
    const selCategorias = document.getElementById('novaCategorias');
    const selProdutos = document.getElementById('novaProdutos');
    
    Object.entries(equipeMap).forEach(([id, nome]) => {
        const opt = document.createElement('option');
        opt.value = id; opt.text = nome;
        selEquipes.appendChild(opt);
    });
    Object.entries(categoriaMap).forEach(([id, nome]) => {
        const opt = document.createElement('option');
        opt.value = id; opt.text = nome;
        selCategorias.appendChild(opt);
    });
    Object.entries(produtoMap).forEach(([id, nome]) => {
        const opt = document.createElement('option');
        opt.value = id; opt.text = nome;
        selProdutos.appendChild(opt);
    });
    
    // When produtos selected, show quantity inputs
    selProdutos.addEventListener('change', () => {
        const container = document.getElementById('produtosQuantidades');
        container.innerHTML = '<strong>Quantidades dos Produtos:</strong><br>';
        Array.from(selProdutos.selectedOptions).forEach(opt => {
            container.innerHTML += `<label style="display:inline-block;margin:8px 16px 0 0;">${opt.text}: <input type="number" step="0.01" min="0" data-produto="${opt.value}" style="width:80px;padding:4px;" value="1"></label>`;
        });
    });
    
    // Form submit
    document.getElementById('formNovaAtividade').addEventListener('submit', async (e) => {
        e.preventDefault();
        const atividade = {
            data: document.getElementById('novaData').value,
            descricao: document.getElementById('novaDescricao').value,
            cai: document.getElementById('novaCai').value === 'true',
            equipes: Array.from(document.getElementById('novaEquipes').selectedOptions).map(o => parseInt(o.value)),
            categorias: Array.from(document.getElementById('novaCategorias').selectedOptions).map(o => parseInt(o.value)),
            produtos: Array.from(document.querySelectorAll('#produtosQuantidades input')).map(inp => ({
                id_produto: parseInt(inp.dataset.produto),
                quantidade: parseFloat(inp.value) || 0
            }))
        };
        try {
            const resp = await fetch(`${API_BASE}/atividades`, {
                method: 'POST',
                headers: {'Content-Type':'application/json', 'Authorization': `Bearer ${token}`},
                body: JSON.stringify(atividade)
            });
            if (resp.ok) {
                alert('Atividade salva com sucesso!');
                // Limpar formulário para nova atividade ao invés de voltar ao dashboard
                document.getElementById('formNovaAtividade').reset();
                document.getElementById('produtosQuantidades').innerHTML = '';
                // Scroll para o topo
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                const err = await resp.json();
                alert('Erro: ' + (err.detail || 'Falha ao salvar'));
            }
        } catch (err) {
            alert('Erro: ' + err.message);
        }
    });
}

function showAtividadesCadastradas(){
    const main = document.querySelector('.main-content');
    main.innerHTML = `
        <header class="topbar"><h1>Atividades Cadastradas</h1></header>
        <section class="visual-card">
            <div style="margin-bottom:16px;">
                <input type="search" id="buscaAtividades" placeholder="Buscar..." style="padding:8px;width:300px;">
                <button onclick="showDashboard()" style="margin-left:10px;padding:8px 16px;">Voltar ao Dashboard</button>
            </div>
            <table id="tabelaAtividadesLista" style="width:100%;border-collapse:collapse;">
                <thead>
                    <tr style="background:var(--taura-sidebar);">
                        <th style="padding:8px;border:1px solid var(--taura-border);">ID</th>
                        <th style="padding:8px;border:1px solid var(--taura-border);">Data</th>
                        <th style="padding:8px;border:1px solid var(--taura-border);">Equipe(s)</th>
                        <th style="padding:8px;border:1px solid var(--taura-border);">Categoria(s)</th>
                        <th style="padding:8px;border:1px solid var(--taura-border);">Produtos</th>
                        <th style="padding:8px;border:1px solid var(--taura-border);">Descrição</th>
                        <th style="padding:8px;border:1px solid var(--taura-border);">CAI</th>
                    </tr>
                </thead>
                <tbody id="tbodyAtividades"></tbody>
            </table>
        </section>
    `;
    loadAtividadesLista();
    
    document.getElementById('buscaAtividades').addEventListener('input', (e) => {
        const termo = e.target.value.toLowerCase();
        loadAtividadesLista(termo);
    });
}

async function loadAtividadesLista(filtro = ''){
    try {
        const now = new Date();
        const start = new Date(now.getFullYear(),0,1).toISOString().slice(0,10);
        const end = new Date(now.getFullYear(),11,31).toISOString().slice(0,10);
        const atividades = await fetchData(`/atividades?data_inicio=${start}&data_fim=${end}`);
        const tbody = document.getElementById('tbodyAtividades');
        if (!tbody) return;
        tbody.innerHTML = '';
        atividades.filter(a => {
            if (!filtro) return true;
            const hay = [a.descricao||'', a.id_atividade, a.data, 
                (a.equipes||[]).map(id=>equipeMap[id]||id).join(' '),
                (a.categorias||[]).map(id=>categoriaMap[id]||id).join(' '),
                (a.produtos||[]).map(p=>produtoMap[p.id_produto]||p.id_produto).join(' ')
            ].join(' ').toLowerCase();
            return hay.includes(filtro);
        }).forEach(a => {
            const equipes = (a.equipes||[]).map(id => equipeMap[id] || id).join(', ');
            const categorias = (a.categorias||[]).map(id => categoriaMap[id] || id).join(', ');
            const produtos = (a.produtos||[]).map(p => `${produtoMap[p.id_produto] || p.id_produto} (${p.quantidade})`).join(', ');
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="padding:8px;border:1px solid var(--taura-border);">${a.id_atividade}</td>
                <td style="padding:8px;border:1px solid var(--taura-border);">${a.data}</td>
                <td style="padding:8px;border:1px solid var(--taura-border);">${equipes}</td>
                <td style="padding:8px;border:1px solid var(--taura-border);">${categorias}</td>
                <td style="padding:8px;border:1px solid var(--taura-border);">${produtos}</td>
                <td style="padding:8px;border:1px solid var(--taura-border);">${a.descricao || ''}</td>
                <td style="padding:8px;border:1px solid var(--taura-border);">${a.cai ? 'Sim' : 'Não'}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        console.error('Erro ao carregar lista de atividades:', err);
    }
}

function showConfiguracao(){
    const main = document.querySelector('.main-content');
    main.innerHTML = `
        <header class="topbar"><h1>Configuração</h1></header>
        <section class="visual-card">
            <h3>Gerenciamento de Dados</h3>
            <p>Esta seção permite cadastrar novas equipes, categorias e produtos.</p>
            <div style="display:flex;gap:20px;margin-top:20px;">
                <button onclick="showCadastroEquipe()" style="padding:12px 24px;background:var(--pbi-accent-blue);color:#fff;border:none;border-radius:4px;cursor:pointer;">Cadastrar Equipe</button>
                <button onclick="showCadastroCategoria()" style="padding:12px 24px;background:var(--pbi-accent-blue);color:#fff;border:none;border-radius:4px;cursor:pointer;">Cadastrar Categoria</button>
                <button onclick="showCadastroProduto()" style="padding:12px 24px;background:var(--pbi-accent-blue);color:#fff;border:none;border-radius:4px;cursor:pointer;">Cadastrar Produto</button>
            </div>
            <div style="margin-top:20px;">
                <button onclick="showDashboard()" style="padding:10px 20px;">Voltar ao Dashboard</button>
            </div>
        </section>
    `;
}

function showCadastroEquipe(){
    alert('Funcionalidade de cadastro de equipe em desenvolvimento.');
}
function showCadastroCategoria(){
    alert('Funcionalidade de cadastro de categoria em desenvolvimento.');
}
function showCadastroProduto(){
    alert('Funcionalidade de cadastro de produto em desenvolvimento.');
}

function selectAll(selectId){
    const sel = document.getElementById(selectId);
    for (let i=0;i<sel.options.length;i++){ sel.options[i].selected = true; }
}

function deselectAll(selectId){
    const sel = document.getElementById(selectId);
    for (let i=0;i<sel.options.length;i++){ sel.options[i].selected = false; }
}