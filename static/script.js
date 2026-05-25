const API_BASE = window.location.origin;
let token = localStorage.getItem('token');
let equipeMap = {};
let categoriaMap = {};
let produtoMap = {};
let produtosData = []; // Array completo com todos os dados dos produtos
let equipesData = [];  // Array completo com objetos Equipe (inclui id_equipe_pai)
let equipeInternalMap = {}; // id_equipe -> interno_prf boolean
let tipificacoesData = []; // Array completo de tipificações penais
let todasAtividades = []; // Todas as atividades sem filtro (para gráficos anuais)

// Instâncias globais dos TreeMultiSelect do dashboard
let tmsDashEquipe = null;
let tmsDashCategoria = null;
let tmsDashProduto = null;

// Ordenação personalizada das equipes
const prioridadesEquipes = ['BDI Serra', 'GPT Serra', 'UOP Serra', 'COE / NOE', 'Polícia Civil'];
const normalizarNomeEquipe = (nome) => (nome || '')
    .toString()
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase();
const prioridadesEquipesNormalizadas = prioridadesEquipes.map(normalizarNomeEquipe);

function ordenarEquipesComPrioridade(equipes) {
    const prioritarias = [];
    const outras = [];
    equipes.forEach((equipe) => {
        const idx = prioridadesEquipesNormalizadas.indexOf(normalizarNomeEquipe(equipe.equipe));
        if (idx !== -1) {
            prioritarias[idx] = equipe;
        } else {
            outras.push(equipe);
        }
    });
    outras.sort((a, b) => a.equipe.localeCompare(b.equipe, 'pt-BR', { sensitivity: 'base' }));
    return [...prioritarias.filter(Boolean), ...outras];
}

/**
 * Retorna o rótulo completo de uma equipe com a cadeia hierárquica.
 * Ex: getEquipeChainLabel(3) → "PRF - BDI SERRA"
 */
function getEquipeChainLabel(id) {
    const chain = [];
    let currentId = Number(id);
    const visited = new Set();
    while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        const eq = equipesData.find(e => e.id_equipe === currentId);
        if (!eq) break;
        chain.unshift(eq.equipe);
        currentId = eq.id_equipe_pai || null;
    }
    return chain.join(' - ');
}

// Função para garantir que o token está atualizado
function refreshToken() {
    token = localStorage.getItem('token');
    return token;
}

// Função para aguardar o token estar disponível (com timeout)
async function waitForToken(maxWaitMs = 2000) {
    const startTime = Date.now();
    while (!refreshToken() && (Date.now() - startTime) < maxWaitMs) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    return token;
}

