/**
 * Atividades BDI Serra - Arquivo Principal
 * 
 * Sistema de gerenciamento de atividades usando Google Sheets como banco de dados
 * 
 * @author BDI Serra
 * @version 1.0.0
 */

// IDs das planilhas (CONFIGURAR COM OS IDs REAIS)
const SHEET_ID_ATIVIDADES = '1_D2GrejU61QLvn_Unb6lgMuQh7JoP5Z7KiFelmoKuNE';
const SHEET_ID_USUARIOS = '1IHdIOepObWDrJ8BeY4cKJHWGc-_e9sqR7KGhfpdjVMc';

/**
 * Função principal para servir a aplicação web
 * @param {Object} e - Objeto de evento
 * @return {HtmlOutput} Página HTML renderizada
 */
function doGet(e) {
  try {
    // Verificar se o usuário está autenticado
    const userEmail = Session.getActiveUser().getEmail();
    
    if (!userEmail) {
      return HtmlService.createHtmlOutputFromFile('Login')
        .setTitle('Atividades BDI Serra - Login')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
    
    // Verificar se o usuário está autorizado
    if (!isUserAuthorized(userEmail)) {
      return HtmlService.createHtmlOutput(
        '<h1>Acesso Negado</h1><p>Usuário não autorizado. Entre em contato com o administrador.</p>'
      ).setTitle('Acesso Negado');
    }
    
    // Renderizar página principal
    return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('Atividades BDI Serra')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      
  } catch (error) {
    Logger.log('Erro em doGet: ' + error.toString());
    return HtmlService.createHtmlOutput(
      '<h1>Erro</h1><p>Ocorreu um erro ao carregar a aplicação.</p><p>' + error.toString() + '</p>'
    );
  }
}

/**
 * Função para incluir arquivos HTML (permite modularização)
 * @param {string} filename - Nome do arquivo a incluir
 * @return {string} Conteúdo do arquivo
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Obter informações do usuário atual
 * @return {Object} Objeto com dados do usuário
 */
function getCurrentUser() {
  const userEmail = Session.getActiveUser().getEmail();
  return {
    email: userEmail,
    authorized: isUserAuthorized(userEmail)
  };
}

/**
 * Função de teste para verificar configuração
 * @return {Object} Status da configuração
 */
function testSetup() {
  try {
    const ssAtividades = SpreadsheetApp.openById(SHEET_ID_ATIVIDADES);
    const ssUsuarios = SpreadsheetApp.openById(SHEET_ID_USUARIOS);
    
    return {
      success: true,
      message: 'Configuração OK',
      atividades: ssAtividades.getName(),
      usuarios: ssUsuarios.getName()
    };
  } catch (error) {
    return {
      success: false,
      message: 'Erro na configuração: ' + error.toString()
    };
  }
}
