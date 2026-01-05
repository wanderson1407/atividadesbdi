/**
 * Módulo de Acesso a Dados (Database)
 * 
 * Gerencia todas as operações de leitura e escrita nas planilhas
 */

/**
 * Obter referência para planilha de atividades
 * @return {Spreadsheet} Objeto Spreadsheet
 */
function getAtividadesSpreadsheet() {
  return SpreadsheetApp.openById(SHEET_ID_ATIVIDADES);
}

/**
 * Obter aba de configuração
 * @return {Sheet} Aba config
 */
function getConfigSheet() {
  const ss = getAtividadesSpreadsheet();
  return ss.getSheetByName('config');
}

/**
 * Obter aba de atividades
 * @return {Sheet} Aba atividade
 */
function getAtividadeSheet() {
  const ss = getAtividadesSpreadsheet();
  return ss.getSheetByName('atividade');
}

// ==================== EQUIPES ====================

/**
 * Obter lista de equipes
 * @return {Array} Array de objetos com dados das equipes
 */
function getEquipes() {
  try {
    const sheet = getConfigSheet();
    const data = sheet.getDataRange().getValues();
    
    const equipes = [];
    // Buscar colunas de equipe (A, B, C: id_equipe, equipe, interno_prf)
    for (let i = 1; i < data.length; i++) {
      if (data[i][1]) { // Se tem nome de equipe
        equipes.push({
          id: data[i][0],
          nome: data[i][1],
          internoPrf: data[i][2] || false
        });
      }
    }
    
    return equipes;
    
  } catch (error) {
    Logger.log('Erro ao obter equipes: ' + error.toString());
    return [];
  }
}

/**
 * Adicionar nova equipe
 * @param {string} nome - Nome da equipe
 * @param {boolean} internoPrf - Se é equipe interna da PRF
 * @return {Object} Resultado da operação
 */
function addEquipe(nome, internoPrf) {
  try {
    const sheet = getConfigSheet();
    const lastRow = sheet.getLastRow();
    
    // Gerar novo ID (último ID + 1)
    const newId = lastRow > 0 ? lastRow : 1;
    
    // Adicionar na planilha (assumindo colunas A, B, C)
    sheet.appendRow([newId, nome, internoPrf]);
    
    return { success: true, message: 'Equipe adicionada com sucesso', id: newId };
    
  } catch (error) {
    Logger.log('Erro ao adicionar equipe: ' + error.toString());
    return { success: false, message: error.toString() };
  }
}

// ==================== CATEGORIAS ====================

/**
 * Obter lista de categorias
 * @return {Array} Array de objetos com dados das categorias
 */
function getCategorias() {
  try {
    const sheet = getConfigSheet();
    const data = sheet.getDataRange().getValues();
    
    const categorias = [];
    // Buscar colunas de categoria (assumindo após equipes)
    // Esta implementação precisa ser ajustada com base no layout real da planilha
    
    return categorias;
    
  } catch (error) {
    Logger.log('Erro ao obter categorias: ' + error.toString());
    return [];
  }
}

/**
 * Adicionar nova categoria
 * @param {string} nome - Nome da categoria
 * @return {Object} Resultado da operação
 */
function addCategoria(nome) {
  try {
    // Implementação a ser ajustada com base no layout da planilha
    return { success: true, message: 'Categoria adicionada com sucesso' };
    
  } catch (error) {
    Logger.log('Erro ao adicionar categoria: ' + error.toString());
    return { success: false, message: error.toString() };
  }
}

// ==================== PRODUTOS ====================

/**
 * Obter lista de produtos
 * @param {number} categoriaId - ID da categoria (opcional, para filtrar)
 * @return {Array} Array de objetos com dados dos produtos
 */
function getProdutos(categoriaId) {
  try {
    const sheet = getConfigSheet();
    const data = sheet.getDataRange().getValues();
    
    const produtos = [];
    // Implementação a ser ajustada com base no layout da planilha
    
    return produtos;
    
  } catch (error) {
    Logger.log('Erro ao obter produtos: ' + error.toString());
    return [];
  }
}

/**
 * Adicionar novo produto
 * @param {Object} produto - Dados do produto
 * @return {Object} Resultado da operação
 */
function addProduto(produto) {
  try {
    // Implementação a ser ajustada com base no layout da planilha
    return { success: true, message: 'Produto adicionado com sucesso' };
    
  } catch (error) {
    Logger.log('Erro ao adicionar produto: ' + error.toString());
    return { success: false, message: error.toString() };
  }
}

// ==================== ATIVIDADES ====================

/**
 * Obter lista de atividades
 * @param {Object} filters - Filtros opcionais
 * @return {Array} Array de objetos com dados das atividades
 */
function getAtividades(filters) {
  try {
    const sheet = getAtividadeSheet();
    const data = sheet.getDataRange().getValues();
    
    const atividades = [];
    // Colunas: id_atividade, data, descricao, cai
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) { // Se tem ID
        atividades.push({
          id: data[i][0],
          data: data[i][1],
          descricao: data[i][2],
          cai: data[i][3] || false
        });
      }
    }
    
    // Aplicar filtros se fornecidos
    if (filters) {
      // Implementar lógica de filtros
    }
    
    return atividades;
    
  } catch (error) {
    Logger.log('Erro ao obter atividades: ' + error.toString());
    return [];
  }
}

/**
 * Adicionar nova atividade
 * @param {Object} atividade - Dados da atividade
 * @return {Object} Resultado da operação
 */
function addAtividade(atividade) {
  try {
    const sheet = getAtividadeSheet();
    const lastRow = sheet.getLastRow();
    
    // Gerar novo ID
    const newId = lastRow > 0 ? lastRow : 1;
    
    // Adicionar na planilha
    sheet.appendRow([
      newId,
      atividade.data,
      atividade.descricao || '',
      atividade.cai || false
    ]);
    
    return { success: true, message: 'Atividade adicionada com sucesso', id: newId };
    
  } catch (error) {
    Logger.log('Erro ao adicionar atividade: ' + error.toString());
    return { success: false, message: error.toString() };
  }
}

/**
 * Atualizar atividade existente
 * @param {number} id - ID da atividade
 * @param {Object} atividade - Novos dados da atividade
 * @return {Object} Resultado da operação
 */
function updateAtividade(id, atividade) {
  try {
    const sheet = getAtividadeSheet();
    const data = sheet.getDataRange().getValues();
    
    // Encontrar linha da atividade
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        sheet.getRange(i + 1, 2, 1, 3).setValues([[
          atividade.data,
          atividade.descricao || '',
          atividade.cai || false
        ]]);
        
        return { success: true, message: 'Atividade atualizada com sucesso' };
      }
    }
    
    return { success: false, message: 'Atividade não encontrada' };
    
  } catch (error) {
    Logger.log('Erro ao atualizar atividade: ' + error.toString());
    return { success: false, message: error.toString() };
  }
}

/**
 * Deletar atividade
 * @param {number} id - ID da atividade
 * @return {Object} Resultado da operação
 */
function deleteAtividade(id) {
  try {
    const sheet = getAtividadeSheet();
    const data = sheet.getDataRange().getValues();
    
    // Encontrar linha da atividade
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        sheet.deleteRow(i + 1);
        return { success: true, message: 'Atividade deletada com sucesso' };
      }
    }
    
    return { success: false, message: 'Atividade não encontrada' };
    
  } catch (error) {
    Logger.log('Erro ao deletar atividade: ' + error.toString());
    return { success: false, message: error.toString() };
  }
}