function checkAuth() {
    refreshToken();
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

function showLoader() {
    const loader = document.getElementById('loader');
    const btnApply = document.getElementById('btnApply');
    const btnExport = document.getElementById('btnExport');
    if (loader) loader.style.display = 'inline-flex';
    if (btnApply) btnApply.disabled = true;
    if (btnExport) btnExport.disabled = true;
}

function hideLoader() {
    const loader = document.getElementById('loader');
    const btnApply = document.getElementById('btnApply');
    const btnExport = document.getElementById('btnExport');
    // Esconder overlay inicial se existir
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
    if (loader) loader.style.display = 'none';
    if (btnApply) btnApply.disabled = false;
    if (btnExport) btnExport.disabled = false;
}

async function fetchData(endpoint, retryCount = 0) {
    showLoader();
    try {
        // Atualiza o token do localStorage antes de cada requisição
        refreshToken();
        
        // Verifica se há token
        if (!token) {
            // Se não tem token e ainda não tentou esperar, aguarda um pouco
            if (retryCount === 0) {
                console.log('Token não encontrado, aguardando...');
                await waitForToken();
            }
            if (!token) {
                console.error('Token não encontrado após espera. Redirecionando para login...');
                window.location.href = '/static/autologin.html';
                throw new Error('Token não encontrado');
            }
        }
        
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status === 401) {
            // Token inválido ou expirado
            console.error('❌ Token inválido ou expirado (401). Redirecionando para login...');
            alert('Sua sessão expirou. Por favor, faça login novamente.');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('user_name');
            window.location.replace('/static/login-google.html');
            throw new Error('Token expirado');
        }
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Erro na requisição ${endpoint}: ${response.status} - ${errorText}`);
            throw new Error(`Erro ${response.status}: ${errorText}`);
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
        equipeInternalMap = {};
        equipesData = equipes;
        equipes.forEach(equipe => {
            equipeMap[equipe.id_equipe] = equipe.equipe;
            equipeInternalMap[equipe.id_equipe] = !!equipe.interno_prf;
        });

        // Montar TreeMultiSelect no dashboard (se o container existir)
        const containerEquipe = document.getElementById('tmsEquipe');
        if (containerEquipe) {
            const tmsItems = equipes.map(e => ({
                id: e.id_equipe,
                label: e.equipe,
                parentId: e.id_equipe_pai || null
            }));
            tmsDashEquipe = new TreeMultiSelect(containerEquipe, {
                label: 'Equipes',
                items: tmsItems,
                selected: equipes.map(e => e.id_equipe),
                placeholder: 'Buscar equipe...'
            });
        }

        // Fallback: select antigo (caso exista em outra tela)
        const select = document.getElementById('equipeSelect');
        if (select) {
            select.innerHTML = '';
            const equipesOrdenadas = ordenarEquipesComPrioridade(equipes);
            equipesOrdenadas.forEach(equipe => {
                const option = document.createElement('option');
                option.value = equipe.id_equipe;
                option.text = equipe.equipe;
                option.selected = true;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar equipes:', error);
    }
}

async function loadCategorias() {
    try {
        const categorias = await fetchData('/categorias');
        categoriaMap = {};
        categorias.forEach(categoria => {
            categoriaMap[categoria.id_categoria_atividade] = categoria.categoria_atividade;
        });

        // Montar TreeMultiSelect no dashboard
        const containerCategoria = document.getElementById('tmsCategoria');
        if (containerCategoria) {
            const tmsItems = [...categorias]
                .sort((a, b) => a.categoria_atividade.localeCompare(b.categoria_atividade, 'pt-BR', { sensitivity: 'base' }))
                .map(c => ({ id: c.id_categoria_atividade, label: c.categoria_atividade, parentId: null }));
            tmsDashCategoria = new TreeMultiSelect(containerCategoria, {
                label: 'Categorias',
                items: tmsItems,
                selected: categorias.map(c => c.id_categoria_atividade),
                placeholder: 'Buscar categoria...'
            });
        }

        // Fallback: select antigo
        const select = document.getElementById('categoriaSelect');
        if (select) {
            select.innerHTML = '';
            const categoriasOrdenadas = [...categorias].sort((a, b) =>
                a.categoria_atividade.localeCompare(b.categoria_atividade, 'pt-BR', { sensitivity: 'base' })
            );
            categoriasOrdenadas.forEach(categoria => {
                const option = document.createElement('option');
                option.value = categoria.id_categoria_atividade;
                option.text = categoria.categoria_atividade;
                option.selected = true;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
    }
}

async function loadProdutos() {
    try {
        const produtos = await fetchData('/produtos');
        produtoMap = {};
        produtosData = produtos;
        produtos.forEach(produto => {
            produtoMap[produto.id_produto_atividade] = produto.produto_atividade;
        });

        // Montar TreeMultiSelect no dashboard
        const containerProduto = document.getElementById('tmsProduto');
        if (containerProduto) {
            const tmsItems = [...produtos]
                .sort((a, b) => a.produto_atividade.localeCompare(b.produto_atividade, 'pt-BR', { sensitivity: 'base' }))
                .map(p => ({ id: p.id_produto_atividade, label: p.produto_atividade, parentId: null }));
            tmsDashProduto = new TreeMultiSelect(containerProduto, {
                label: 'Produtos',
                items: tmsItems,
                selected: produtos.map(p => p.id_produto_atividade),
                placeholder: 'Buscar produto...'
            });
        }

        // Fallback: select antigo
        const select = document.getElementById('produtoSelect');
        if (select) {
            select.innerHTML = '';
            const produtosOrdenados = [...produtos].sort((a, b) =>
                a.produto_atividade.localeCompare(b.produto_atividade, 'pt-BR', { sensitivity: 'base' })
            );
            produtosOrdenados.forEach(produto => {
                const option = document.createElement('option');
                option.value = produto.id_produto_atividade;
                option.text = produto.produto_atividade;
                option.selected = true;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
    }
}

async function loadTipificacoes() {
    try {
        const data = await fetchData('/tipificacoes');
        tipificacoesData = data;
    } catch (error) {
        console.error('Erro ao carregar tipificações:', error);
    }
}

// ========================================
// SISTEMA DE CACHE DE ATIVIDADES
// ========================================

// Configuração do cache
const CACHE_CONFIG = {
    KEY: 'atividadesCache',
    TIMESTAMP_KEY: 'atividadesCacheTimestamp',
    EXPIRATION_MS: 30 * 24 * 60 * 60 * 1000, // 30 dias
    VERSION: '1.0'
};

// Verifica se o cache é válido
function isCacheValid() {
    try {
        const timestamp = localStorage.getItem(CACHE_CONFIG.TIMESTAMP_KEY);
        const cacheData = localStorage.getItem(CACHE_CONFIG.KEY);
        
        console.log('🔍 DEBUG isCacheValid - timestamp:', timestamp);
        console.log('🔍 DEBUG isCacheValid - tem dados:', cacheData ? 'Sim' : 'Não');
        
        if (!timestamp) {
            console.log('🔍 DEBUG isCacheValid - Sem timestamp');
            return false;
        }
        
        const cacheAge = Date.now() - parseInt(timestamp);
        const isValid = cacheAge < CACHE_CONFIG.EXPIRATION_MS;
        
        console.log('🔍 DEBUG isCacheValid - Idade do cache (ms):', cacheAge);
        console.log('🔍 DEBUG isCacheValid - Limite (ms):', CACHE_CONFIG.EXPIRATION_MS);
        console.log('🔍 DEBUG isCacheValid - É válido?', isValid);
        
        return isValid;
    } catch (e) {
        console.error('Erro ao verificar cache:', e);
        return false;
    }
}

// Salva atividades no cache
function saveToCache(atividades) {
    try {
        localStorage.setItem(CACHE_CONFIG.KEY, JSON.stringify(atividades));
        localStorage.setItem(CACHE_CONFIG.TIMESTAMP_KEY, Date.now().toString());
        console.log(`✅ Cache atualizado com ${atividades.length} atividades`);
    } catch (e) {
        console.error('Erro ao salvar cache:', e);
        // Se der erro (quota excedida), limpa cache antigo
        if (e.name === 'QuotaExceededError') {
            clearCache();
        }
    }
}

// Recupera atividades do cache
function getFromCache() {
    try {
        const cached = localStorage.getItem(CACHE_CONFIG.KEY);
        if (!cached) return null;
        
        const atividades = JSON.parse(cached);
        console.log(`✅ Cache recuperado com ${atividades.length} atividades`);
        return atividades;
    } catch (e) {
        console.error('Erro ao recuperar cache:', e);
        clearCache();
        return null;
    }
}

// Limpa o cache
function clearCache() {
    try {
        localStorage.removeItem(CACHE_CONFIG.KEY);
        localStorage.removeItem(CACHE_CONFIG.TIMESTAMP_KEY);
        console.log('🗑️ Cache limpo');
    } catch (e) {
        console.error('Erro ao limpar cache:', e);
    }
}

// Atualiza uma atividade específica no cache
function updateCacheItem(atividade) {
    try {
        const cached = getFromCache();
        if (!cached) return false;
        
        const index = cached.findIndex(a => a.id_atividade === atividade.id_atividade);
        if (index !== -1) {
            cached[index] = atividade;
            console.log(`✏️ Atividade ${atividade.id_atividade} atualizada no cache`);
        } else {
            cached.push(atividade);
            console.log(`➕ Atividade ${atividade.id_atividade} adicionada ao cache`);
        }
        
        saveToCache(cached);
        return true;
    } catch (e) {
        console.error('Erro ao atualizar item no cache:', e);
        return false;
    }
}

// Remove uma atividade do cache
function removeCacheItem(idAtividade) {
    try {
        const cached = getFromCache();
        if (!cached) return false;
        
        const filtered = cached.filter(a => a.id_atividade !== idAtividade);
        if (filtered.length < cached.length) {
            saveToCache(filtered);
            console.log(`🗑️ Atividade ${idAtividade} removida do cache`);
            return true;
        }
        
        return false;
    } catch (e) {
        console.error('Erro ao remover item do cache:', e);
        return false;
    }
}

// ========================================
// SISTEMA DE AUTO-ATUALIZAÇÃO (REAL-TIME POLLING)
// ========================================

let autoUpdateInterval = null;
let lastCheckTimestamp = null;

// Configuração do auto-update
const AUTO_UPDATE_CONFIG = {
    ENABLED: false, // DESABILITADO - atualização manual apenas
    INTERVAL_MS: 30 * 1000, // Verificar a cada 30 segundos
    MIN_INTERVAL_MS: 10 * 1000, // Mínimo 10 segundos
};

// Inicia o sistema de auto-atualização
function startAutoUpdate() {
    if (!AUTO_UPDATE_CONFIG.ENABLED) {
        console.log('⏸️ Auto-atualização desabilitada');
        return;
    }
    
    // Limpar intervalo anterior se existir
    if (autoUpdateInterval) {
        clearInterval(autoUpdateInterval);
    }
    
    console.log(`🔄 Auto-atualização iniciada (verificando a cada ${AUTO_UPDATE_CONFIG.INTERVAL_MS/1000}s)`);
    
    // Verificar imediatamente
    checkForUpdates();
    
    // Configurar intervalo
    autoUpdateInterval = setInterval(checkForUpdates, AUTO_UPDATE_CONFIG.INTERVAL_MS);
}

// Para o sistema de auto-atualização
function stopAutoUpdate() {
    if (autoUpdateInterval) {
        clearInterval(autoUpdateInterval);
        autoUpdateInterval = null;
        console.log('⏹️ Auto-atualização parada');
    }
}

// Verifica se há atualizações no servidor
async function checkForUpdates() {
    try {
        // Não verificar se estiver em outra tela (não dashboard)
        const isDashboard = document.getElementById('dataInicio') !== null;
        if (!isDashboard) {
            console.log('⏭️ Não está no dashboard, pulando verificação');
            return;
        }
        
        // Buscar timestamp da última verificação
        const since = lastCheckTimestamp || localStorage.getItem('lastAtividadesUpdate');
        
        // Chamar endpoint de verificação (custo zero de reads)
        const params = since ? `?since=${encodeURIComponent(since)}` : '';
        const response = await fetchData(`/atividades/check-updates${params}`);
        
        if (response.has_updates) {
            console.log('🔔 Atualizações detectadas! Recarregando dados...');
            
            // Limpar cache e recarregar
            clearCache();
            
            // Reaplicar filtros atuais
            const ultimosFiltros = localStorage.getItem('ultimosFiltrosDashboard');
            const filtros = ultimosFiltros ? JSON.parse(ultimosFiltros) : {};
            
            // Recarregar sem forçar (vai usar a nova busca)
            await loadAtividades(filtros, true);
            
            // Atualizar timestamp
            lastCheckTimestamp = response.last_modified;
            localStorage.setItem('lastAtividadesUpdate', response.last_modified);
            
            console.log('✅ Dashboard atualizado automaticamente');
        } else {
            console.log('✓ Nenhuma atualização detectada');
        }
    } catch (error) {
        console.error('Erro ao verificar atualizações:', error);
        // Não fazer nada em caso de erro, continuar normalmente
    }
}

// Remove uma atividade do cache (função já existente, mantida aqui)

async function loadAtividades(filtros = {}, forceReload = false) {
    try {
        // Verificar se os filtros são significativos ou apenas o padrão do ano corrente
        const now = new Date();
        const anoAtual = now.getFullYear();
        console.log('🔍 DEBUG Cache - Filtros recebidos:', filtros);
        
        // Verificar se todas as opções estão selecionadas (= sem filtro específico)
        const totalEquipes = Object.keys(equipeMap).length;
        const totalCategorias = Object.keys(categoriaMap).length;
        const totalProdutos = Object.keys(produtoMap).length;
        
        const allEquipesSelected = !filtros.equipe || filtros.equipe.length === 0 || filtros.equipe.length === totalEquipes;
        const allCategoriasSelected = !filtros.categoria || filtros.categoria.length === 0 || filtros.categoria.length === totalCategorias;
        const allProdutosSelected = !filtros.produto || filtros.produto.length === 0 || filtros.produto.length === totalProdutos;
        
        // Considerar "sem filtros" APENAS se:
        // - Não tem datas (campos vazios)
        // - Todas equipes/categorias/produtos selecionadas
        // - Sem busca textual
        const hasFilters = (filtros.dataInicio || filtros.dataFim) ||
                          !allEquipesSelected ||
                          !allCategoriasSelected ||
                          !allProdutosSelected ||
                          filtros.consultaTexto;
        
        console.log('🔍 DEBUG Cache - Datas:', {dataInicio: filtros.dataInicio, dataFim: filtros.dataFim});
        console.log('🔍 DEBUG Cache - Totais:', {totalEquipes, totalCategorias, totalProdutos});
        console.log('🔍 DEBUG Cache - Todos selecionados:', {allEquipesSelected, allCategoriasSelected, allProdutosSelected});
        console.log('🔍 DEBUG Cache - hasFilters:', hasFilters);
        console.log('🔍 DEBUG Cache - isCacheValid:', isCacheValid());
        console.log('🔍 DEBUG Cache - forceReload:', forceReload);
        
        let atividadesRaw;
        
        // Se não tem filtros significativos e cache é válido, usar cache
        if (!hasFilters && !forceReload && isCacheValid()) {
            atividadesRaw = getFromCache();
            if (atividadesRaw) {
                console.log('📦 Usando dados do cache (evitando requisição ao Firestore)');
                todasAtividades = atividadesRaw;
                const atividades = filterActivities(atividadesRaw, filtros);
                
                renderCharts(atividades);
                renderAcoesIntegradas(atividades);
                updateIndicators(atividades);
                renderQuadroQTCs();
                renderQuadroResultados();
                renderQuadroDrogas();
                renderQuadroMaterialBelico();
                return;
            }
        }
        
        // Caso contrário, buscar do servidor
        console.log('🌐 Buscando dados do Firestore...');
        let url = '/atividades';
        const params = new URLSearchParams();
        
        // Enviar datas ao servidor se existirem
        if (filtros.dataInicio) params.append('data_inicio', filtros.dataInicio);
        if (filtros.dataFim) params.append('data_fim', filtros.dataFim);
        
        // Só enviar filtros de equipes/categorias/produtos se NÃO forem todas selecionadas
        if (!allEquipesSelected) {
            (filtros.equipe || []).forEach(v => params.append('id_equipe', v));
        }
        if (!allCategoriasSelected) {
            (filtros.categoria || []).forEach(v => params.append('id_categoria', v));
        }
        if (!allProdutosSelected) {
            (filtros.produto || []).forEach(v => params.append('id_produto', v));
        }
        if (filtros.consultaTexto) params.append('consulta', filtros.consultaTexto);
        if (params.toString()) url += '?' + params.toString();

        atividadesRaw = await fetchData(url);
        
        // Se não tem filtros significativos, salvar no cache
        if (!hasFilters) {
            saveToCache(atividadesRaw);
        }
        
        // ainda mantemos filtros client-side como segunda camada de segurança
        const atividades = filterActivities(atividadesRaw, filtros);
        
        // IMPORTANTE: Carregar TODAS as atividades SEM FILTRO para gráficos anuais
        // Se há filtros aplicados, fazer requisição separada para buscar TUDO
        if (params.toString()) {
            // Há filtros: buscar TODAS as atividades em requisição separada
            console.log('🌐 Buscando TODAS atividades para gráficos anuais (sem filtro)...');
            todasAtividades = await fetchData('/atividades');
        } else {
            // Sem filtros: os dados já são todos
            todasAtividades = atividadesRaw;
        }
        
        renderCharts(atividades);
        renderAcoesIntegradas(atividades);
        updateIndicators(atividades);
        renderQuadroQTCs();
        renderQuadroResultados();
        renderQuadroDrogas();
        renderQuadroMaterialBelico();
    } catch (error) {
        console.error('Erro ao carregar atividades:', error);
        hideLoader();
    }
}

function filterActivities(atividades, filtros){
    const dataQ = (s) => s === null || s === undefined ? '' : String(s).toLowerCase();
    const selectedEquipes = (filtros.equipe || []).map(v => Number(v)).filter(v => !isNaN(v) && v !== 0);
    const selectedCategorias = (filtros.categoria || []).map(v => Number(v)).filter(v => !isNaN(v) && v !== 0);
    const selectedProdutos = (filtros.produto || []).map(v => Number(v)).filter(v => !isNaN(v) && v !== 0);
    const consulta = (filtros.consultaTexto || '').trim().toLowerCase();

    // Mapa de produto -> categoria para filtrar por categoria via produtos
    const produtoCategoriaMap = {};
    produtosData.forEach(p => {
        produtoCategoriaMap[p.id_produto_atividade] = p.id_categoria_atividade;
    });

    return atividades.filter(a => {
        // equipe filter (if any selected)
        if (selectedEquipes.length){
            const equipesIds = (a.equipes || []).map(x => Number(x));
            const any = selectedEquipes.some(s => equipesIds.includes(s));
            if (!any) return false;
        }
        // categoria filter - verifica categorias dos produtos da atividade
        if (selectedCategorias.length){
            // Obtem as categorias dos produtos desta atividade
            const categoriasIds = new Set();
            (a.produtos || []).forEach(p => {
                const catDoProduto = produtoCategoriaMap[p.id_produto];
                if (catDoProduto) categoriasIds.add(catDoProduto);
            });
            // Também considera o campo categorias da atividade (caso exista)
            (a.categorias || []).forEach(c => categoriasIds.add(Number(c)));
            
            const any = selectedCategorias.some(s => categoriasIds.has(s));
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
            // categorias names (via produtos)
            if (a.produtos) {
                const cats = a.produtos.map(p => {
                    const catId = produtoCategoriaMap[p.id_produto];
                    return dataQ(categoriaMap[catId] || catId || '');
                });
                fields.push(cats.join(' '));
            }
            // produtos names
            if (a.produtos) fields.push(a.produtos.map(p => dataQ(produtoMap[p.id_produto] || p.id_produto)).join(' '));
            const hay = fields.join(' ');
            if (!hay.includes(consulta)) return false;
        }
        return true;
    });
}

function updateIndicators(atividades){
    // Mapear id_produto -> categoria_id
    const produtoCategoriaMap = {};
    produtosData.forEach(p => {
        produtoCategoriaMap[p.id_produto_atividade] = p.id_categoria_atividade;
    });
    
    // Filtrar atividades: QTC são atividades que têm produtos com categorias diferentes de 3 e 8
    const atividadesQTC = atividades.filter(a => {
        const produtos = a.produtos || [];
        // Verifica se a atividade tem pelo menos um produto de categoria diferente de 3 e 8
        const temResultadoOperacional = produtos.some(prod => {
            const catProduto = produtoCategoriaMap[prod.id_produto];
            return catProduto !== 3 && catProduto !== 8;
        });
        return temResultadoOperacional;
    });
    
    // Total de QTCs (atividades com resultados operacionais)
    const total = atividadesQTC.length;
    
    // Internos: todas as equipes da atividade têm interno_prf == true
    let internos = 0;
    let conjuntas = 0;
    atividadesQTC.forEach(a => {
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
    
    // Quadro de Resumo Geral - Somar produtos por categoria e IDs específicos
    // Mapear id_produto -> nome do produto
    const produtoNomeMap = {};
    produtosData.forEach(p => {
        produtoNomeMap[p.id_produto_atividade] = p.produto_atividade.toLowerCase();
    });
    
    let totalVeiculos = 0;      // Categoria 11
    let totalPessoas = 0;       // Categoria 7
    let totalArmas = 0;         // Produtos 2 e 3
    let totalMunicoes = 0;      // Produtos 4 e 5
    let totalDrogas = 0;        // Categoria 5
    let totalColetivas = 0;     // Produto 43 (Coletiva de Imprensa)
    let totalDemandas = 0;      // Categoria 3
    
    atividades.forEach(a => {
        (a.produtos || []).forEach(prod => {
            const idProduto = prod.id_produto;
            const categoriaId = produtoCategoriaMap[idProduto];
            const quantidade = prod.quantidade || 0;
            
            // Veículos Recuperados: Categoria 11
            if (categoriaId === 11) {
                totalVeiculos += quantidade;
            }
            
            // Pessoas Presas: Categoria 7
            if (categoriaId === 7) {
                totalPessoas += quantidade;
            }
            
            // Armas: Produtos 2 e 3
            if (idProduto === 2 || idProduto === 3) {
                totalArmas += quantidade;
            }
            
            // Munições: Produtos 4 e 5
            if (idProduto === 4 || idProduto === 5) {
                totalMunicoes += quantidade;
            }
            
            // Drogas: Categoria 5
            if (categoriaId === 5) {
                totalDrogas += quantidade;
            }
            
            // Coletivas de Imprensa: Produto 43
            if (idProduto === 43) {
                totalColetivas += quantidade;
            }
            
            // Demandas Inteligência: Categoria 3
            if (categoriaId === 3) {
                totalDemandas += quantidade;
            }
        });
    });
    
    // Atualizar KPIs do Quadro de Resumo
    const elVeiculos = document.getElementById('totalVeiculos');
    if (elVeiculos) elVeiculos.querySelector('.kpi-value').innerText = totalVeiculos;
    const elPessoas = document.getElementById('totalPessoas');
    if (elPessoas) elPessoas.querySelector('.kpi-value').innerText = totalPessoas;
    const elArmas = document.getElementById('totalArmas');
    if (elArmas) elArmas.querySelector('.kpi-value').innerText = totalArmas;
    const elMunicoes = document.getElementById('totalMunicoes');
    if (elMunicoes) elMunicoes.querySelector('.kpi-value').innerText = totalMunicoes;
    const elDrogas = document.getElementById('totalDrogas');
    if (elDrogas) elDrogas.querySelector('.kpi-value').innerText = totalDrogas.toFixed(2);
    const elColetivas = document.getElementById('totalColetivas');
    if (elColetivas) elColetivas.querySelector('.kpi-value').innerText = totalColetivas;
    const elDemandas = document.getElementById('totalDemandas');
    if (elDemandas) elDemandas.querySelector('.kpi-value').innerText = totalDemandas;
}

// Variáveis globais para instâncias dos gráficos
let chartEquipesInstance, chartPessoasInstance, chartVeiculosInstance, chartParticipacaoInstance, chartDemandasInstance, chartDocumentosInstance, chartTipificacoesInstance, chartTipPenaisInstance;

// ── Ações Integradas ────────────────────────────────────────────────────
/**
 * Determina se uma atividade é "integrada":
 * possui ao menos uma equipe interna PRF E ao menos uma externa.
 */
function isAcaoIntegrada(atividade) {
    const ids = (atividade.equipes || []).map(Number);
    const temInterna = ids.some(id => equipeInternalMap[id]);
    const temExterna = ids.some(id => !equipeInternalMap[id]);
    return temInterna && temExterna;
}

/**
 * Renderiza a tabela e o gráfico de Ações Integradas no dashboard.
 * Obedece ao filtro de pesquisa (recebe o array já filtrado).
 */
function renderAcoesIntegradas(atividadesFiltradas) {
    const integradas = atividadesFiltradas.filter(isAcaoIntegrada);

    // ── Cabeçalho com total ───────────────────────────────────────────────
    const totalEl = document.getElementById('totalAcoesIntegradas');
    if (totalEl) totalEl.textContent = `Total: ${integradas.length} ação(ões) integrada(s) no período`;

    // ── Tabela ────────────────────────────────────────────────────────────
    const tbody = document.getElementById('tabelaAcoesIntegradas');
    if (tbody) {
        if (integradas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding:12px;color:#999;text-align:center;">Nenhuma ação integrada no período</td></tr>';
        } else {
            // Ordena por data desc
            const sorted = [...integradas].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
            tbody.innerHTML = sorted.map(at => {
                const equipes = (at.equipes || []).map(id => equipeMap[id] || id).join(', ');
                // Expande produtos em linhas (rowspan na primeira)
                const prods = at.produtos || [];
                if (prods.length === 0) {
                    return `<tr>
                        <td style="padding:5px 8px;border-bottom:1px solid #eee;white-space:nowrap;">${at.data || ''}</td>
                        <td style="padding:5px 8px;border-bottom:1px solid #eee;">${equipes}</td>
                        <td style="padding:5px 8px;border-bottom:1px solid #eee;" colspan="3">—</td>
                    </tr>`;
                }
                return prods.map((prod, idx) => {
                    const nomeProd = produtoMap[prod.id_produto] || prod.id_produto;
                    const qtd = prod.quantidade != null ? prod.quantidade : '—';
                    const tips = (prod.tipificacoes || []).map(tid => {
                        const t = tipificacoesData.find(x => x.id_tipificacao == tid);
                        return t ? `Art.${t.artigo}${t.paragrafo && t.paragrafo !== '-' ? ' ' + t.paragrafo : ''} – ${t.descricao}` : tid;
                    }).join('; ') || '—';
                    if (idx === 0) {
                        return `<tr>
                            <td style="padding:5px 8px;border-bottom:1px solid #eee;white-space:nowrap;" rowspan="${prods.length}">${at.data || ''}</td>
                            <td style="padding:5px 8px;border-bottom:1px solid #eee;" rowspan="${prods.length}">${equipes}</td>
                            <td style="padding:5px 8px;border-bottom:1px solid #eee;">${nomeProd}</td>
                            <td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:right;">${qtd}</td>
                            <td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:0.78rem;">${tips}</td>
                        </tr>`;
                    }
                    return `<tr>
                        <td style="padding:5px 8px;border-bottom:1px solid #eee;">${nomeProd}</td>
                        <td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:right;">${qtd}</td>
                        <td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:0.78rem;">${tips}</td>
                    </tr>`;
                }).join('');
            }).join('');
        }
    }

    // ── Gráfico de tipificações por equipe ───────────────────────────────────
    const equipeCount = {};
    integradas.forEach(at => {
        (at.equipes || []).forEach(id => {
            const label = getEquipeChainLabel(id) || equipeMap[id] || id;
            equipeCount[label] = (equipeCount[label] || 0) + 1;
        });
    });

    const entries = Object.entries(equipeCount).sort((a, b) => b[1] - a[1]);
    const ctx = document.getElementById('chartTipificacoes');
    if (ctx) {
        if (chartTipificacoesInstance) chartTipificacoesInstance.destroy();
        if (entries.length === 0) {
            ctx.parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:300px;color:#999;font-size:0.9rem;">Sem dados no período</div>';
        } else {
            chartTipificacoesInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: entries.map(e => e[0]),
                    datasets: [{ label: 'Ocorrências', data: entries.map(e => e[1]),
                        backgroundColor: '#005a9e', borderRadius: 4 }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false },
                        tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 10 }
                    },
                    scales: {
                        y: { beginAtZero: true, ticks: { font: { size: 11 } }, title: { display: true, text: 'Qtd. Ocorrências', font: { size: 11 } } },
                        x: { ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 45 }, title: { display: true, text: 'Equipes', font: { size: 11 } } }
                    }
                }
            });
        }
    }

    // ── Gráfico de Tipos Penais (por atividade integrada) ────────────────────
    const tipPenalCount = {};
    integradas.forEach(at => {
        const tipsNaAtividade = new Set();
        (at.produtos || []).forEach(prod => {
            (prod.tipificacoes || []).forEach(tid => {
                tipsNaAtividade.add(tid);
            });
        });
        tipsNaAtividade.forEach(tid => {
            const t = tipificacoesData.find(x => x.id_tipificacao == tid);
            let label;
            if (t) {
                const leiPart = t.lei && t.lei.trim() ? `${t.lei.trim()} - ` : '';
                label = `${leiPart}Art.${t.artigo}`;
                if (t.paragrafo && t.paragrafo !== '-') label += ` §${t.paragrafo}`;
                if (t.inciso && t.inciso !== '-') label += ` inc.${t.inciso}`;
            } else {
                label = String(tid);
            }
            tipPenalCount[label] = (tipPenalCount[label] || 0) + 1;
        });
    });
    const totalTipFiltradas = integradas.length;
    const elTotalTip = document.getElementById('totalTipPenais');
    if (elTotalTip) elTotalTip.textContent = `Total de atividades integradas filtradas: ${totalTipFiltradas}`;
    const tipEntries = Object.entries(tipPenalCount).sort((a, b) => b[1] - a[1]);
    const ctxTip = document.getElementById('chartTipPenais');
    if (ctxTip) {
        if (chartTipPenaisInstance) chartTipPenaisInstance.destroy();
        if (tipEntries.length === 0) {
            ctxTip.parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:260px;color:#999;font-size:0.9rem;">Sem tipificações penais no período</div>';
        } else {
            const pctData = tipEntries.map(e =>
                totalTipFiltradas > 0 ? parseFloat((e[1] / totalTipFiltradas * 100).toFixed(1)) : 0
            );
            const pctLabels = pctData.map(v => v.toFixed(1) + '%');
            const percentPlugin = {
                id: 'percentAboveBars',
                afterDatasetsDraw(chart) {
                    const { ctx: c } = chart;
                    chart.getDatasetMeta(0).data.forEach((bar, i) => {
                        const lbl = pctLabels[i];
                        c.save();
                        c.font = 'bold 10px sans-serif';
                        c.fillStyle = '#333';
                        c.textAlign = 'center';
                        c.fillText(lbl, bar.x, bar.y - 4);
                        c.restore();
                    });
                }
            };
            chartTipPenaisInstance = new Chart(ctxTip, {
                type: 'bar',
                plugins: [percentPlugin],
                data: {
                    labels: tipEntries.map(e => e[0]),
                    datasets: [{
                        label: '% Atividades',
                        data: pctData,
                        backgroundColor: '#1b5e20',
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    layout: { padding: { top: 20 } },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(0,0,0,0.8)', padding: 10,
                            callbacks: {
                                label: (ctx) => {
                                    const idx = ctx.dataIndex;
                                    return `${pctLabels[idx]} (${tipEntries[idx][1]} atividade(s))`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                font: { size: 11 },
                                callback: v => v + '%'
                            },
                            title: { display: true, text: '% de Atividades', font: { size: 11 } }
                        },
                        x: {
                            ticks: { font: { size: 9 }, maxRotation: 45, minRotation: 45 },
                            title: { display: true, text: 'Tipificação Penal', font: { size: 11 } }
                        }
                    }
                }
            });
        }
    }
}

function renderCharts(atividades) {
    // Ocultar loader
    hideLoader();
    
    // 1. Gráfico de Atividades por Equipe (Colunas) - RESPEITA FILTRO
    const equipeCounts = {};
    atividades.forEach(a => {
        a.equipes.forEach(id => {
            const equipe = getEquipeChainLabel(id) || equipeMap[id] || id;
            equipeCounts[equipe] = (equipeCounts[equipe] || 0) + 1;
        });
    });
    const labelsEquipes = Object.keys(equipeCounts);
    const dataEquipes = Object.values(equipeCounts);

    const ctx1 = document.getElementById('chartEquipes');
    if (ctx1) {
        if (chartEquipesInstance) chartEquipesInstance.destroy();
        chartEquipesInstance = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: labelsEquipes,
                datasets: [{
                    label: 'Atividades',
                    data: dataEquipes,
                    backgroundColor: '#005a9e',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        padding: 12,
                        titleFont: { size: 14 },
                        bodyFont: { size: 13 }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: { font: { size: 11 } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 11 }, maxRotation: 45, minRotation: 45 }
                    }
                }
            }
        });
    }
    
    // 2. Evolução Anual - Veículos Recuperados (Categoria 11) - IGNORA FILTRO (usa todasAtividades)
    const veiculosPorAno = calcularProdutosPorAno(todasAtividades, 11);
    const ctx2 = document.getElementById('chartVeiculosAnual');
    if (ctx2) {
        if (chartVeiculosInstance) chartVeiculosInstance.destroy();
        chartVeiculosInstance = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: Object.keys(veiculosPorAno),
                datasets: [{
                    label: 'Veículos Recuperados',
                    data: Object.values(veiculosPorAno),
                    backgroundColor: '#005a9e',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        padding: 12,
                        callbacks: {
                            label: (context) => `Veículos: ${context.parsed.y}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: { font: { size: 11 } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 11 } }
                    }
                }
            }
        });
    }
    
    // 3. Evolução Anual - Pessoas Presas (Categoria 7) - IGNORA FILTRO (usa todasAtividades)
    const pessoasPorAno = calcularProdutosPorAno(todasAtividades, 7);
    const ctx3 = document.getElementById('chartPessoasAnual');
    if (ctx3) {
        if (chartPessoasInstance) chartPessoasInstance.destroy();
        chartPessoasInstance = new Chart(ctx3, {
            type: 'bar',
            data: {
                labels: Object.keys(pessoasPorAno),
                datasets: [{
                    label: 'Pessoas Presas',
                    data: Object.values(pessoasPorAno),
                    backgroundColor: '#1b1464',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        padding: 12,
                        callbacks: {
                            label: (context) => `Pessoas: ${context.parsed.y}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: { font: { size: 11 } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 11 } }
                    }
                }
            }
        });
    }
    
    // 4. Produtos Apreendidos no Período (soma de quantidades) - RESPEITA FILTRO
    // Mapear categoria -> nome
    const produtoCategoriaMap = {};
    produtosData.forEach(p => {
        produtoCategoriaMap[p.id_produto_atividade] = p.id_categoria_atividade;
    });
    
    const quantidadePorProduto = {};
    atividades.forEach(a => {
        (a.produtos || []).forEach(prod => {
            const idProduto = prod.id_produto;
            const nomeProduto = produtoMap[idProduto] || `Produto ${idProduto}`;
            const quantidade = prod.quantidade || 0;
            quantidadePorProduto[nomeProduto] = (quantidadePorProduto[nomeProduto] || 0) + quantidade;
        });
    });
    
    // Ordenar por quantidade decrescente e pegar top 10
    const produtosOrdenados = Object.entries(quantidadePorProduto)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    const labelsProdutos = produtosOrdenados.map(p => p[0]);
    const dataProdutos = produtosOrdenados.map(p => p[1]);
    
    const ctx4 = document.getElementById('chartParticipacao');
    if (ctx4) {
        if (chartParticipacaoInstance) chartParticipacaoInstance.destroy();
        chartParticipacaoInstance = new Chart(ctx4, {
            type: 'bar',
            data: {
                labels: labelsProdutos,
                datasets: [{
                    label: 'Quantidade',
                    data: dataProdutos,
                    backgroundColor: '#005a9e',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y', // Barras horizontais
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        padding: 12,
                        callbacks: {
                            label: (context) => `${context.label}: ${context.parsed.x}`
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: { font: { size: 11 } }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { font: { size: 11 } }
                    }
                }
            }
        });
    }
    
    // 5. Gráfico de Demandas de Inteligência (Categoria 3) - Barras Horizontais - RESPEITA FILTRO
    const quantidadePorDemanda = {};
    atividades.forEach(a => {
        (a.produtos || []).forEach(prod => {
            const idProduto = prod.id_produto;
            const categoriaId = produtoCategoriaMap[idProduto];
            if (categoriaId === 3) { // Categoria 3 - Demandas Inteligência
                const nomeProduto = produtoMap[idProduto] || `Produto ${idProduto}`;
                const quantidade = prod.quantidade || 0;
                quantidadePorDemanda[nomeProduto] = (quantidadePorDemanda[nomeProduto] || 0) + quantidade;
            }
        });
    });
    
    // Ordenar por quantidade decrescente
    const demandasOrdenadas = Object.entries(quantidadePorDemanda)
        .sort((a, b) => b[1] - a[1]);
    
    const labelsDemandas = demandasOrdenadas.map(p => p[0]);
    const dataDemandas = demandasOrdenadas.map(p => p[1]);
    
    const ctx5 = document.getElementById('chartDemandas');
    if (ctx5) {
        if (chartDemandasInstance) chartDemandasInstance.destroy();
        chartDemandasInstance = new Chart(ctx5, {
            type: 'bar',
            data: {
                labels: labelsDemandas,
                datasets: [{
                    label: 'Quantidade',
                    data: dataDemandas,
                    backgroundColor: '#1b1464',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y', // Barras horizontais
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        padding: 12,
                        callbacks: {
                            label: (context) => `${context.label}: ${context.parsed.x}`
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: { font: { size: 11 } }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { font: { size: 11 } }
                    }
                }
            }
        });
    }
    
    // 6. Gráfico de Documentos de Inteligência (Produtos 33-38) - Pizza - RESPEITA FILTRO
    const documentosProdutos = [33, 34, 35, 36, 37, 38];
    const documentosLabels = ['Mensagem', 'RELINT', 'REMI', 'POI', 'PI', 'PS'];
    const quantidadePorDocumento = {};
    
    atividades.forEach(a => {
        (a.produtos || []).forEach(prod => {
            const idProduto = prod.id_produto;
            if (documentosProdutos.includes(idProduto)) {
                const index = documentosProdutos.indexOf(idProduto);
                const label = documentosLabels[index];
                const quantidade = prod.quantidade || 0;
                quantidadePorDocumento[label] = (quantidadePorDocumento[label] || 0) + quantidade;
            }
        });
    });
    
    const labelsDocumentos = Object.keys(quantidadePorDocumento);
    const dataDocumentos = Object.values(quantidadePorDocumento);
    
    const ctx6 = document.getElementById('chartDocumentos');
    if (ctx6) {
        if (chartDocumentosInstance) chartDocumentosInstance.destroy();
        chartDocumentosInstance = new Chart(ctx6, {
            type: 'doughnut',
            data: {
                labels: labelsDocumentos,
                datasets: [{
                    data: dataDocumentos,
                    backgroundColor: [
                        '#005a9e', '#1b1464', '#00a86b', '#ff6b6b', '#ffd93d', '#6c5ce7'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'right',
                        labels: { font: { size: 11 }, padding: 10 }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        padding: 12,
                        callbacks: {
                            label: (context) => `${context.label}: ${context.parsed}`
                        }
                    }
                }
            }
        });
    }
    
    // 7. Tabela de Coletivas de Imprensa (Produto 43) - RESPEITA FILTRO
    const tabelaColetivas = document.getElementById('tabelaColetivasBody');
    if (tabelaColetivas) {
        tabelaColetivas.innerHTML = '';
        
        // Filtrar atividades que contêm o produto 43 (Coletiva de Imprensa)
        const atividadesColetivas = atividades.filter(a => {
            return (a.produtos || []).some(prod => prod.id_produto === 43);
        });
        
        // Ordenar por data (mais recente primeiro)
        atividadesColetivas.sort((a, b) => new Date(b.data) - new Date(a.data));
        
        atividadesColetivas.forEach(a => {
            const dataFormatada = new Date(a.data).toLocaleDateString('pt-BR');
            const descricao = a.descricao || 'Sem descrição';
            
            const row = `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:8px; white-space:nowrap;">${dataFormatada}</td>
                    <td style="padding:8px; white-space:normal; word-wrap:break-word;">${descricao}</td>
                </tr>
            `;
            tabelaColetivas.innerHTML += row;
        });
        
        // Se não houver coletivas
        if (atividadesColetivas.length === 0) {
            tabelaColetivas.innerHTML = `
                <tr>
                    <td colspan="2" style="padding:20px; text-align:center; color:#999;">
                        Nenhuma coletiva de imprensa no período
                    </td>
                </tr>
            `;
        }
    }
}

// Função auxiliar para calcular produtos por ano baseado na categoria
function calcularProdutosPorAno(atividades, idCategoria) {
    const produtoCategoriaMap = {};
    produtosData.forEach(p => {
        produtoCategoriaMap[p.id_produto_atividade] = p.id_categoria_atividade;
    });
    
    const porAno = {};
    atividades.forEach(a => {
        const ano = new Date(a.data).getFullYear();
        if (!porAno[ano]) porAno[ano] = 0;
        
        (a.produtos || []).forEach(prod => {
            const idProduto = prod.id_produto;
            const catProduto = produtoCategoriaMap[idProduto];
            if (catProduto === idCategoria) {
                porAno[ano] += (prod.quantidade || 0);
            }
        });
    });
    
    // Ordenar por ano
    const ordenado = {};
    Object.keys(porAno).sort().forEach(ano => {
        ordenado[ano] = porAno[ano];
    });
    
    return ordenado;
}

// Renderizar Quadro de QTCs por Ano (ignora filtro, usa todasAtividades)
// Renderizar Quadro de QTCs por Ano (ignora filtro, usa todasAtividades) - TRANSPOSTO
function renderQuadroQTCs() {
    const qtcsPorAno = {};
    
    todasAtividades.forEach(a => {
        const ano = new Date(a.data).getFullYear();
        if (!qtcsPorAno[ano]) {
            qtcsPorAno[ano] = { internos: 0, conjuntas: 0 };
        }
        
        const equipes = a.equipes || [];
        if (equipes.length === 0) return;
        
        // Verificar se todas as equipes são internas
        const allInternos = equipes.every(id => equipeInternalMap[id] === true);
        if (allInternos) {
            qtcsPorAno[ano].internos += 1;
        } else {
            qtcsPorAno[ano].conjuntas += 1;
        }
    });
    
    // Ordenar anos
    const anosOrdenados = Object.keys(qtcsPorAno).sort();
    
    // Criar cabeçalho da tabela (Anos nas colunas)
    const thead = document.querySelector('#quadroQTCs thead tr');
    if (thead) {
        let html = `<th style="padding:10px; border-bottom:2px solid #ddd; position:sticky; left:0; background:#f5f5f5; z-index:2;"></th>`;
        anosOrdenados.forEach(ano => {
            html += `<th style="padding:10px; border-bottom:2px solid #ddd; text-align:center;">${ano}</th>`;
        });
        thead.innerHTML = html;
    }
    
    // Preencher corpo da tabela (Linhas: QTCs Internos, Ação Conjunta, Total QTCs)
    const tbody = document.getElementById('tabelaQTCsBody');
    if (tbody) {
        tbody.innerHTML = '';
        
        // Linha 1: QTCs Internos
        let rowInternos = `
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:10px; font-weight:600; position:sticky; left:0; background:#fff;">QTCs Internos</td>
        `;
        anosOrdenados.forEach(ano => {
            const dados = qtcsPorAno[ano];
            rowInternos += `<td style="padding:10px; text-align:center;">${dados.internos}</td>`;
        });
        rowInternos += `</tr>`;
        tbody.innerHTML += rowInternos;
        
        // Linha 2: Ação Conjunta
        let rowConjuntas = `
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:10px; font-weight:600; position:sticky; left:0; background:#fff;">Ação Conjunta</td>
        `;
        anosOrdenados.forEach(ano => {
            const dados = qtcsPorAno[ano];
            rowConjuntas += `<td style="padding:10px; text-align:center;">${dados.conjuntas}</td>`;
        });
        rowConjuntas += `</tr>`;
        tbody.innerHTML += rowConjuntas;
        
        // Linha 3: Total QTCs
        let rowTotal = `
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:10px; font-weight:700; position:sticky; left:0; background:#fff;">Total QTCs</td>
        `;
        anosOrdenados.forEach(ano => {
            const dados = qtcsPorAno[ano];
            const total = dados.internos + dados.conjuntas;
            rowTotal += `<td style="padding:10px; text-align:center; font-weight:600;">${total}</td>`;
        });
        rowTotal += `</tr>`;
        tbody.innerHTML += rowTotal;
    }
}

// Renderizar Quadro de Resultados Operacionais (usa todo o banco - todasAtividades)
function renderQuadroResultados() {
    // Mapear produto -> categoria
    const produtoCategoriaMap = {};
    produtosData.forEach(p => {
        produtoCategoriaMap[p.id_produto_atividade] = p.id_categoria_atividade;
    });
    
    // Coletar anos únicos de TODAS as atividades
    const anos = new Set();
    todasAtividades.forEach(a => {
        const ano = new Date(a.data).getFullYear();
        anos.add(ano);
    });
    const anosOrdenados = Array.from(anos).sort();
    
    // Estrutura: { id_produto: { ano: quantidade } }
    const produtosAnoQuantidade = {};
    
    todasAtividades.forEach(a => {
        const ano = new Date(a.data).getFullYear();
        (a.produtos || []).forEach(prod => {
            const idProduto = prod.id_produto;
            if (!produtosAnoQuantidade[idProduto]) {
                produtosAnoQuantidade[idProduto] = {};
            }
            if (!produtosAnoQuantidade[idProduto][ano]) {
                produtosAnoQuantidade[idProduto][ano] = 0;
            }
            produtosAnoQuantidade[idProduto][ano] += (prod.quantidade || 0);
        });
    });
    
    // Criar cabeçalho da tabela (Categoria, Produto, Anos)
    const thead = document.querySelector('#quadroResultados thead tr');
    if (thead) {
        let html = `
            <th style="padding:8px; border-bottom:2px solid #ddd; width:150px;">Categoria</th>
            <th style="padding:8px; border-bottom:2px solid #ddd; position:sticky; left:0; background:#f5f5f5; z-index:2;">Produto</th>
        `;
        anosOrdenados.forEach(ano => {
            html += `<th style="padding:8px; border-bottom:2px solid #ddd; text-align:center;">${ano}</th>`;
        });
        thead.innerHTML = html;
    }
    
    // Preencher corpo da tabela
    const tbody = document.getElementById('tabelaResultadosBody');
    if (tbody) {
        tbody.innerHTML = '';
        
        // Ordenar produtos por categoria, depois por nome
        const produtosIds = Object.keys(produtosAnoQuantidade).sort((a, b) => {
            const catA = produtoCategoriaMap[a] || 999;
            const catB = produtoCategoriaMap[b] || 999;
            if (catA !== catB) return catA - catB;
            const nomeA = produtoMap[a] || '';
            const nomeB = produtoMap[b] || '';
            return nomeA.localeCompare(nomeB);
        });
        
        produtosIds.forEach(idProduto => {
            const nomeProduto = produtoMap[idProduto] || `Produto ${idProduto}`;
            const idCategoria = produtoCategoriaMap[idProduto];
            const nomeCategoria = categoriaMap[idCategoria] || `Categoria ${idCategoria}`;
            const dadosAno = produtosAnoQuantidade[idProduto];
            
            let row = `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:8px; font-size:0.8rem; color:#666; width:150px;">${nomeCategoria}</td>
                    <td style="padding:8px; position:sticky; left:0; background:#fff; font-weight:500;">${nomeProduto}</td>
            `;
            
            anosOrdenados.forEach(ano => {
                const qtd = dadosAno[ano] || 0;
                row += `<td style="padding:8px; text-align:center;">${qtd}</td>`;
            });
            
            row += `</tr>`;
            tbody.innerHTML += row;
        });
    }
}

// Renderizar Quadro de Drogas Apreendidas (ignora filtro, usa todasAtividades, categoria 5)
function renderQuadroDrogas() {
    // Mapear produto -> categoria
    const produtoCategoriaMap = {};
    produtosData.forEach(p => {
        produtoCategoriaMap[p.id_produto_atividade] = p.id_categoria_atividade;
    });
    
    // Coletar anos únicos de TODAS as atividades
    const anos = new Set();
    todasAtividades.forEach(a => {
        const ano = new Date(a.data).getFullYear();
        anos.add(ano);
    });
    const anosOrdenados = Array.from(anos).sort();
    
    // Estrutura: { id_produto: { ano: quantidade } } - Somente categoria 5 (Drogas)
    const produtosAnoQuantidade = {};
    
    todasAtividades.forEach(a => {
        const ano = new Date(a.data).getFullYear();
        (a.produtos || []).forEach(prod => {
            const idProduto = prod.id_produto;
            const categoriaId = produtoCategoriaMap[idProduto];
            if (categoriaId === 5) { // Categoria 5 - Drogas
                if (!produtosAnoQuantidade[idProduto]) {
                    produtosAnoQuantidade[idProduto] = {};
                }
                if (!produtosAnoQuantidade[idProduto][ano]) {
                    produtosAnoQuantidade[idProduto][ano] = 0;
                }
                produtosAnoQuantidade[idProduto][ano] += (prod.quantidade || 0);
            }
        });
    });
    
    // Criar cabeçalho da tabela (Produto, Anos)
    const thead = document.querySelector('#quadroDrogas thead tr');
    if (thead) {
        let html = `
            <th style="padding:8px; border-bottom:2px solid #ddd; position:sticky; left:0; background:#f5f5f5; z-index:2;">Produto</th>
        `;
        anosOrdenados.forEach(ano => {
            html += `<th style="padding:8px; border-bottom:2px solid #ddd; text-align:center;">${ano}</th>`;
        });
        thead.innerHTML = html;
    }
    
    // Preencher corpo da tabela
    const tbody = document.getElementById('tabelaDrogasBody');
    if (tbody) {
        tbody.innerHTML = '';
        
        // Ordenar produtos por nome
        const produtosIds = Object.keys(produtosAnoQuantidade).sort((a, b) => {
            const nomeA = produtoMap[a] || '';
            const nomeB = produtoMap[b] || '';
            return nomeA.localeCompare(nomeB);
        });
        
        produtosIds.forEach(idProduto => {
            const nomeProduto = produtoMap[idProduto] || `Produto ${idProduto}`;
            const dadosAno = produtosAnoQuantidade[idProduto];
            
            let row = `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:8px; position:sticky; left:0; background:#fff; font-weight:500;">${nomeProduto}</td>
            `;
            
            anosOrdenados.forEach(ano => {
                const qtd = dadosAno[ano] || 0;
                row += `<td style="padding:8px; text-align:center;">${qtd}</td>`;
            });
            
            row += `</tr>`;
            tbody.innerHTML += row;
        });
    }
}

// Renderizar Quadro de Material Bélico (ignora filtro, usa todasAtividades, categoria 2)
function renderQuadroMaterialBelico() {
    // Mapear produto -> categoria
    const produtoCategoriaMap = {};
    produtosData.forEach(p => {
        produtoCategoriaMap[p.id_produto_atividade] = p.id_categoria_atividade;
    });
    
    // Coletar anos únicos de TODAS as atividades
    const anos = new Set();
    todasAtividades.forEach(a => {
        const ano = new Date(a.data).getFullYear();
        anos.add(ano);
    });
    const anosOrdenados = Array.from(anos).sort();
    
    // Estrutura: { id_produto: { ano: quantidade } } - Somente categoria 2 (Material Bélico)
    const produtosAnoQuantidade = {};
    
    todasAtividades.forEach(a => {
        const ano = new Date(a.data).getFullYear();
        (a.produtos || []).forEach(prod => {
            const idProduto = prod.id_produto;
            const categoriaId = produtoCategoriaMap[idProduto];
            if (categoriaId === 2) { // Categoria 2 - Material Bélico
                if (!produtosAnoQuantidade[idProduto]) {
                    produtosAnoQuantidade[idProduto] = {};
                }
                if (!produtosAnoQuantidade[idProduto][ano]) {
                    produtosAnoQuantidade[idProduto][ano] = 0;
                }
                produtosAnoQuantidade[idProduto][ano] += (prod.quantidade || 0);
            }
        });
    });
    
    // Criar cabeçalho da tabela (Produto, Anos)
    const thead = document.querySelector('#quadroMaterialBelico thead tr');
    if (thead) {
        let html = `
            <th style="padding:8px; border-bottom:2px solid #ddd; position:sticky; left:0; background:#f5f5f5; z-index:2;">Produto</th>
        `;
        anosOrdenados.forEach(ano => {
            html += `<th style="padding:8px; border-bottom:2px solid #ddd; text-align:center;">${ano}</th>`;
        });
        thead.innerHTML = html;
    }
    
    // Preencher corpo da tabela
    const tbody = document.getElementById('tabelaMaterialBelicoBody');
    if (tbody) {
        tbody.innerHTML = '';
        
        // Ordenar produtos por nome
        const produtosIds = Object.keys(produtosAnoQuantidade).sort((a, b) => {
            const nomeA = produtoMap[a] || '';
            const nomeB = produtoMap[b] || '';
            return nomeA.localeCompare(nomeB);
        });
        
        produtosIds.forEach(idProduto => {
            const nomeProduto = produtoMap[idProduto] || `Produto ${idProduto}`;
            const dadosAno = produtosAnoQuantidade[idProduto];
            
            let row = `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:8px; position:sticky; left:0; background:#fff; font-weight:500;">${nomeProduto}</td>
            `;
            
            anosOrdenados.forEach(ano => {
                const qtd = dadosAno[ano] || 0;
                row += `<td style="padding:8px; text-align:center;">${qtd}</td>`;
            });
            
            row += `</tr>`;
            tbody.innerHTML += row;
        });
    }
}

function abrirListaAtividades() {
    // Transferir filtros do dashboard para a tela de Atividades Cadastradas
    const ultimosFiltros = localStorage.getItem('ultimosFiltrosDashboard');
    if (ultimosFiltros) {
        localStorage.setItem('filtrosAtividadesCadastradas', ultimosFiltros);
    }
    
    // Marcar que a nova aba deve abrir direto na lista de atividades
    localStorage.setItem('abrirAtividadesAposCarga', 'true');
    
    // Abrir em nova aba
    window.open(window.location.href.split('#')[0], '_blank');
}

function aplicarFiltros() {
    // Mostrar loader
    showLoader();
    
    const filtros = {
        dataInicio: document.getElementById('dataInicio').value,
        dataFim: document.getElementById('dataFim').value,
        equipe: tmsDashEquipe ? tmsDashEquipe.getValue().map(String) :
            Array.from(document.getElementById('equipeSelect')?.selectedOptions || []).map(o => o.value),
        categoria: tmsDashCategoria ? tmsDashCategoria.getValue().map(String) :
            Array.from(document.getElementById('categoriaSelect')?.selectedOptions || []).map(o => o.value),
        produto: tmsDashProduto ? tmsDashProduto.getValue().map(String) :
            Array.from(document.getElementById('produtoSelect')?.selectedOptions || []).map(o => o.value)
    };
    
    // Salvar filtros no localStorage para manter estado
    localStorage.setItem('ultimosFiltrosDashboard', JSON.stringify(filtros));
    
    loadAtividades(filtros);
}

// Função para forçar atualização ignorando cache
function forcarAtualizacao() {
    if (confirm('Isso irá recarregar todos os dados do Firestore, ignorando o cache. Deseja continuar?')) {
        showLoader();
        clearCache();
        
        // Reaplicar filtros atuais, mas forçando reload
        const ultimosFiltros = localStorage.getItem('ultimosFiltrosDashboard');
        const filtros = ultimosFiltros ? JSON.parse(ultimosFiltros) : {};
        
        loadAtividades(filtros, true); // true = forceReload
    }
}

async function exportarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    let y = 15;
    const pageWidth = 210;
    const margin = 10;
    const contentWidth = pageWidth - (2 * margin);
    
    // CABEÇALHO
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Atividades BDI Serra', pageWidth / 2, y, { align: 'center' });
    y += 10;
    
    // FILTROS APLICADOS
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    // Função para converter data de YYYY-MM-DD para DD/MM/YYYY
    const formatarData = (dataISO) => {
        if (!dataISO || dataISO === 'Não definida') return 'Não definida';
        const [ano, mes, dia] = dataISO.split('-');
        return `${dia}/${mes}/${ano}`;
    };
    
    const dataInicioISO = document.getElementById('dataInicio').value;
    const dataFimISO = document.getElementById('dataFim').value;
    const dataInicio = formatarData(dataInicioISO) || 'Não definida';
    const dataFim = formatarData(dataFimISO) || 'Não definida';
    doc.text(`Período: ${dataInicio} até ${dataFim}`, margin, y);
    y += 5;
    
    // Equipes selecionadas
    const equipesSelecionadas = tmsDashEquipe
        ? tmsDashEquipe.getValue().map(id => equipeMap[id] || id)
        : Array.from(document.getElementById('equipeSelect')?.selectedOptions || []).map(opt => opt.text);
    const totalEquipes = Object.keys(equipeMap).length;
    const equipeTexto = equipesSelecionadas.length === 0 || equipesSelecionadas.length === totalEquipes
        ? 'Todas' 
        : equipesSelecionadas.join(', ');
    doc.text(`Equipes: ${equipeTexto}`, margin, y);
    y += 5;
    
    // Categorias selecionadas
    const categoriasSelecionadas = tmsDashCategoria
        ? tmsDashCategoria.getValue().map(id => categoriaMap[id] || id)
        : Array.from(document.getElementById('categoriaSelect')?.selectedOptions || []).map(opt => opt.text);
    const totalCategorias = Object.keys(categoriaMap).length;
    const categoriaTexto = categoriasSelecionadas.length === 0 || categoriasSelecionadas.length === totalCategorias
        ? 'Todas' 
        : categoriasSelecionadas.join(', ');
    doc.text(`Categorias: ${categoriaTexto}`, margin, y);
    y += 5;
    
    // Produtos selecionados
    const produtosSelecionados = tmsDashProduto
        ? tmsDashProduto.getValue().map(id => produtoMap[id] || id)
        : Array.from(document.getElementById('produtoSelect')?.selectedOptions || []).map(opt => opt.text);
    const totalProdutos = Object.keys(produtoMap).length;
    const produtoTexto = produtosSelecionados.length === 0 || produtosSelecionados.length === totalProdutos
        ? 'Todos' 
        : produtosSelecionados.join(', ');
    doc.text(`Produtos: ${produtoTexto}`, margin, y);
    y += 8;
    
    // TÍTULO: INDICADORES (FILTRO)
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.setTextColor(27, 20, 100);
    doc.text('INDICADORES (FILTRO)', pageWidth / 2, y + 5, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 10;
    
    // INDICADORES - Primeira linha (3 cards)
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('INDICADORES GERAIS', pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.setFont(undefined, 'normal');
    
    const cardWidth = (contentWidth - 6) / 3;
    const cardsStartX = margin;
    let x = cardsStartX;
    
    // Total QTCs
    const totalQTC = document.getElementById('totalQTC')?.querySelector('.kpi-value')?.innerText || '0';
    doc.rect(x, y, cardWidth, 15);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(totalQTC, x + cardWidth/2, y + 6, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text('TOTAL DE QTCS', x + cardWidth/2, y + 11, { align: 'center' });
    x += cardWidth + 3;
    
    // QTCs Internos
    const qtInternos = document.getElementById('qtInternos')?.querySelector('.kpi-value')?.innerText || '0';
    doc.rect(x, y, cardWidth, 15);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(qtInternos, x + cardWidth/2, y + 6, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text('QTCS INTERNOS', x + cardWidth/2, y + 11, { align: 'center' });
    x += cardWidth + 3;
    
    // Ações Conjuntas
    const qtConjuntas = document.getElementById('qtConjuntas')?.querySelector('.kpi-value')?.innerText || '0';
    doc.rect(x, y, cardWidth, 15);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(qtConjuntas, x + cardWidth/2, y + 6, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text('AÇÕES CONJUNTAS', x + cardWidth/2, y + 11, { align: 'center' });
    y += 18;
    
    // INDICADORES - Segunda linha (6 cards de produtos - sem Drogas)
    const cardWidth2 = (contentWidth - 15) / 4;
    const totalCardsWidth = (cardWidth2 * 4) + (3 * 3); // 4 cards + 3 espaços
    const cardsStartX2 = margin + (contentWidth - totalCardsWidth) / 2;
    x = cardsStartX2;
    
    // Linha 1 de produtos
    const produtos1 = [
        { id: 'totalVeiculos', label: 'VEÍCULOS' },
        { id: 'totalPessoas', label: 'PESSOAS' },
        { id: 'totalArmas', label: 'ARMAS' },
        { id: 'totalMunicoes', label: 'MUNIÇÕES' }
    ];
    
    produtos1.forEach((prod, idx) => {
        const valor = document.getElementById(prod.id)?.querySelector('.kpi-value')?.innerText || '0';
        doc.rect(x, y, cardWidth2, 15);
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text(valor, x + cardWidth2/2, y + 6, { align: 'center' });
        doc.setFontSize(7);
        doc.setFont(undefined, 'normal');
        doc.text(prod.label, x + cardWidth2/2, y + 11, { align: 'center' });
        x += cardWidth2 + 3;
    });
    y += 18;
    
    // Linha 2 de produtos (2 cards centralizados - sem Drogas)
    const totalCardsWidth2 = (cardWidth2 * 2) + (1 * 3); // 2 cards + 1 espaço
    x = margin + (contentWidth - totalCardsWidth2) / 2;
    const produtos2 = [
        { id: 'totalColetivas', label: 'COLETIVAS' },
        { id: 'totalDemandas', label: 'DEMANDAS INTEL.' }
    ];
    
    produtos2.forEach((prod, idx) => {
        const valor = document.getElementById(prod.id)?.querySelector('.kpi-value')?.innerText || '0';
        doc.rect(x, y, cardWidth2, 15);
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text(valor, x + cardWidth2/2, y + 6, { align: 'center' });
        doc.setFontSize(7);
        doc.setFont(undefined, 'normal');
        doc.text(prod.label, x + cardWidth2/2, y + 11, { align: 'center' });
        x += cardWidth2 + 3;
    });
    y += 20;
    
    // TÍTULO: GRÁFICOS (FILTRO)
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.setTextColor(27, 20, 100);
    doc.text('GRÁFICOS (FILTRO)', pageWidth / 2, y + 5, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 12;
    
    // GRÁFICOS (tabela + imagem lado a lado)
    try {
        // Função auxiliar para adicionar gráfico com tabela
        const addChartWithTable = async (chartId, title, getTableData) => {
            if (y > 220) {
                doc.addPage();
                y = 15;
            }
            
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text(title, margin, y);
            y += 5;
            
            const chartCanvas = document.querySelector(`#${chartId}`);
            if (chartCanvas) {
                // Capturar gráfico
                const chartImg = chartCanvas.toDataURL('image/png', 1.0);
                
                // Larguras: gráfico 104mm (redução de 20%)
                const chartWidth = 104;
                const chartHeight = 48;
                
                // Desenhar tabela à esquerda usando autoTable
                const tableData = getTableData();
                const tableBody = tableData.map(row => [row.label, row.value]);
                
                doc.autoTable({
                    startY: y,
                    head: [['Item', 'Valor']],
                    body: tableBody,
                    margin: { left: margin, right: margin + 120 },
                    styles: {
                        overflow: 'linebreak',
                        fontSize: 8,
                        cellPadding: 2,
                    },
                    columnStyles: {
                        0: { cellWidth: 40 },
                        1: { cellWidth: 15, halign: 'right' }
                    },
                    theme: 'plain',
                    headStyles: {
                        fillColor: [245, 245, 245],
                        textColor: [0, 0, 0],
                        fontSize: 8,
                        fontStyle: 'bold'
                    }
                });
                
                // Desenhar gráfico à direita
                const tableEndY = doc.lastAutoTable.finalY;
                const graphY = Math.max(y - 5, tableEndY - chartHeight);
                doc.addImage(chartImg, 'PNG', margin + 65, y - 5, chartWidth, chartHeight);
                
                y = Math.max(tableEndY, y + chartHeight) + 5;
            }
        };
        
        // Gráfico 1: Atividades por Equipe
        await addChartWithTable('chartEquipes', 'Atividades por Equipe', () => {
            const chart = Chart.getChart('chartEquipes');
            if (!chart) return [];
            return chart.data.labels.map((label, idx) => ({
                label: label,
                value: String(chart.data.datasets[0].data[idx] || 0)
            }));
        });
        
        // Gráfico 2: Produtos Apreendidos
        await addChartWithTable('chartParticipacao', 'Produtos Apreendidos no Período', () => {
            const chart = Chart.getChart('chartParticipacao');
            if (!chart) return [];
            return chart.data.labels.map((label, idx) => ({
                label: label,
                value: String(chart.data.datasets[0].data[idx] || 0)
            }));
        });
        
        // Gráfico 3: Demandas de Inteligência
        if (y > 240) {
            doc.addPage();
            y = 15;
        }
        await addChartWithTable('chartDemandas', 'Demandas de Inteligência', () => {
            const chart = Chart.getChart('chartDemandas');
            if (!chart) return [];
            return chart.data.labels.map((label, idx) => ({
                label: label,
                value: String(chart.data.datasets[0].data[idx] || 0)
            }));
        });
        
        // Gráfico 4: Documentos de Inteligência
        await addChartWithTable('chartDocumentos', 'Documentos de Inteligência', () => {
            const chart = Chart.getChart('chartDocumentos');
            if (!chart) return [];
            return chart.data.labels.map((label, idx) => ({
                label: label,
                value: String(chart.data.datasets[0].data[idx] || 0)
            }));
        });
        
        // Tabela: Coletivas de Imprensa
        if (y > 200) {
            doc.addPage();
            y = 15;
        }
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Coletivas de Imprensa', margin, y);
        y += 5;
        
        const tabelaColetivas = document.getElementById('tabelaColetivasBody');
        if (tabelaColetivas) {
            const rowsColetivas = tabelaColetivas.querySelectorAll('tr');
            const coletivasBody = [];
            rowsColetivas.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 2) {
                    coletivasBody.push([
                        cells[0].innerText,
                        cells[1].innerText
                    ]);
                }
            });
            
            if (coletivasBody.length > 0) {
                doc.autoTable({
                    startY: y,
                    head: [['Data', 'Descrição']],
                    body: coletivasBody,
                    margin: { left: margin, right: margin },
                    styles: {
                        overflow: 'linebreak',
                        fontSize: 8,
                        cellPadding: 3,
                    },
                    columnStyles: {
                        0: { cellWidth: 25 },
                        1: { cellWidth: contentWidth - 25 }
                    },
                    headStyles: {
                        fillColor: [245, 245, 245],
                        textColor: [0, 0, 0],
                        fontSize: 8,
                        fontStyle: 'bold'
                    }
                });
                
                y = doc.lastAutoTable.finalY + 10;
            }
        }
        
        // TÍTULO: GRÁFICOS (COMPILADOS ANUAIS, SEM FILTRO)
        if (y > 240) {
            doc.addPage();
            y = 15;
        }
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, y, contentWidth, 8, 'F');
        doc.setTextColor(27, 20, 100);
        doc.text('GRÁFICOS (COMPILADOS ANUAIS, SEM FILTRO)', pageWidth / 2, y + 5, { align: 'center' });
        doc.setTextColor(0, 0, 0);
        y += 12;
        
        // Gráfico 5: Veículos Anual
        await addChartWithTable('chartVeiculosAnual', 'Evolução Anual - Veículos Recuperados', () => {
            const chart = Chart.getChart('chartVeiculosAnual');
            if (!chart) return [];
            return chart.data.labels.map((label, idx) => ({
                label: label,
                value: String(chart.data.datasets[0].data[idx] || 0)
            }));
        });
        
        // Gráfico 6: Pessoas Anual
        await addChartWithTable('chartPessoasAnual', 'Evolução Anual - Pessoas Presas', () => {
            const chart = Chart.getChart('chartPessoasAnual');
            if (!chart) return [];
            return chart.data.labels.map((label, idx) => ({
                label: label,
                value: String(chart.data.datasets[0].data[idx] || 0)
            }));
        });
        
        // TABELAS ESTATÍSTICAS
        // QTCs por Ano (TRANSPOSTO)
        if (y > 200) {
            doc.addPage();
            y = 15;
        }
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('QTCs por Ano', margin, y);
        y += 5;
        
        const tabelaQTCs = document.getElementById('tabelaQTCsBody');
        const theadQTCs = document.querySelector('#quadroQTCs thead tr');
        if (tabelaQTCs && theadQTCs) {
            // Extrair cabeçalho (anos)
            const headCells = theadQTCs.querySelectorAll('th');
            const qtcsHead = [];
            headCells.forEach(cell => {
                qtcsHead.push(cell.innerText);
            });
            
            // Extrair linhas (QTC types)
            const rows = tabelaQTCs.querySelectorAll('tr');
            const qtcsBody = [];
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length > 0) {
                    const rowData = [];
                    cells.forEach(cell => {
                        rowData.push(cell.innerText);
                    });
                    qtcsBody.push(rowData);
                }
            });
            
            doc.autoTable({
                startY: y,
                head: [qtcsHead],
                body: qtcsBody,
                margin: { left: margin, right: margin },
                styles: {
                    overflow: 'linebreak',
                    fontSize: 8,
                    cellPadding: 2,
                    halign: 'center'
                },
                columnStyles: {
                    0: { cellWidth: 35, halign: 'left', fontStyle: 'bold' }
                },
                headStyles: {
                    fillColor: [245, 245, 245],
                    textColor: [0, 0, 0],
                    fontSize: 8,
                    fontStyle: 'bold',
                    halign: 'center'
                }
            });
            
            y = doc.lastAutoTable.finalY + 5;
        }
        
        // Resultados Operacionais
        if (y > 200) {
            doc.addPage();
            y = 15;
        }
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Resultados Operacionais', margin, y);
        y += 5;
        
        const tabelaResultados = document.getElementById('tabelaResultadosBody');
        if (tabelaResultados) {
            const thead = document.querySelector('#quadroResultados thead tr');
            const headerCells = thead?.querySelectorAll('th');
            
            // Cabeçalho
            const headers = [];
            if (headerCells) {
                Array.from(headerCells).forEach(cell => {
                    headers.push(cell.innerText);
                });
            }
            
            // Dados
            const rows = tabelaResultados.querySelectorAll('tr');
            const resultadosBody = [];
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                const rowData = [];
                Array.from(cells).forEach(cell => {
                    rowData.push(cell.innerText);
                });
                if (rowData.length > 0) {
                    resultadosBody.push(rowData);
                }
            });
            
            // Calcular larguras dinamicamente baseado no número de colunas
            const numCols = headers.length;
            const col0Width = 50; // Produto
            const col1Width = 35; // Categoria
            const remainingWidth = contentWidth - col0Width - col1Width;
            const yearColWidth = numCols > 2 ? remainingWidth / (numCols - 2) : 20;
            
            const columnStyles = {
                0: { cellWidth: col0Width },
                1: { cellWidth: col1Width }
            };
            
            // Adicionar estilos para colunas de anos
            for (let i = 2; i < numCols; i++) {
                columnStyles[i] = { cellWidth: yearColWidth, halign: 'center' };
            }
            
            doc.autoTable({
                startY: y,
                head: [headers],
                body: resultadosBody,
                margin: { left: margin, right: margin },
                styles: {
                    overflow: 'linebreak',
                    fontSize: 7,
                    cellPadding: 2,
                },
                columnStyles: columnStyles,
                headStyles: {
                    fillColor: [245, 245, 245],
                    textColor: [0, 0, 0],
                    fontSize: 7,
                    fontStyle: 'bold'
                }
            });
        }
        
        // Drogas Apreendidas
        if (y > 200) {
            doc.addPage();
            y = 15;
        }
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Drogas Apreendidas', margin, y);
        y += 5;
        
        const tabelaDrogas = document.getElementById('tabelaDrogasBody');
        if (tabelaDrogas) {
            const theadDrogas = document.querySelector('#quadroDrogas thead tr');
            const headerCellsDrogas = theadDrogas?.querySelectorAll('th');
            
            // Cabeçalho
            const headersDrogas = [];
            if (headerCellsDrogas) {
                Array.from(headerCellsDrogas).forEach(cell => {
                    headersDrogas.push(cell.innerText);
                });
            }
            
            // Dados
            const rowsDrogas = tabelaDrogas.querySelectorAll('tr');
            const drogasBody = [];
            rowsDrogas.forEach(row => {
                const cells = row.querySelectorAll('td');
                const rowData = [];
                Array.from(cells).forEach(cell => {
                    rowData.push(cell.innerText);
                });
                if (rowData.length > 0) {
                    drogasBody.push(rowData);
                }
            });
            
            // Calcular larguras dinamicamente
            const numColsDrogas = headersDrogas.length;
            const col0WidthDrogas = 60; // Produto
            const remainingWidthDrogas = contentWidth - col0WidthDrogas;
            const yearColWidthDrogas = numColsDrogas > 1 ? remainingWidthDrogas / (numColsDrogas - 1) : 20;
            
            const columnStylesDrogas = {
                0: { cellWidth: col0WidthDrogas }
            };
            
            // Adicionar estilos para colunas de anos
            for (let i = 1; i < numColsDrogas; i++) {
                columnStylesDrogas[i] = { cellWidth: yearColWidthDrogas, halign: 'center' };
            }
            
            doc.autoTable({
                startY: y,
                head: [headersDrogas],
                body: drogasBody,
                margin: { left: margin, right: margin },
                styles: {
                    overflow: 'linebreak',
                    fontSize: 7,
                    cellPadding: 2,
                },
                columnStyles: columnStylesDrogas,
                headStyles: {
                    fillColor: [245, 245, 245],
                    textColor: [0, 0, 0],
                    fontSize: 7,
                    fontStyle: 'bold'
                }
            });
            
            y = doc.lastAutoTable.finalY + 5;
        }
        
        // Material Bélico
        if (y > 200) {
            doc.addPage();
            y = 15;
        }
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Material Bélico', margin, y);
        y += 5;
        
        const tabelaMaterialBelico = document.getElementById('tabelaMaterialBelicoBody');
        if (tabelaMaterialBelico) {
            const theadMB = document.querySelector('#quadroMaterialBelico thead tr');
            const headerCellsMB = theadMB?.querySelectorAll('th');
            
            // Cabeçalho
            const headersMB = [];
            if (headerCellsMB) {
                Array.from(headerCellsMB).forEach(cell => {
                    headersMB.push(cell.innerText);
                });
            }
            
            // Dados
            const rowsMB = tabelaMaterialBelico.querySelectorAll('tr');
            const mbBody = [];
            rowsMB.forEach(row => {
                const cells = row.querySelectorAll('td');
                const rowData = [];
                Array.from(cells).forEach(cell => {
                    rowData.push(cell.innerText);
                });
                if (rowData.length > 0) {
                    mbBody.push(rowData);
                }
            });
            
            // Calcular larguras dinamicamente
            const numColsMB = headersMB.length;
            const col0WidthMB = 60; // Produto
            const remainingWidthMB = contentWidth - col0WidthMB;
            const yearColWidthMB = numColsMB > 1 ? remainingWidthMB / (numColsMB - 1) : 20;
            
            const columnStylesMB = {
                0: { cellWidth: col0WidthMB }
            };
            
            // Adicionar estilos para colunas de anos
            for (let i = 1; i < numColsMB; i++) {
                columnStylesMB[i] = { cellWidth: yearColWidthMB, halign: 'center' };
            }
            
            doc.autoTable({
                startY: y,
                head: [headersMB],
                body: mbBody,
                margin: { left: margin, right: margin },
                styles: {
                    overflow: 'linebreak',
                    fontSize: 7,
                    cellPadding: 2,
                },
                columnStyles: columnStylesMB,
                headStyles: {
                    fillColor: [245, 245, 245],
                    textColor: [0, 0, 0],
                    fontSize: 7,
                    fontStyle: 'bold'
                }
            });
        }
        
        // ── PÁGINA FINAL: Relatório de Ações Integradas ──────────────────────
        doc.addPage();
        y = 15;

        // Título da seção
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, y, contentWidth, 10, 'F');
        doc.setTextColor(27, 20, 100);
        doc.text('RELATÓRIO DE AÇÕES INTEGRADAS', pageWidth / 2, y + 7, { align: 'center' });
        doc.setTextColor(0, 0, 0);
        y += 14;

        // Usar o array de atividades filtradas já calculado (atividadesParaRelatorio)
        // Como exportarPDF não recebe atividades diretamente, relemos do estado atual via filterActivities
        const atividadesParaPDF = (() => {
            const dataInI = document.getElementById('dataInicio')?.value;
            const dataFiI = document.getElementById('dataFim')?.value;
            const eqIds = tmsDashEquipe ? tmsDashEquipe.getValue() : [];
            const catIds = tmsDashCategoria ? tmsDashCategoria.getValue() : [];
            const prodIds = tmsDashProduto ? tmsDashProduto.getValue() : [];
            return filterActivities(todasAtividades, {
                dataInicio: dataInI, dataFim: dataFiI,
                equipe: eqIds, categoria: catIds, produto: prodIds
            });
        })();
        const integradasPDF = atividadesParaPDF.filter(isAcaoIntegrada);

        // Cabeçalho com total
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`Total de Atividades Integradas no período: ${integradasPDF.length}`, margin, y);
        y += 8;

        if (integradasPDF.length === 0) {
            doc.setTextColor(150, 150, 150);
            doc.text('Nenhuma ação integrada encontrada no período com o filtro aplicado.', margin, y);
            doc.setTextColor(0, 0, 0);
        } else {
            // Tabela de ações integradas
            const integradasRows = [];
            const sortedInt = [...integradasPDF].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
            sortedInt.forEach(at => {
                const equipes = (at.equipes || []).map(id => equipeMap[id] || id).join(', ');
                const prods = at.produtos || [];
                if (prods.length === 0) {
                    integradasRows.push([at.data || '', equipes, '—', '—', '—']);
                } else {
                    prods.forEach(prod => {
                        const nomeProd = produtoMap[prod.id_produto] || prod.id_produto;
                        const qtd = prod.quantidade != null ? String(prod.quantidade) : '—';
                        const tips = (prod.tipificacoes || []).map(tid => {
                            const t = tipificacoesData.find(x => x.id_tipificacao == tid);
                            return t ? `Art.${t.artigo} – ${t.descricao}` : String(tid);
                        }).join('; ') || '—';
                        integradasRows.push([at.data || '', equipes, nomeProd, qtd, tips]);
                    });
                }
            });

            doc.autoTable({
                startY: y,
                head: [['Data', 'Equipes', 'Produto', 'Qtd', 'Tipificação Penal']],
                body: integradasRows,
                margin: { left: margin, right: margin },
                styles: { overflow: 'linebreak', fontSize: 7, cellPadding: 2 },
                columnStyles: {
                    0: { cellWidth: 22 },
                    1: { cellWidth: 40 },
                    2: { cellWidth: 30 },
                    3: { cellWidth: 10, halign: 'right' },
                    4: { cellWidth: contentWidth - 22 - 40 - 30 - 10 }
                },
                headStyles: {
                    fillColor: [27, 20, 100], textColor: [255, 255, 255],
                    fontSize: 7, fontStyle: 'bold'
                }
            });
            y = doc.lastAutoTable.finalY + 10;

            // Gráfico de tipificações
            const tipCountPDF = {};
            integradasPDF.forEach(at => {
                (at.produtos || []).forEach(prod => {
                    (prod.tipificacoes || []).forEach(tid => {
                        const t = tipificacoesData.find(x => x.id_tipificacao == tid);
                        const label = t ? `Art.${t.artigo} – ${t.descricao}` : String(tid);
                        tipCountPDF[label] = (tipCountPDF[label] || 0) + 1;
                    });
                });
            });

            const tipEntries = Object.entries(tipCountPDF).sort((a, b) => b[1] - a[1]);
            if (tipEntries.length > 0 && document.getElementById('chartTipificacoes')) {
                const chartCanvasTip = document.getElementById('chartTipificacoes');
                const tipImg = chartCanvasTip.toDataURL('image/png', 1.0);
                if (y + 80 > 280) { doc.addPage(); y = 15; }
                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.text('Tipificações Penais por Ocorrência', margin, y);
                y += 5;

                // Tabela lateral + gráfico
                doc.autoTable({
                    startY: y,
                    head: [['Tipificação', 'Qtd']],
                    body: tipEntries.map(([l, v]) => [l, String(v)]),
                    margin: { left: margin, right: margin + 110 },
                    styles: { overflow: 'linebreak', fontSize: 7, cellPadding: 2 },
                    columnStyles: {
                        0: { cellWidth: 65 },
                        1: { cellWidth: 15, halign: 'right' }
                    },
                    headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontSize: 7, fontStyle: 'bold' }
                });
                doc.addImage(tipImg, 'PNG', margin + 90, y - 3, 100, 60);
                y = doc.lastAutoTable.finalY + 8;
            }

            // Gráfico Tipos Penais por % (chartTipPenais)
            const canvasTipPenais = document.getElementById('chartTipPenais');
            if (canvasTipPenais && chartTipPenaisInstance) {
                if (y + 80 > 280) { doc.addPage(); y = 15; }
                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.text('Tipos Penais — Ações Integradas (%)', margin, y);
                y += 5;
                const tipPenaisImg = canvasTipPenais.toDataURL('image/png', 1.0);
                const imgW = contentWidth;
                const imgH = Math.round(imgW * (canvasTipPenais.height / canvasTipPenais.width));
                const safeH = Math.min(imgH, 80);
                doc.addImage(tipPenaisImg, 'PNG', margin, y, imgW, safeH);
                y += safeH + 6;
            }
        }

        doc.save('dashboard_atividades_bdi.pdf');
    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        alert('Erro ao gerar PDF. Verifique o console para mais detalhes.');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Aguardar token estar disponível (importante após redirect do autologin)
    await waitForToken();
    
    checkAuth();
    
    // Verificar se deve abrir direto na lista de atividades (nova aba)
    const abrirAtividades = localStorage.getItem('abrirAtividadesAposCarga');
    
    // Carregar dados de referência em sequência para evitar race conditions
    try {
        await loadEquipes();
        await loadCategorias();
        await loadProdutos();
        await loadTipificacoes();
    } catch (e) {
        console.error('Erro ao carregar dados iniciais:', e);
    }
    
    // Se vai abrir atividades, não precisa carregar dashboard
    if (abrirAtividades === 'true') {
        localStorage.removeItem('abrirAtividadesAposCarga');
        
        // Setup menu navigation antes de clicar
        setupMenuNavigation();
        
        // Abrir lista de atividades direto (mantém o loading visível)
        const menuAtividades = document.getElementById('menuAtividades');
        if (menuAtividades) {
            menuAtividades.click();
        }
        
        // O overlay será escondido pela função showAtividadesCadastradas
        return;
    }
    
    // Verificar se há filtros salvos
    const ultimosFiltros = localStorage.getItem('ultimosFiltrosDashboard');
    let filtrosIniciais;
    
    if (ultimosFiltros) {
        // Restaurar últimos filtros
        filtrosIniciais = JSON.parse(ultimosFiltros);
        
        // Aplicar filtros aos campos
        const dataInicio = document.getElementById('dataInicio');
        const dataFim = document.getElementById('dataFim');
        const equipeSelect = document.getElementById('equipeSelect');
        const categoriaSelect = document.getElementById('categoriaSelect');
        const produtoSelect = document.getElementById('produtoSelect');
        
        if (dataInicio && filtrosIniciais.dataInicio) dataInicio.value = filtrosIniciais.dataInicio;
        if (dataFim && filtrosIniciais.dataFim) dataFim.value = filtrosIniciais.dataFim;
        
        // Selecionar equipes, categorias e produtos
        if (equipeSelect && filtrosIniciais.equipe) {
            Array.from(equipeSelect.options).forEach(opt => {
                opt.selected = filtrosIniciais.equipe.includes(opt.value);
            });
        }
        if (categoriaSelect && filtrosIniciais.categoria) {
            Array.from(categoriaSelect.options).forEach(opt => {
                opt.selected = filtrosIniciais.categoria.includes(opt.value);
            });
        }
        if (produtoSelect && filtrosIniciais.produto) {
            Array.from(produtoSelect.options).forEach(opt => {
                opt.selected = filtrosIniciais.produto.includes(opt.value);
            });
        }
    } else {
        // Primeira vez: definir datas padrão (hoje)
        const now = new Date();
        const today = now.toISOString().slice(0,10);
        const dataInicio = document.getElementById('dataInicio');
        const dataFim = document.getElementById('dataFim');
        if (dataInicio) dataInicio.value = today;
        if (dataFim) dataFim.value = today;
        
        filtrosIniciais = {dataInicio: today, dataFim: today};
    }
    
    // Carregar atividades do dashboard com filtros
    try {
        await loadAtividades(filtrosIniciais);
    } catch (e) {
        console.error('Erro ao carregar atividades:', e);
    }
    
    // Esconder overlay de carregamento inicial
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
    
    // Setup menu navigation
    setupMenuNavigation();
    
    // 🔄 Iniciar sistema de auto-atualização
    startAutoUpdate();
});

// Limpar intervalo quando a página for fechada
window.addEventListener('beforeunload', () => {
    stopAutoUpdate();
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
    // Simplesmente recarregar a página
    // O cache localStorage vai funcionar automaticamente no próximo carregamento
    location.reload();
}

function showInserirAtividade(){
    const main = document.querySelector('.main-content');
    // Data de hoje no formato YYYY-MM-DD
    const hoje = new Date().toISOString().slice(0, 10);
    
    main.innerHTML = `
        <header class="topbar"><h1>Inserir Nova Atividade</h1></header>
        <section class="visual-card" style="max-width:1000px;">
            <form id="formNovaAtividade">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                    <label>Data <input type="date" id="novaData" required style="width:100%;padding:8px;" value="${hoje}"></label>
                    <label>CAI <select id="novaCai" style="width:100%;padding:8px;"><option value="false">Não</option><option value="true">Sim</option></select></label>
                </div>
                <label style="display:block;margin-top:12px;">Descrição<br><textarea id="novaDescricao" rows="3" style="width:100%;padding:8px;"></textarea></label>
                
                <div style="margin-top:16px;">
                    <div id="tmsInserirEquipe"></div>
                </div>
                
                <h3 style="margin-top:24px;margin-bottom:12px;color:var(--taura-blue);">Produtos da Atividade</h3>
                <div id="produtosTabela">
                    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
                        <thead>
                            <tr style="background:#e9ecef;color:#000;">
                                <th style="padding:10px;border:1px solid var(--taura-border);width:28%;font-weight:600;">Produto</th>
                                <th style="padding:10px;border:1px solid var(--taura-border);width:15%;font-weight:600;">Quantidade</th>
                                <th style="padding:10px;border:1px solid var(--taura-border);width:18%;font-weight:600;">Medida / Tipo</th>
                                <th style="padding:10px;border:1px solid var(--taura-border);width:22%;font-weight:600;">Categoria</th>
                                <th style="padding:10px;border:1px solid var(--taura-border);width:33%;font-weight:600;">Tipificação Penal</th>
                                <th style="padding:10px;border:1px solid var(--taura-border);width:10%;font-weight:600;">Ações</th>
                            </tr>
                        </thead>
                        <tbody id="produtosRows"></tbody>
                    </table>
                    <button type="button" id="btnAddProduto" style="padding:8px 16px;background:var(--pbi-accent-blue);color:#fff;border:none;border-radius:4px;cursor:pointer;">+ Adicionar Produto</button>
                </div>
                
                <div style="margin-top:24px;">
                    <button type="submit" style="padding:10px 24px;background:var(--pbi-accent-blue);color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:16px;">Salvar Atividade</button>
                    <button type="button" onclick="cancelarEdicaoAtividade()" style="padding:10px 24px;margin-left:10px;font-size:16px;">Cancelar</button>
                </div>
            </form>
        </section>
    `;
    
    // Inicializar TreeMultiSelect de equipes para inserção
    let tmsInserirEquipe = null;
    const contInserir = document.getElementById('tmsInserirEquipe');
    if (contInserir) {
        const tmsItems = equipesData.length > 0
            ? equipesData.map(e => ({ id: e.id_equipe, label: e.equipe, parentId: e.id_equipe_pai || null }))
            : Object.entries(equipeMap).map(([id, label]) => ({ id: Number(id), label, parentId: null }));
        tmsInserirEquipe = new TreeMultiSelect(contInserir, {
            label: 'Equipes',
            items: tmsItems,
            selected: [],
            placeholder: 'Buscar equipe...'
        });
        contInserir._tmsInstance = tmsInserirEquipe;
    }
    
    // Add first empty row
    addProdutoRow();
    
    // Button to add more rows
    document.getElementById('btnAddProduto').addEventListener('click', addProdutoRow);
    
    // Form submit
    document.getElementById('formNovaAtividade').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // VALIDAÇÃO 1: Data válida
        const dataInput = document.getElementById('novaData').value;
        if (!dataInput) {
            alert('Por favor, informe a data da atividade.');
            return;
        }
        
        // Validar formato e ano razoável (entre 2000 e 2100)
        const dataAtividade = new Date(dataInput);
        const ano = dataAtividade.getFullYear();
        
        if (isNaN(dataAtividade.getTime())) {
            alert('Data inválida! Por favor, informe uma data válida.');
            return;
        }
        
        if (ano < 2000 || ano > 2100) {
            alert(`Ano inválido (${ano})! Por favor, informe uma data entre 2000 e 2100.`);
            return;
        }
        
        // Collect produtos from table rows
        const produtosRows = document.querySelectorAll('#produtosRows tr');
        const produtos = [];
        const categorias = new Set();
        
        produtosRows.forEach(row => {
            const selectProd = row.querySelector('.selectProduto');
            const inputQtd = row.querySelector('.inputQuantidade');
            if (selectProd && selectProd.value && inputQtd) {
                const prodId = parseInt(selectProd.value);
                const produto = produtosData.find(p => p.id_produto_atividade === prodId);
                if (produto) {
                    // Converte vírgula para ponto para valores de moeda
                    let qtdValor = inputQtd.value.replace(',', '.');
                    const quantidade = parseFloat(qtdValor) || 0;
                    
                    // VALIDAÇÃO 2: Quantidade deve ser maior que zero
                    if (quantidade <= 0) {
                        alert(`Produto "${produto.produto_atividade}" tem quantidade inválida (${inputQtd.value})! A quantidade deve ser maior que zero.`);
                        throw new Error('Validação de quantidade falhou');
                    }
                    
                    // Incluir tipificações se existirem (multiselectw)
                    const tipWgt = row._tmsTipificacao;
                    const tipIds = tipWgt ? tipWgt.getValue() : [];

                    const prodObj = { id_produto: prodId, quantidade: quantidade };
                    if (tipIds.length > 0) prodObj.tipificacoes = tipIds;
                    
                    produtos.push(prodObj);
                    categorias.add(produto.id_categoria_atividade);
                }
            }
        });
        
        const atividade = {
            data: dataInput,
            descricao: document.getElementById('novaDescricao').value,
            cai: document.getElementById('novaCai').value === 'true',
            equipes: tmsInserirEquipe ? tmsInserirEquipe.getEffective() : [],
            categorias: Array.from(categorias),
            produtos: produtos
        };
        
        // Verificar se está em modo de edição
        const idEditInput = document.getElementById('id_atividade_edit');
        const isEdit = idEditInput && idEditInput.value;
        const method = isEdit ? 'PUT' : 'POST';
        const url = isEdit ? `${API_BASE}/atividades/${idEditInput.value}` : `${API_BASE}/atividades`;
        
        try {
            const resp = await fetch(url, {
                method: method,
                headers: {'Content-Type':'application/json', 'Authorization': `Bearer ${token}`},
                body: JSON.stringify(atividade)
            });
            if (resp.ok) {
                const atividadeSalva = await resp.json();
                
                // Atualizar cache com a atividade salva/editada
                if (atividadeSalva) {
                    updateCacheItem(atividadeSalva);
                } else {
                    // Se não retornou a atividade, limpar cache para recarregar
                    clearCache();
                }
                
                // Verificar se está editando da lista
                const editingFromList = localStorage.getItem('editingFromList') === 'true';
                
                if (editingFromList) {
                    // FLUXO EDIÇÃO: Atualizar dados salvos e voltar à lista
                    console.log('🔄 Atualizando atividade na lista salva...', atividadeSalva);
                    const dadosSalvos = localStorage.getItem('listaAtividadesDados');
                    if (dadosSalvos) {
                        // Atualizar o item na lista salva
                        const listaAtual = JSON.parse(dadosSalvos);
                        const index = listaAtual.findIndex(a => a.id_atividade === atividadeSalva.id_atividade);
                        console.log(`📍 Índice encontrado: ${index} de ${listaAtual.length} atividades`);
                        
                        if (index !== -1) {
                            console.log('📝 Dados ANTES:', JSON.stringify(listaAtual[index]).substring(0, 100));
                            listaAtual[index] = atividadeSalva;
                            console.log('📝 Dados DEPOIS:', JSON.stringify(listaAtual[index]).substring(0, 100));
                            localStorage.setItem('listaAtividadesDados', JSON.stringify(listaAtual));
                            console.log('✅ Lista atualizada no localStorage');
                        } else {
                            console.warn('⚠️ Atividade não encontrada na lista para atualizar!');
                        }
                    } else {
                        console.warn('⚠️ Nenhum dado salvo encontrado no localStorage');
                    }
                    
                    // Marcar como retornando para acionar restauração
                    localStorage.setItem('editingFromList', 'retornando');
                    alert(`Atividade atualizada com sucesso!`);
                    showAtividadesCadastradas(); // Volta à lista (restaura do cache)
                } else {
                    // FLUXO INSERIR NOVA: Limpar formulário e permanecer na tela
                    alert(`Atividade salva com sucesso!`);
                    
                    // Limpar formulário para nova atividade
                    document.getElementById('formNovaAtividade').reset();
                    document.getElementById('produtosRows').innerHTML = '';
                    
                    // Scroll para o topo
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            } else if (resp.status === 401) {
                alert('Sua sessão expirou. Por favor, faça login novamente.');
                logout();
            } else {
                const err = await resp.json();
                alert('Erro: ' + (err.detail || 'Falha ao salvar'));
            }
        } catch (err) {
            alert('Erro: ' + err.message);
        }
    });
}

function addProdutoRow() {
    const tbody = document.getElementById('produtosRows');
    const row = document.createElement('tr');
    const rowId = Date.now();
    
    row.innerHTML = `
        <td style="padding:8px;border:1px solid var(--taura-border);">
            <input type="text" class="produtoSearch" placeholder="Digite para buscar produto..." 
                style="width:100%;padding:8px;" autocomplete="off" list="produtosList_${rowId}">
            <datalist id="produtosList_${rowId}"></datalist>
            <select class="selectProduto" style="display:none;"></select>
        </td>
        <td style="padding:8px;border:1px solid var(--taura-border);">
            <input type="text" class="inputQuantidade" value="" 
                style="width:100%;padding:8px;" placeholder="" inputmode="decimal">
        </td>
        <td style="padding:8px;border:1px solid var(--taura-border);">
            <input type="text" class="inputMedidaTipo" readonly 
                style="width:100%;padding:8px;background:#e8f4fd;color:#1b1464;font-weight:500;text-align:center;">
        </td>
        <td style="padding:8px;border:1px solid var(--taura-border);">
            <input type="text" class="inputCategoria" readonly 
                style="width:100%;padding:8px;background:#f0f0f0;">
        </td>
        <td class="tdTipificacao" style="padding:8px;border:1px solid var(--taura-border);display:none;min-width:300px;">
            <div class="tmsTipificacaoContainer"></div>
            <div style="font-size:11px;color:#666;margin-top:4px;">
                <button type="button" class="btnNovaTipificacao" style="font-size:11px;padding:2px 6px;background:var(--pbi-accent-blue);color:#fff;border:none;border-radius:3px;cursor:pointer;">+ Nova</button>
            </div>
        </td>
        <td style="padding:8px;border:1px solid var(--taura-border);text-align:center;">
            <button type="button" class="btnRemoveProduto" style="background:#dc3545;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;">✕</button>
        </td>
    `;
    
    tbody.appendChild(row);
    
    const searchInput = row.querySelector('.produtoSearch');
    const datalist = row.querySelector('datalist');
    const hiddenSelect = row.querySelector('.selectProduto');
    const qtdInput = row.querySelector('.inputQuantidade');
    const medidaTipoInput = row.querySelector('.inputMedidaTipo');
    const catInput = row.querySelector('.inputCategoria');
    const tdTipificacao = row.querySelector('.tdTipificacao');
    const tipContainer = row.querySelector('.tmsTipificacaoContainer');
    const btnNovaTipificacao = row.querySelector('.btnNovaTipificacao');

    // multiselectw para tipificações
    const tmsTip = new TreeMultiSelect(tipContainer, {
        placeholder: 'Buscar tipificação...',
        maxChips: 2
    });
    row._tmsTipificacao = tmsTip;
    const btnRemove = row.querySelector('.btnRemoveProduto');

    // IDs de produtos que exigem tipificação penal
    const PRODUTOS_COM_TIPIFICACAO = [18, 19, 20];

    // Popular multiselectw de tipificações
    function popularTipificacoes() {
        const items = tipificacoesData.map(t => ({
            id: t.id_tipificacao,
            label: [`${t.lei || ''}`, `art.${t.artigo}`, t.paragrafo ? `§${t.paragrafo}` : '', t.inciso ? `inc.${t.inciso}` : '', `-`, t.descricao].filter(Boolean).join(' ').trim(),
            parentId: null
        }));
        tmsTip.refresh(items);
    }

    // Carregar tipificações se necessário
    if (tipificacoesData.length === 0) {
        fetchData('/tipificacoes').then(data => {
            tipificacoesData = data;
            popularTipificacoes();
        });
    } else {
        popularTipificacoes();
    }

    // Botão nova tipificação
    if (btnNovaTipificacao) {
        btnNovaTipificacao.addEventListener('click', () => {
            showModalNovaTipificacao((novaTip) => {
                tipificacoesData.push(novaTip);
                popularTipificacoes();
            });
        });
    }
    
    // Armazena tipo do produto selecionado
    let tipoNumeroAtual = null;
    
    // Ordenar produtos alfabeticamente
    const produtosOrdenados = [...produtosData].sort((a, b) => 
        a.produto_atividade.localeCompare(b.produto_atividade, 'pt-BR')
    );
    
    // Populate datalist with all products (ordenados)
    produtosOrdenados.forEach(p => {
        const option = document.createElement('option');
        option.value = p.produto_atividade;
        option.dataset.id = p.id_produto_atividade;
        datalist.appendChild(option);
        
        // Also add to hidden select
        const selOpt = document.createElement('option');
        selOpt.value = p.id_produto_atividade;
        selOpt.text = p.produto_atividade;
        hiddenSelect.appendChild(selOpt);
    });
    
    // Função para atualizar campos ao selecionar produto
    function atualizarCamposProduto(produto) {
        if (produto) {
            hiddenSelect.value = produto.id_produto_atividade;
            catInput.value = categoriaMap[produto.id_categoria_atividade] || '';
            tipoNumeroAtual = produto.tipo_numero;
            
            // Campo informativo medida/tipo_numero
            medidaTipoInput.value = `${produto.medida || ''} (${produto.tipo_numero || ''})`;
            
            // Limpa o valor atual e configura placeholder
            qtdInput.value = '';
            if (produto.tipo_numero === 'moeda') {
                qtdInput.placeholder = '0,00';
            } else if (produto.tipo_numero === 'decimal') {
                qtdInput.placeholder = '0.00';
            } else {
                qtdInput.placeholder = '0';
            }

            // Mostrar/ocultar coluna de tipificação
            if (PRODUTOS_COM_TIPIFICACAO.includes(produto.id_produto_atividade)) {
                tdTipificacao.style.display = '';
            } else {
                tdTipificacao.style.display = 'none';
            }
        } else {
            hiddenSelect.value = '';
            catInput.value = '';
            medidaTipoInput.value = '';
            qtdInput.placeholder = '';
            tipoNumeroAtual = null;
            tdTipificacao.style.display = 'none';
        }
    }
    
    // When user selects a product
    searchInput.addEventListener('change', () => {
        const nome = searchInput.value;
        const produto = produtosData.find(p => p.produto_atividade === nome);
        atualizarCamposProduto(produto);
    });
    
    // Also handle input event for live search
    searchInput.addEventListener('input', () => {
        const nome = searchInput.value;
        const produto = produtosData.find(p => p.produto_atividade === nome);
        if (produto) {
            atualizarCamposProduto(produto);
        }
    });
    
    // Validação do campo quantidade baseado no tipo_numero
    qtdInput.addEventListener('input', (e) => {
        let valor = e.target.value;
        
        if (!tipoNumeroAtual) return;
        
        if (tipoNumeroAtual === 'inteiro') {
            // Apenas números inteiros - remove qualquer coisa que não seja dígito
            valor = valor.replace(/[^0-9]/g, '');
            e.target.value = valor;
        } else if (tipoNumeroAtual === 'decimal') {
            // Aceita números decimais com ponto
            valor = valor.replace(/[^0-9.]/g, '');
            // Permite apenas um ponto
            const parts = valor.split('.');
            if (parts.length > 2) {
                valor = parts[0] + '.' + parts.slice(1).join('');
            }
            e.target.value = valor;
        } else if (tipoNumeroAtual === 'moeda') {
            // Formato moeda com vírgula como separador decimal
            valor = valor.replace(/[^0-9,]/g, '');
            // Permite apenas uma vírgula
            const parts = valor.split(',');
            if (parts.length > 2) {
                valor = parts[0] + ',' + parts.slice(1).join('');
            }
            // Limita a 2 casas decimais após a vírgula
            if (parts.length === 2 && parts[1].length > 2) {
                valor = parts[0] + ',' + parts[1].substring(0, 2);
            }
            e.target.value = valor;
        }
    });
    
    // Formatar ao sair do campo
    qtdInput.addEventListener('blur', () => {
        if (!tipoNumeroAtual || !qtdInput.value) return;
        
        if (tipoNumeroAtual === 'moeda') {
            // Formata como moeda: 0,00
            let valor = qtdInput.value.replace(',', '.');
            let num = parseFloat(valor);
            if (!isNaN(num)) {
                qtdInput.value = num.toFixed(2).replace('.', ',');
            }
        } else if (tipoNumeroAtual === 'decimal') {
            let num = parseFloat(qtdInput.value);
            if (!isNaN(num)) {
                qtdInput.value = num.toString();
            }
        }
    });
    
    // Remove button
    btnRemove.addEventListener('click', () => {
        row.remove();
    });
}

function cancelarEdicaoAtividade() {
    const editingFromList = localStorage.getItem('editingFromList') === 'true';
    
    if (editingFromList) {
        // Estava editando da lista: marcar como retornando e voltar à lista
        localStorage.setItem('editingFromList', 'retornando');
        showAtividadesCadastradas();
    } else {
        // Estava inserindo novo: voltar ao dashboard
        showDashboard();
    }
}

function showAtividadesCadastradas(){
    const main = document.querySelector('.main-content');
    
    // Verificar se está voltando de uma edição
    const voltandoDeEdicao = localStorage.getItem('editingFromList') === 'retornando';
    const filtrosSalvos = localStorage.getItem('listaAtividadesFiltros');
    const dadosSalvos = localStorage.getItem('listaAtividadesDados');
    
    main.innerHTML = `
        <header class="topbar"><h1>Atividades Cadastradas</h1></header>
        
        <section class="filters-row">
            <div class="visual-card filters">
                <label>Data Início <input type="date" id="listaDataInicio"></label>
                <label>Data Fim <input type="date" id="listaDataFim"></label>
                
                <div class="filter-group">
                    <div id="tmsListaEquipe"></div>
                </div>
                
                <div class="filter-group">
                    <div id="tmsListaCategoria"></div>
                </div>
                
                <div class="filter-group">
                    <div id="tmsListaProduto"></div>
                </div>
                
                <label>Consulta Texto <input type="search" id="buscaAtividades" placeholder="Buscar texto..." /></label>
                
                <div class="filter-group" style="justify-content:flex-end">
                    <button id="btnAplicarFiltroLista" style="padding:10px 20px;background:var(--pbi-accent-blue);color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px;">🔍 Aplicar Filtros</button>
                </div>
            </div>
        </section>
        
        <!-- Loader Overlay Centralizado -->
        <div id="loaderLista" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;align-items:center;justify-content:center;">
            <div style="background:#fff;padding:30px 50px;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);text-align:center;">
                <span class="spinner-inline" style="width:50px;height:50px;border-width:5px;"></span>
                <div style="margin-top:20px;font-size:18px;color:#1b1464;font-weight:500;">Carregando atividades...</div>
            </div>
        </div>
        
        <section class="visual-card" style="margin-top:16px;">
            <div id="resultadoInfo" style="margin-bottom:10px;font-size:14px;color:#666;">Configure os filtros e clique em "Aplicar Filtros" para carregar as atividades.</div>
            <table id="tabelaAtividadesLista" style="width:100%;border-collapse:collapse;">
                <thead>
                    <tr style="background:#e9ecef;color:#000;">
                        <th class="sortable" data-col="data" style="padding:10px;border:1px solid var(--taura-border);cursor:pointer;user-select:none;width:90px;">Data <span class="sort-icon">▼</span></th>
                        <th class="sortable" data-col="equipes" style="padding:10px;border:1px solid var(--taura-border);cursor:pointer;user-select:none;width:130px;">Equipe(s) <span class="sort-icon"></span></th>
                        <th class="sortable" data-col="produtos" style="padding:10px;border:1px solid var(--taura-border);cursor:pointer;user-select:none;width:40%;">Produtos - Categoria - Qt - Medida <span class="sort-icon"></span></th>
                        <th class="sortable" data-col="descricao" style="padding:10px;border:1px solid var(--taura-border);cursor:pointer;user-select:none;width:18%;">Descrição <span class="sort-icon"></span></th>
                        <th class="sortable" data-col="cai" style="padding:10px;border:1px solid var(--taura-border);cursor:pointer;user-select:none;width:50px;">CAI <span class="sort-icon"></span></th>
                        <th style="padding:10px;border:1px solid var(--taura-border);width:100px;text-align:center;">Ações</th>
                    </tr>
                </thead>
                <tbody id="tbodyAtividades"></tbody>
            </table>
        </section>
    `;
    
    // Inicializar TreeMultiSelects da lista com dados já carregados em memória
    let tmsListaEquipe = null;
    let tmsListaCategoria = null;
    let tmsListaProduto = null;

    function initTmsLista() {
        const contEquipe = document.getElementById('tmsListaEquipe');
        const contCategoria = document.getElementById('tmsListaCategoria');
        const contProduto = document.getElementById('tmsListaProduto');

        if (contEquipe && equipesData.length > 0) {
            tmsListaEquipe = new TreeMultiSelect(contEquipe, {
                label: 'Equipes',
                items: equipesData.map(e => ({ id: e.id_equipe, label: e.equipe, parentId: e.id_equipe_pai || null })),
                selected: equipesData.map(e => e.id_equipe),
                placeholder: 'Buscar equipe...'
            });
            contEquipe._tmsInstance = tmsListaEquipe;
        }
        if (contCategoria && Object.keys(categoriaMap).length > 0) {
            const cats = Object.entries(categoriaMap).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR', { sensitivity: 'base' }));
            tmsListaCategoria = new TreeMultiSelect(contCategoria, {
                label: 'Categorias',
                items: cats.map(([id, label]) => ({ id: Number(id), label, parentId: null })),
                selected: cats.map(([id]) => Number(id)),
                placeholder: 'Buscar categoria...'
            });
            contCategoria._tmsInstance = tmsListaCategoria;
        }
        if (contProduto && Object.keys(produtoMap).length > 0) {
            const prods = Object.entries(produtoMap).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR', { sensitivity: 'base' }));
            tmsListaProduto = new TreeMultiSelect(contProduto, {
                label: 'Produtos',
                items: prods.map(([id, label]) => ({ id: Number(id), label, parentId: null })),
                selected: prods.map(([id]) => Number(id)),
                placeholder: 'Buscar produto...'
            });
            contProduto._tmsInstance = tmsListaProduto;
        }
    }

    // Se os mapas estiverem vazios, recarregar dados
    async function carregarDadosFiltros() {
        if (Object.keys(equipeMap).length === 0 || Object.keys(categoriaMap).length === 0 || Object.keys(produtoMap).length === 0) {
            try {
                const [equipes, categorias, produtos] = await Promise.all([
                    fetchData('/equipes'), fetchData('/categorias'), fetchData('/produtos')
                ]);
                equipesData = equipes;
                equipes.forEach(e => { equipeMap[e.id_equipe] = e.equipe; equipeInternalMap[e.id_equipe] = !!e.interno_prf; });
                categorias.forEach(c => { categoriaMap[c.id_categoria_atividade] = c.categoria_atividade; });
                produtosData = produtos;
                produtos.forEach(p => { produtoMap[p.id_produto_atividade] = p.produto_atividade; });
            } catch (e) {
                console.error('Erro ao carregar dados dos filtros:', e);
            }
        }
        initTmsLista();
    }
    
    // Set default dates (ano atual)
    const now = new Date();
    const startDate = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
    const endDate = new Date(now.getFullYear(), 11, 31).toISOString().slice(0, 10);
    document.getElementById('listaDataInicio').value = startDate;
    document.getElementById('listaDataFim').value = endDate;
    
    // Função para aplicar filtros
    function aplicarFiltrosLista() {
        const filtros = {
            dataInicio: document.getElementById('listaDataInicio').value,
            dataFim: document.getElementById('listaDataFim').value,
            equipe: tmsListaEquipe ? tmsListaEquipe.getValue().map(String) : [],
            categoria: tmsListaCategoria ? tmsListaCategoria.getValue().map(String) : [],
            produto: tmsListaProduto ? tmsListaProduto.getValue().map(String) : [],
            consultaTexto: document.getElementById('buscaAtividades').value
        };
        loadAtividadesLista(filtros);
    }
    
    // Apply filters button
    document.getElementById('btnAplicarFiltroLista').addEventListener('click', aplicarFiltrosLista);
    
    // Configurar ordenação nos cabeçalhos
    setupSortableHeaders();
    
    // Carregar dados dos filtros
    carregarDadosFiltros().then(() => {
        // Verificar se está voltando de edição com dados salvos
        if (voltandoDeEdicao && filtrosSalvos && dadosSalvos) {
            console.log('🔄 Restaurando lista após edição...');
            
            // Limpar flags
            localStorage.removeItem('editingFromList');
            localStorage.removeItem('listaAtividadesFiltros');
            localStorage.removeItem('listaAtividadesDados');
            
            // Restaurar filtros
            const filtros = JSON.parse(filtrosSalvos);
            if (filtros.dataInicio) document.getElementById('listaDataInicio').value = filtros.dataInicio;
            if (filtros.dataFim) document.getElementById('listaDataFim').value = filtros.dataFim;
            if (filtros.consultaTexto) document.getElementById('buscaAtividades').value = filtros.consultaTexto;
            
            // Selecionar equipes, categorias e produtos via TMS
            if (filtros.equipe && tmsListaEquipe) tmsListaEquipe.setValue(filtros.equipe.map(Number));
            if (filtros.categoria && tmsListaCategoria) tmsListaCategoria.setValue(filtros.categoria.map(Number));
            if (filtros.produto && tmsListaProduto) tmsListaProduto.setValue(filtros.produto.map(Number));
            atividadesListaGlobal = JSON.parse(dadosSalvos);
            
            // Renderizar lista imediatamente (sem fazer nova requisição)
            const resultadoInfo = document.getElementById('resultadoInfo');
            if (resultadoInfo) {
                resultadoInfo.textContent = `${atividadesListaGlobal.length} atividade(s) encontrada(s)`;
            }
            renderAtividadesListaGlobal();
            
            console.log('✅ Lista restaurada com sucesso!');
            return; // Não executar o resto do código
        }
        
        // Verificar se há filtros do dashboard para aplicar automaticamente
        const filtrosDoDashboard = localStorage.getItem('filtrosAtividadesCadastradas');
        if (filtrosDoDashboard) {
            const filtros = JSON.parse(filtrosDoDashboard);
            
            // Aplicar filtros aos campos
            if (filtros.dataInicio) document.getElementById('listaDataInicio').value = filtros.dataInicio;
            if (filtros.dataFim) document.getElementById('listaDataFim').value = filtros.dataFim;
            
            // Selecionar equipes, categorias e produtos via TMS
            if (filtros.equipe && tmsListaEquipe) tmsListaEquipe.setValue(filtros.equipe.map(Number));
            if (filtros.categoria && tmsListaCategoria) tmsListaCategoria.setValue(filtros.categoria.map(Number));
            if (filtros.produto && tmsListaProduto) tmsListaProduto.setValue(filtros.produto.map(Number));
            
            // Limpar flag e aplicar filtros automaticamente
            localStorage.removeItem('filtrosAtividadesCadastradas');
            aplicarFiltrosLista();
        }
    });
}

// Variável global para armazenar atividades da lista (para reordenação)
let atividadesListaGlobal = [];
let sortColumnGlobal = 'data';
let sortDirectionGlobal = 'desc';

async function loadAtividadesLista(filtros = {}){
    const loaderLista = document.getElementById('loaderLista');
    const btnAplicar = document.getElementById('btnAplicarFiltroLista');
    
    // Mostrar spinner
    if (loaderLista) loaderLista.style.display = 'flex';
    if (btnAplicar) btnAplicar.disabled = true;
    
    try {
        let url = '/atividades';
        const params = new URLSearchParams();
        if (filtros.dataInicio) params.append('data_inicio', filtros.dataInicio);
        if (filtros.dataFim) params.append('data_fim', filtros.dataFim);
        (filtros.equipe || []).forEach(v => params.append('id_equipe', v));
        (filtros.categoria || []).forEach(v => params.append('id_categoria', v));
        (filtros.produto || []).forEach(v => params.append('id_produto', v));
        if (filtros.consultaTexto) params.append('consulta', filtros.consultaTexto);
        
        if (params.toString()) url += '?' + params.toString();
        
        const atividades = await fetchData(url);
        const tbody = document.getElementById('tbodyAtividades');
        const resultadoInfo = document.getElementById('resultadoInfo');
        
        if (!tbody) return;
        
        // Armazenar dados globalmente para reordenação
        atividadesListaGlobal = atividades;
        
        // Mostrar quantidade de resultados
        if (resultadoInfo) {
            resultadoInfo.textContent = `${atividades.length} atividade(s) encontrada(s)`;
        }
        
        if (atividades.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding:20px;text-align:center;color:#666;">Nenhuma atividade encontrada com os filtros selecionados.</td></tr>';
            return;
        }
        
        // Renderizar com ordenação atual
        renderAtividadesListaGlobal();
    } catch (err) {
        console.error('Erro ao carregar lista de atividades:', err);
        const tbody = document.getElementById('tbodyAtividades');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding:20px;text-align:center;color:#dc3545;">Erro ao carregar atividades. Verifique a conexão.</td></tr>';
        }
    } finally {
        // Esconder spinner
        const loaderLista = document.getElementById('loaderLista');
        const btnAplicar = document.getElementById('btnAplicarFiltroLista');
        if (loaderLista) loaderLista.style.display = 'none';
        if (btnAplicar) btnAplicar.disabled = false;
        
        // Esconder overlay de carregamento inicial da página (se estiver visível)
        const overlayInicial = document.getElementById('loadingOverlay');
        if (overlayInicial) overlayInicial.style.display = 'none';
    }
}

// Função global para renderizar a tabela de atividades com ordenação
function renderAtividadesListaGlobal() {
    const tbody = document.getElementById('tbodyAtividades');
    if (!tbody || atividadesListaGlobal.length === 0) return;
    
    tbody.innerHTML = '';
    
    // Ordenar dados
    const sorted = [...atividadesListaGlobal].sort((a, b) => {
        let valA, valB;
        switch (sortColumnGlobal) {
            case 'data':
                valA = a.data || '';
                valB = b.data || '';
                break;
            case 'descricao':
                valA = (a.descricao || '').toLowerCase();
                valB = (b.descricao || '').toLowerCase();
                break;
            case 'equipes':
                valA = (a.equipes || []).map(id => equipeMap[id] || id).join(', ').toLowerCase();
                valB = (b.equipes || []).map(id => equipeMap[id] || id).join(', ').toLowerCase();
                break;
            case 'produtos':
                valA = (a.produtos || []).map(p => produtoMap[p.id_produto] || p.id_produto).join(', ').toLowerCase();
                valB = (b.produtos || []).map(p => produtoMap[p.id_produto] || p.id_produto).join(', ').toLowerCase();
                break;
            case 'cai':
                valA = a.cai ? 'sim' : 'não';
                valB = b.cai ? 'sim' : 'não';
                break;
            default:
                valA = '';
                valB = '';
        }
        
        if (valA < valB) return sortDirectionGlobal === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirectionGlobal === 'asc' ? 1 : -1;
        return 0;
    });
    
    // Mapa de produto -> categoria e medida
    const produtoCategoriaMap = {};
    const produtoMedidaMap = {};
    produtosData.forEach(p => {
        produtoCategoriaMap[p.id_produto_atividade] = p.id_categoria_atividade;
        produtoMedidaMap[p.id_produto_atividade] = p.medida || '';
    });
    
    // Função para formatar data AAAA-MM-DD para DD/MM/AAAA
    function formatarData(dataStr) {
        if (!dataStr) return '';
        const partes = dataStr.split('-');
        if (partes.length === 3) {
            return `${partes[2]}/${partes[1]}/${partes[0]}`;
        }
        return dataStr;
    }
    
    sorted.forEach((a, index) => {
        const equipes = (a.equipes || []).map(id => equipeMap[id] || id).join(', ');
        
        // Criar mini-tabela de produtos
        let produtosHtml = '';
        if (a.produtos && a.produtos.length > 0) {
            produtosHtml = '<table style="width:100%;border-collapse:collapse;font-size:12px;">';
            a.produtos.forEach(p => {
                const nomeProduto = produtoMap[p.id_produto] || p.id_produto;
                const catId = produtoCategoriaMap[p.id_produto];
                const nomeCategoria = categoriaMap[catId] || '';
                const medida = produtoMedidaMap[p.id_produto] || '';
                produtosHtml += `<tr style="border-bottom:1px solid #ddd;">
                    <td style="padding:2px 4px;">${nomeProduto}</td>
                    <td style="padding:2px 4px;color:#666;">${nomeCategoria}</td>
                    <td style="padding:2px 4px;text-align:right;">${p.quantidade}</td>
                    <td style="padding:2px 4px;color:#888;font-style:italic;">${medida}</td>
                </tr>`;
            });
            produtosHtml += '</table>';
        }
        
        // Cor alternada: branco e cinza claro
        const bgColor = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
        
        const row = document.createElement('tr');
        row.style.backgroundColor = bgColor;
        row.innerHTML = `
            <td style="padding:8px;border:1px solid var(--taura-border);white-space:nowrap;vertical-align:top;">${formatarData(a.data)}</td>
            <td style="padding:8px;border:1px solid var(--taura-border);vertical-align:top;">${equipes}</td>
            <td style="padding:8px;border:1px solid var(--taura-border);vertical-align:top;">${produtosHtml}</td>
            <td style="padding:8px;border:1px solid var(--taura-border);vertical-align:top;">${a.descricao || ''}</td>
            <td style="padding:8px;border:1px solid var(--taura-border);text-align:center;vertical-align:top;">${a.cai ? 'Sim' : 'Não'}</td>
            <td style="padding:8px;border:1px solid var(--taura-border);text-align:center;vertical-align:top;">
                <button onclick="editarAtividade(${a.id_atividade})" style="padding:4px 8px;background:#ffc107;color:#000;border:none;border-radius:3px;cursor:pointer;font-size:12px;">✏️ Editar</button>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // Atualizar ícones de ordenação
    updateSortIconsGlobal();
}

// Função global para atualizar ícones de ordenação
function updateSortIconsGlobal() {
    document.querySelectorAll('#tabelaAtividadesLista th.sortable').forEach(th => {
        const icon = th.querySelector('.sort-icon');
        if (th.dataset.col === sortColumnGlobal) {
            icon.textContent = sortDirectionGlobal === 'asc' ? '▲' : '▼';
        } else {
            icon.textContent = '';
        }
    });
}

// Função global para configurar ordenação nos cabeçalhos (chamada após criar a tabela)
function setupSortableHeaders() {
    document.querySelectorAll('#tabelaAtividadesLista th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.col;
            if (sortColumnGlobal === col) {
                // Inverter direção
                sortDirectionGlobal = sortDirectionGlobal === 'asc' ? 'desc' : 'asc';
            } else {
                sortColumnGlobal = col;
                sortDirectionGlobal = 'desc'; // Padrão Z-A ao clicar em nova coluna
            }
            renderAtividadesListaGlobal();
        });
    });
}

function showConfiguracao(){
    const main = document.querySelector('.main-content');
    
    // Verificar se é admin para mostrar botão de usuários
    const isAdmin = checkIfAdmin();
    
    main.innerHTML = `
        <header class="topbar"><h1>⚙️ Configuração</h1></header>
        <section class="visual-card">
            <h3>Gerenciamento de Dados</h3>
            <p>Esta seção permite cadastrar equipes, categorias, produtos e usuários.</p>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin-top:20px;">
                <button onclick="showCadastroEquipe()" style="padding:16px 24px;background:var(--pbi-accent-blue);color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:1rem;font-weight:500;">
                    👥 Cadastrar Equipe
                </button>
                <button onclick="showCadastroCategoria()" style="padding:16px 24px;background:var(--pbi-accent-blue);color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:1rem;font-weight:500;">
                    📁 Cadastrar Categoria
                </button>
                <button onclick="showCadastroProduto()" style="padding:16px 24px;background:var(--pbi-accent-blue);color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:1rem;font-weight:500;">
                    📦 Cadastrar Produto
                </button>
                <button onclick="showCadastroTipificacao()" style="padding:16px 24px;background:#6f42c1;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:1rem;font-weight:500;">
                    ⚖️ Tipificações Penais
                </button>
                ${isAdmin ? `
                <button onclick="showCadastroUsuario()" style="padding:16px 24px;background:#28a745;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:1rem;font-weight:500;">
                    👤 Cadastrar Usuário
                </button>
                ` : ''}
            </div>
            <div style="margin-top:30px;">
                <button onclick="showDashboard()" style="padding:10px 20px;background:#6c757d;color:#fff;border:none;border-radius:4px;cursor:pointer;">← Voltar ao Dashboard</button>
            </div>
        </section>
    `;
}

// ── Modal rápido de nova tipificação ─────────────────────────────────────────
function showModalNovaTipificacao(callback) {
    let modal = document.getElementById('modalNovaTipificacao');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'modalNovaTipificacao';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
        <div style="background:#fff;border-radius:8px;padding:28px;width:500px;max-width:95vw;box-shadow:0 4px 24px rgba(0,0,0,0.3);">
            <h3 style="margin-top:0;color:var(--taura-blue);">⚖️ Nova Tipificação Penal</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
                <label>Lei <input id="tipLei" type="text" style="width:100%;padding:8px;margin-top:4px;" placeholder="Ex: CP, Lei 11.343"></label>
                <label>Artigo <input id="tipArtigo" type="text" style="width:100%;padding:8px;margin-top:4px;" placeholder="Ex: 155"></label>
                <label>Parágrafo <input id="tipParagrafo" type="text" style="width:100%;padding:8px;margin-top:4px;" placeholder="opcional"></label>
                <label>Inciso <input id="tipInciso" type="text" style="width:100%;padding:8px;margin-top:4px;" placeholder="opcional"></label>
            </div>
            <label style="display:block;margin-bottom:12px;">Descrição <input id="tipDescricao" type="text" style="width:100%;padding:8px;margin-top:4px;" placeholder="Ex: Furto simples"></label>
            <div style="display:flex;gap:10px;justify-content:flex-end;">
                <button id="btnCancelarTip" type="button" style="padding:8px 18px;border:1px solid #ccc;background:#fff;border-radius:4px;cursor:pointer;">Cancelar</button>
                <button id="btnSalvarTip" type="button" style="padding:8px 18px;background:var(--pbi-accent-blue);color:#fff;border:none;border-radius:4px;cursor:pointer;">Salvar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btnCancelarTip').onclick = () => modal.remove();
    document.getElementById('btnSalvarTip').onclick = async () => {
        const body = {
            lei: document.getElementById('tipLei').value.trim(),
            artigo: document.getElementById('tipArtigo').value.trim(),
            paragrafo: document.getElementById('tipParagrafo').value.trim() || null,
            inciso: document.getElementById('tipInciso').value.trim() || null,
            descricao: document.getElementById('tipDescricao').value.trim()
        };
        if (!body.lei || !body.artigo || !body.descricao) {
            alert('Preencha Lei, Artigo e Descrição.');
            return;
        }
        try {
            const resp = await fetch(`${API_BASE}/tipificacoes`, {
                method: 'POST',
                headers: {'Content-Type':'application/json', 'Authorization': `Bearer ${token}`},
                body: JSON.stringify(body)
            });
            if (!resp.ok) throw new Error('Erro ao salvar');
            const nova = await resp.json();
            modal.remove();
            if (callback) callback(nova);
        } catch (err) {
            alert('Erro ao salvar tipificação: ' + err.message);
        }
    };
}

// ── Tela CRUD de Tipificações Penais ─────────────────────────────────────────
async function showCadastroTipificacao() {
    const main = document.querySelector('.main-content');
    main.innerHTML = `
        <header class="topbar"><h1>⚖️ Tipificações Penais</h1></header>
        <section class="visual-card" style="max-width:1100px;">
            <button onclick="showConfiguracao()" style="padding:8px 16px;background:#6c757d;color:#fff;border:none;border-radius:4px;cursor:pointer;margin-bottom:16px;">← Voltar</button>
            <h3>Cadastrar Nova Tipificação</h3>
            <form id="formTipificacao" style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:20px;">
                <input type="hidden" id="idTipificacaoEdit" value="">
                <label>Lei<br><input type="text" id="tipLeiCad" required style="width:100%;padding:8px;" placeholder="CP, Lei 11.343..."></label>
                <label>Artigo<br><input type="text" id="tipArtigoCad" required style="width:100%;padding:8px;"></label>
                <label>Parágrafo<br><input type="text" id="tipParagrafoCad" style="width:100%;padding:8px;" placeholder="opcional"></label>
                <label>Inciso<br><input type="text" id="tipIncisoCad" style="width:100%;padding:8px;" placeholder="opcional"></label>
                <label style="grid-column:span 3">Descrição<br><input type="text" id="tipDescricaoCad" required style="width:100%;padding:8px;"></label>
                <label style="display:flex;align-items:flex-end;gap:8px;">
                    <button type="submit" style="padding:8px 18px;background:var(--pbi-accent-blue);color:#fff;border:none;border-radius:4px;cursor:pointer;white-space:nowrap;">💾 Salvar</button>
                    <button type="button" id="btnCancelarTipCad" style="padding:8px 12px;border:1px solid #ccc;background:#fff;border-radius:4px;cursor:pointer;display:none;">✕ Cancelar</button>
                </label>
            </form>
            <div id="listaTipificacoes" style="margin-top:16px;">Carregando...</div>
        </section>
    `;

    async function carregarLista() {
        try {
            const data = await fetchData('/tipificacoes');
            tipificacoesData = data;
            const div = document.getElementById('listaTipificacoes');
            if (!div) return;
            if (!data.length) { div.innerHTML = '<p>Nenhuma tipificação cadastrada.</p>'; return; }
            div.innerHTML = `
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <thead><tr style="background:#e9ecef;">
                        <th style="padding:8px;border:1px solid #ccc;">Lei</th>
                        <th style="padding:8px;border:1px solid #ccc;">Artigo</th>
                        <th style="padding:8px;border:1px solid #ccc;">§</th>
                        <th style="padding:8px;border:1px solid #ccc;">Inc.</th>
                        <th style="padding:8px;border:1px solid #ccc;width:40%;">Descrição</th>
                        <th style="padding:8px;border:1px solid #ccc;text-align:center;">Ações</th>
                    </tr></thead>
                    <tbody>
                        ${data.map(t => `<tr>
                            <td style="padding:6px 8px;border:1px solid #ccc;">${t.lei}</td>
                            <td style="padding:6px 8px;border:1px solid #ccc;">${t.artigo}</td>
                            <td style="padding:6px 8px;border:1px solid #ccc;">${t.paragrafo || ''}</td>
                            <td style="padding:6px 8px;border:1px solid #ccc;">${t.inciso || ''}</td>
                            <td style="padding:6px 8px;border:1px solid #ccc;">${t.descricao}</td>
                            <td style="padding:6px 8px;border:1px solid #ccc;text-align:center;">
                                <button onclick="editarTipificacaoCad(${t.id_tipificacao})" style="padding:4px 8px;background:#ffc107;color:#000;border:none;border-radius:3px;cursor:pointer;margin-right:4px;">✏️</button>
                                <button onclick="excluirTipificacaoCad(${t.id_tipificacao})" style="padding:4px 8px;background:#dc3545;color:#fff;border:none;border-radius:3px;cursor:pointer;">🗑️</button>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            `;
        } catch (e) {
            document.getElementById('listaTipificacoes').innerHTML = '<p style="color:red;">Erro ao carregar lista.</p>';
        }
    }

    document.getElementById('formTipificacao').addEventListener('submit', async (e) => {
        e.preventDefault();
        const idEdit = document.getElementById('idTipificacaoEdit').value;
        const body = {
            lei: document.getElementById('tipLeiCad').value.trim(),
            artigo: document.getElementById('tipArtigoCad').value.trim(),
            paragrafo: document.getElementById('tipParagrafoCad').value.trim() || null,
            inciso: document.getElementById('tipIncisoCad').value.trim() || null,
            descricao: document.getElementById('tipDescricaoCad').value.trim()
        };
        if (!body.lei || !body.artigo || !body.descricao) { alert('Preencha Lei, Artigo e Descrição.'); return; }
        const isEdit = !!idEdit;
        const url = isEdit ? `${API_BASE}/tipificacoes/${idEdit}` : `${API_BASE}/tipificacoes`;
        const method = isEdit ? 'PUT' : 'POST';
        try {
            const resp = await fetch(url, {
                method,
                headers: {'Content-Type':'application/json', 'Authorization': `Bearer ${token}`},
                body: JSON.stringify(body)
            });
            if (!resp.ok) throw new Error('Erro ao salvar');
            document.getElementById('formTipificacao').reset();
            document.getElementById('idTipificacaoEdit').value = '';
            document.getElementById('btnCancelarTipCad').style.display = 'none';
            carregarLista();
        } catch (err) {
            alert('Erro: ' + err.message);
        }
    });

    document.getElementById('btnCancelarTipCad').addEventListener('click', () => {
        document.getElementById('formTipificacao').reset();
        document.getElementById('idTipificacaoEdit').value = '';
        document.getElementById('btnCancelarTipCad').style.display = 'none';
    });

    window.editarTipificacaoCad = (id) => {
        const t = tipificacoesData.find(x => x.id_tipificacao === id);
        if (!t) return;
        document.getElementById('idTipificacaoEdit').value = id;
        document.getElementById('tipLeiCad').value = t.lei;
        document.getElementById('tipArtigoCad').value = t.artigo;
        document.getElementById('tipParagrafoCad').value = t.paragrafo || '';
        document.getElementById('tipIncisoCad').value = t.inciso || '';
        document.getElementById('tipDescricaoCad').value = t.descricao;
        document.getElementById('btnCancelarTipCad').style.display = '';
        document.getElementById('tipLeiCad').focus();
    };

    window.excluirTipificacaoCad = async (id) => {
        if (!confirm('Excluir esta tipificação?')) return;
        try {
            const resp = await fetch(`${API_BASE}/tipificacoes/${id}`, {
                method: 'DELETE',
                headers: {'Authorization': `Bearer ${token}`}
            });
            if (!resp.ok) throw new Error('Erro ao excluir');
            carregarLista();
        } catch (err) {
            alert('Erro: ' + err.message);
        }
    };

    carregarLista();
}

function checkIfAdmin() {
    // Verificar se usuário é admin através do token
    try {
        const token = localStorage.getItem('token');
        if (!token) return false;
        
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        
        const payload = JSON.parse(jsonPayload);
        const email = payload.sub;
        
        // Por enquanto, vamos assumir que wanderson1407@gmail.com é admin
        // Em produção, isso seria verificado no backend
        return email === 'wanderson1407@gmail.com';
    } catch {
        return false;
    }
}

function showCadastroEquipe(){
    const main = document.querySelector('.main-content');
    main.innerHTML = `
        <header class="topbar"><h1>👥 Cadastrar Equipe</h1></header>
        <section class="visual-card">
            <form id="formEquipe" style="max-width:600px;">
                <div style="margin-bottom:20px;">
                    <label style="display:block;margin-bottom:8px;font-weight:500;">Nome da Equipe:</label>
                    <input type="text" id="equipe" required style="width:100%;padding:10px;border:1px solid var(--taura-border);border-radius:4px;" placeholder="Ex: BDI Vitória">
                </div>
                
                <div style="margin-bottom:20px;">
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                        <input type="checkbox" id="interno_prf" style="width:18px;height:18px;cursor:pointer;">
                        <span style="font-weight:500;">Equipe interna da PRF</span>
                    </label>
                    <small style="color:#666;display:block;margin-top:4px;margin-left:26px;">Marque se a equipe pertence à PRF</small>
                </div>

                <div style="margin-bottom:20px;">
                    <label style="display:block;margin-bottom:8px;font-weight:500;">Equipe Pai (hierarquia):</label>
                    <select id="id_equipe_pai" style="width:100%;padding:10px;border:1px solid var(--taura-border);border-radius:4px;">
                        <option value="">— Nenhuma (raiz) —</option>
                        ${equipesData.map(e => `<option value="${e.id_equipe}">${e.equipe}</option>`).join('')}
                    </select>
                </div>
                
                <input type="hidden" id="id_equipe_edit" value="">
                <div id="mensagemEquipe" style="margin-bottom:20px;"></div>
                
                <div style="display:flex;gap:12px;">
                    <button type="submit" style="padding:12px 24px;background:var(--pbi-accent-blue);color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:500;">💾 Salvar Equipe</button>
                    <button type="button" onclick="cancelarEdicaoEquipe()" id="btnCancelarEquipe" style="display:none;padding:12px 24px;background:#6c757d;color:#fff;border:none;border-radius:4px;cursor:pointer;">❌ Cancelar</button>
                    <button type="button" onclick="showConfiguracao()" style="padding:12px 24px;background:#6c757d;color:#fff;border:none;border-radius:4px;cursor:pointer;">← Voltar</button>
                </div>
            </form>
        </section>
        
        <section class="visual-card" style="margin-top:20px;">
            <h3>Equipes Cadastradas</h3>
            <div id="listaEquipes" style="margin-top:12px;">Carregando...</div>
        </section>
    `;
    
    document.getElementById('formEquipe').addEventListener('submit', async (e) => {
        e.preventDefault();
        await salvarEquipe();
    });
    
    carregarListaEquipes();
}
function showCadastroCategoria(){
    const main = document.querySelector('.main-content');
    main.innerHTML = `
        <header class="topbar"><h1>📁 Cadastrar Categoria</h1></header>
        <section class="visual-card">
            <form id="formCategoria" style="max-width:600px;">
                <div style="margin-bottom:20px;">
                    <label style="display:block;margin-bottom:8px;font-weight:500;">Nome da Categoria:</label>
                    <input type="text" id="categoria_atividade" required style="width:100%;padding:10px;border:1px solid var(--taura-border);border-radius:4px;" placeholder="Ex: Armas e Munições">
                </div>
                
                <input type="hidden" id="id_categoria_edit" value="">
                <div id="mensagemCategoria" style="margin-bottom:20px;"></div>
                
                <div style="display:flex;gap:12px;">
                    <button type="submit" style="padding:12px 24px;background:var(--pbi-accent-blue);color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:500;">💾 Salvar Categoria</button>
                    <button type="button" onclick="cancelarEdicaoCategoria()" id="btnCancelarCategoria" style="display:none;padding:12px 24px;background:#6c757d;color:#fff;border:none;border-radius:4px;cursor:pointer;">❌ Cancelar</button>
                    <button type="button" onclick="showConfiguracao()" style="padding:12px 24px;background:#6c757d;color:#fff;border:none;border-radius:4px;cursor:pointer;">← Voltar</button>
                </div>
            </form>
        </section>
        
        <section class="visual-card" style="margin-top:20px;">
            <h3>Categorias Cadastradas</h3>
            <div id="listaCategorias" style="margin-top:12px;">Carregando...</div>
        </section>
    `;
    
    document.getElementById('formCategoria').addEventListener('submit', async (e) => {
        e.preventDefault();
        await salvarCategoria();
    });
    
    carregarListaCategorias();
}

function showCadastroProduto(){
    const main = document.querySelector('.main-content');
    
    // Carregar categorias para o select
    let categoriasOptions = '<option value="">Carregando...</option>';
    
    main.innerHTML = `
        <header class="topbar"><h1>📦 Cadastrar Produto</h1></header>
        <section class="visual-card">
            <form id="formProduto" style="max-width:600px;">
                <div style="margin-bottom:20px;">
                    <label style="display:block;margin-bottom:8px;font-weight:500;">Categoria:</label>
                    <select id="id_categoria_atividade" required style="width:100%;padding:10px;border:1px solid var(--taura-border);border-radius:4px;">
                        ${categoriasOptions}
                    </select>
                </div>
                
                <div style="margin-bottom:20px;">
                    <label style="display:block;margin-bottom:8px;font-weight:500;">Nome do Produto:</label>
                    <input type="text" id="produto_atividade" required style="width:100%;padding:10px;border:1px solid var(--taura-border);border-radius:4px;" placeholder="Ex: Pistola apreendida">
                </div>
                
                <div style="margin-bottom:20px;">
                    <label style="display:block;margin-bottom:8px;font-weight:500;">Medida:</label>
                    <input type="text" id="medida" required style="width:100%;padding:10px;border:1px solid var(--taura-border);border-radius:4px;" placeholder="Ex: unidade, kg, litro">
                </div>
                
                <div style="margin-bottom:20px;">
                    <label style="display:block;margin-bottom:8px;font-weight:500;">Tipo de Número:</label>
                    <select id="tipo_numero" required style="width:100%;padding:10px;border:1px solid var(--taura-border);border-radius:4px;">
                        <option value="inteiro">Inteiro (Ex: 1, 2, 3)</option>
                        <option value="decimal">Decimal (Ex: 1.5, 2.75)</option>
                        <option value="moeda">Moeda (Ex: R$ 1.500,00)</option>
                    </select>
                </div>
                
                <input type="hidden" id="id_produto_edit" value="">
                <div id="mensagemProduto" style="margin-bottom:20px;"></div>
                
                <div style="display:flex;gap:12px;">
                    <button type="submit" style="padding:12px 24px;background:var(--pbi-accent-blue);color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:500;">💾 Salvar Produto</button>
                    <button type="button" onclick="cancelarEdicaoProduto()" id="btnCancelarProduto" style="display:none;padding:12px 24px;background:#6c757d;color:#fff;border:none;border-radius:4px;cursor:pointer;">❌ Cancelar</button>
                    <button type="button" onclick="showConfiguracao()" style="padding:12px 24px;background:#6c757d;color:#fff;border:none;border-radius:4px;cursor:pointer;">← Voltar</button>
                </div>
            </form>
        </section>
        
        <section class="visual-card" style="margin-top:20px;">
            <h3>Produtos Cadastrados</h3>
            <div id="listaProdutos" style="margin-top:12px;">Carregando...</div>
        </section>
    `;
    
    // Carregar categorias
    loadCategoriasForSelect();
    
    document.getElementById('formProduto').addEventListener('submit', async (e) => {
        e.preventDefault();
        await salvarProduto();
    });
    
    carregarListaProdutos();
}

function showCadastroUsuario(){
    const main = document.querySelector('.main-content');
    main.innerHTML = `
        <header class="topbar"><h1>👤 Cadastrar Usuário</h1></header>
        <section class="visual-card">
            <form id="formUsuario" style="max-width:600px;">
                <div style="margin-bottom:20px;">
                    <label style="display:block;margin-bottom:8px;font-weight:500;">Email:</label>
                    <input type="email" id="email" required style="width:100%;padding:10px;border:1px solid var(--taura-border);border-radius:4px;" placeholder="Ex: usuario@exemplo.com">
                    <small style="color:#666;display:block;margin-top:4px;">Deve ser um email válido e único</small>
                </div>
                
                <div style="margin-bottom:20px;">
                    <label style="display:block;margin-bottom:8px;font-weight:500;">Nome:</label>
                    <input type="text" id="nome" required style="width:100%;padding:10px;border:1px solid var(--taura-border);border-radius:4px;" placeholder="Ex: João Silva">
                </div>
                
                <div style="margin-bottom:20px;">
                    <label style="display:block;margin-bottom:8px;font-weight:500;">Nível de Acesso:</label>
                    <select id="nivel" required style="width:100%;padding:10px;border:1px solid var(--taura-border);border-radius:4px;">
                        <option value="operador">Operador</option>
                        <option value="administrador">Administrador</option>
                        <option value="inativo">Inativo (sem acesso)</option>
                    </select>
                    <small style="color:#666;display:block;margin-top:4px;">
                        <strong>Operador:</strong> Pode inserir atividades e gerenciar cadastros básicos<br>
                        <strong>Administrador:</strong> Acesso total ao sistema<br>
                        <strong>Inativo:</strong> Usuário sem permissão de acesso
                    </small>
                </div>
                
                <div id="mensagemUsuario" style="margin-bottom:20px;"></div>
                
                <input type="hidden" id="email_edit" value="">
                <div style="display:flex;gap:12px;">
                    <button type="submit" style="padding:12px 24px;background:#28a745;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:500;">💾 Salvar Usuário</button>
                    <button type="button" onclick="cancelarEdicaoUsuario()" id="btnCancelarUsuario" style="display:none;padding:12px 24px;background:#6c757d;color:#fff;border:none;border-radius:4px;cursor:pointer;">✖ Cancelar</button>
                    <button type="button" onclick="showConfiguracao()" style="padding:12px 24px;background:#6c757d;color:#fff;border:none;border-radius:4px;cursor:pointer;">← Voltar</button>
                </div>
            </form>
        </section>
        
        <section class="visual-card" style="margin-top:20px;">
            <h3>Usuários Cadastrados</h3>
            <div id="listaUsuarios" style="margin-top:12px;">Carregando...</div>
        </section>
    `;
    
    document.getElementById('formUsuario').addEventListener('submit', async (e) => {
        e.preventDefault();
        await salvarUsuario();
    });
    
    carregarListaUsuarios();
}

function selectAll(selectId){
    const sel = document.getElementById(selectId);
    for (let i=0;i<sel.options.length;i++){ sel.options[i].selected = true; }
}

function deselectAll(selectId){
    const sel = document.getElementById(selectId);
    for (let i=0;i<sel.options.length;i++){ sel.options[i].selected = false; }
}

// ============================================================
// FUNÇÕES DE CADASTRO
// ============================================================

async function salvarEquipe() {
    refreshToken(); // Atualizar token do localStorage
    const equipe = document.getElementById('equipe').value;
    const interno_prf = document.getElementById('interno_prf').checked;
    const id_edit = document.getElementById('id_equipe_edit').value;
    
    const mensagem = document.getElementById('mensagemEquipe');
    
    if (!equipe.trim()) {
        mensagem.innerHTML = '<div style="padding:12px;background:#f8d7da;color:#721c24;border:1px solid #f5c6cb;border-radius:4px;">❌ Preencha o nome da equipe</div>';
        return;
    }
    
    try {
        const isEdit = id_edit !== '';
        const method = isEdit ? 'PUT' : 'POST';
        const url = isEdit ? `${API_BASE}/equipes/${id_edit}` : `${API_BASE}/equipes`;
        const selPai = document.getElementById('id_equipe_pai');
        const id_equipe_pai = selPai && selPai.value ? parseInt(selPai.value) : null;
        const body = { equipe, interno_prf, id_equipe_pai };
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });
        
        if (response.ok) {
            mensagem.innerHTML = `<div style="padding:12px;background:#d4edda;color:#155724;border:1px solid #c3e6cb;border-radius:4px;">✅ Equipe ${isEdit ? 'atualizada' : 'cadastrada'} com sucesso!</div>`;
            cancelarEdicaoEquipe();
            await loadEquipes();
            carregarListaEquipes();
            // Repintar o select de Equipe Pai com a lista atualizada
            const selPaiEl = document.getElementById('id_equipe_pai');
            if (selPaiEl) {
                const valAtual = selPaiEl.value;
                const sorted = [...equipesData].sort((a, b) =>
                    a.equipe.localeCompare(b.equipe, 'pt-BR', { sensitivity: 'base' }));
                selPaiEl.innerHTML = '<option value="">— Nenhuma (raiz) —</option>' +
                    sorted.map(e => `<option value="${e.id_equipe}"${e.id_equipe == valAtual ? ' selected' : ''}>${e.equipe}</option>`).join('');
            }
        } else if (response.status === 401) {
            alert('Sua sessão expirou. Por favor, faça login novamente.');
            logout();
        } else {
            const error = await response.json();
            mensagem.innerHTML = `<div style="padding:12px;background:#f8d7da;color:#721c24;border:1px solid #f5c6cb;border-radius:4px;">❌ Erro: ${error.detail || 'Não foi possível salvar'}</div>`;
        }
    } catch (error) {
        mensagem.innerHTML = `<div style="padding:12px;background:#f8d7da;color:#721c24;border:1px solid #f5c6cb;border-radius:4px;">❌ Erro: ${error.message}</div>`;
    }
}

async function salvarCategoria() {
    refreshToken(); // Atualizar token do localStorage
    const categoria_atividade = document.getElementById('categoria_atividade').value;
    const id_edit = document.getElementById('id_categoria_edit').value;
    
    const mensagem = document.getElementById('mensagemCategoria');
    
    if (!categoria_atividade.trim()) {
        mensagem.innerHTML = '<div style="padding:12px;background:#f8d7da;color:#721c24;border:1px solid #f5c6cb;border-radius:4px;">❌ Preencha o nome da categoria</div>';
        return;
    }
    
    try {
        const isEdit = id_edit !== '';
        const method = isEdit ? 'PUT' : 'POST';
        const url = isEdit ? `${API_BASE}/categorias/${id_edit}` : `${API_BASE}/categorias`;
        const body = { categoria_atividade };
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });
        
        if (response.ok) {
            mensagem.innerHTML = `<div style="padding:12px;background:#d4edda;color:#155724;border:1px solid #c3e6cb;border-radius:4px;">✅ Categoria ${isEdit ? 'atualizada' : 'cadastrada'} com sucesso!</div>`;
            cancelarEdicaoCategoria();
            await loadCategorias();
            carregarListaCategorias();
        } else if (response.status === 401) {
            alert('Sua sessão expirou. Por favor, faça login novamente.');
            logout();
        } else {
            const error = await response.json();
            mensagem.innerHTML = `<div style="padding:12px;background:#f8d7da;color:#721c24;border:1px solid #f5c6cb;border-radius:4px;">❌ Erro: ${error.detail || 'Não foi possível salvar'}</div>`;
        }
    } catch (error) {
        mensagem.innerHTML = `<div style="padding:12px;background:#f8d7da;color:#721c24;border:1px solid #f5c6cb;border-radius:4px;">❌ Erro: ${error.message}</div>`;
    }
}

async function salvarProduto() {
    refreshToken(); // Atualizar token do localStorage
    const id_categoria_atividade = parseInt(document.getElementById('id_categoria_atividade').value);
    const produto_atividade = document.getElementById('produto_atividade').value;
    const medida = document.getElementById('medida').value;
    const tipo_numero = document.getElementById('tipo_numero').value;
    const id_edit = document.getElementById('id_produto_edit').value;
    
    const mensagem = document.getElementById('mensagemProduto');
    
    if (!produto_atividade.trim() || !id_categoria_atividade || !medida.trim() || !tipo_numero.trim()) {
        mensagem.innerHTML = '<div style="padding:12px;background:#f8d7da;color:#721c24;border:1px solid #f5c6cb;border-radius:4px;">❌ Preencha todos os campos</div>';
        return;
    }
    
    try {
        const isEdit = id_edit !== '';
        const method = isEdit ? 'PUT' : 'POST';
        const url = isEdit ? `${API_BASE}/produtos/${id_edit}` : `${API_BASE}/produtos`;
        const body = { id_categoria_atividade, produto_atividade, medida, tipo_numero };
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });
        
        if (response.ok) {
            mensagem.innerHTML = `<div style="padding:12px;background:#d4edda;color:#155724;border:1px solid #c3e6cb;border-radius:4px;">✅ Produto ${isEdit ? 'atualizado' : 'cadastrado'} com sucesso!</div>`;
            cancelarEdicaoProduto();
            await loadProdutos();
            carregarListaProdutos();
        } else if (response.status === 401) {
            alert('Sua sessão expirou. Por favor, faça login novamente.');
            logout();
        } else {
            const error = await response.json();
            mensagem.innerHTML = `<div style="padding:12px;background:#f8d7da;color:#721c24;border:1px solid #f5c6cb;border-radius:4px;">❌ Erro: ${error.detail || 'Não foi possível salvar'}</div>`;
        }
    } catch (error) {
        mensagem.innerHTML = `<div style="padding:12px;background:#f8d7da;color:#721c24;border:1px solid #f5c6cb;border-radius:4px;">❌ Erro: ${error.message}</div>`;
    }
}

async function salvarUsuario() {
    refreshToken(); // Atualizar token do localStorage
    const email = document.getElementById('email').value;
    const nome = document.getElementById('nome').value;
    const nivel = document.getElementById('nivel').value;
    const email_edit = document.getElementById('email_edit').value;
    
    const mensagem = document.getElementById('mensagemUsuario');
    
    if (!email.trim() || !nome.trim() || !nivel.trim()) {
        mensagem.innerHTML = '<div style="padding:12px;background:#f8d7da;color:#721c24;border:1px solid #f5c6cb;border-radius:4px;">❌ Preencha todos os campos</div>';
        return;
    }
    
    try {
        const isEdit = email_edit !== '';
        const method = isEdit ? 'PUT' : 'POST';
        const url = isEdit ? `${API_BASE}/usuarios/${encodeURIComponent(email_edit)}` : `${API_BASE}/usuarios`;
        const body = { email, nome, nivel };
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });
        
        if (response.ok) {
            mensagem.innerHTML = `<div style="padding:12px;background:#d4edda;color:#155724;border:1px solid #c3e6cb;border-radius:4px;">✅ Usuário ${isEdit ? 'atualizado' : 'cadastrado'} com sucesso!</div>`;
            cancelarEdicaoUsuario();
            carregarListaUsuarios();
        } else if (response.status === 401) {
            alert('Sua sessão expirou. Por favor, faça login novamente.');
            logout();
        } else {
            const error = await response.json();
            mensagem.innerHTML = `<div style="padding:12px;background:#f8d7da;color:#721c24;border:1px solid #f5c6cb;border-radius:4px;">❌ Erro: ${error.detail || 'Não foi possível salvar'}</div>`;
        }
    } catch (error) {
        mensagem.innerHTML = `<div style="padding:12px;background:#f8d7da;color:#721c24;border:1px solid #f5c6cb;border-radius:4px;">❌ Erro: ${error.message}</div>`;
    }
}

async function loadCategoriasForSelect() {
    try {
        const categorias = await fetchData('/categorias');
        const select = document.getElementById('id_categoria_atividade');
        if (select) {
            select.innerHTML = '<option value="">Selecione uma categoria</option>' +
                Object.entries(categoriaMap).map(([id, nome]) => 
                    `<option value="${id}">${nome}</option>`
                ).join('');
        }
    } catch (error) {
        console.error('Erro ao carregar categorias para select:', error);
    }
}

// ============================================================
// REDIMENSIONAMENTO DE COLUNAS DA TABELA
// ============================================================
function makeTableColumnsResizable() {
    const tables = document.querySelectorAll('.table-panel table');
    
    tables.forEach(table => {
        const ths = table.querySelectorAll('th');
        
        ths.forEach((th, index) => {
            // Adicionar elemento resizer se ainda não existir
            if (!th.querySelector('.resizer')) {
                const resizer = document.createElement('div');
                resizer.className = 'resizer';
                th.appendChild(resizer);
                
                let startX, startWidth;
                
                resizer.addEventListener('mousedown', function(e) {
                    startX = e.pageX;
                    startWidth = th.offsetWidth;
                    
                    document.addEventListener('mousemove', resize);
                    document.addEventListener('mouseup', stopResize);
                    
                    e.preventDefault();
                });
                
                function resize(e) {
                    const width = startWidth + (e.pageX - startX);
                    if (width > 50) { // Largura mínima de 50px
                        th.style.width = width + 'px';
                        
                        // Atualizar todas as células da mesma coluna
                        const rows = table.querySelectorAll('tr');
                        rows.forEach(row => {
                            if (row.cells[index]) {
                                row.cells[index].style.width = width + 'px';
                            }
                        });
                    }
                }
                
                function stopResize() {
                    document.removeEventListener('mousemove', resize);
                    document.removeEventListener('mouseup', stopResize);
                }
            }
        });
    });
}

// Chamar após renderizar tabelas
document.addEventListener('DOMContentLoaded', function() {
    // Observer para detectar quando as tabelas são renderizadas
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length > 0) {
                makeTableColumnsResizable();
            }
        });
    });
    
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        observer.observe(mainContent, { childList: true, subtree: true });
    }
});