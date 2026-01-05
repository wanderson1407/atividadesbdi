/**
 * Módulo de Autenticação
 * 
 * Gerencia autenticação e autorização de usuários
 */

/**
 * Verificar se um email está autorizado
 * @param {string} email - Email do usuário
 * @return {boolean} True se autorizado, false caso contrário
 */
function isUserAuthorized(email) {
  try {
    if (!email) {
      return false;
    }
    
    // Abrir planilha de usuários
    const ss = SpreadsheetApp.openById(SHEET_ID_USUARIOS);
    const sheet = ss.getSheets()[0]; // Primeira aba
    
    // Obter lista de emails autorizados (assumindo que estão na coluna A)
    const data = sheet.getDataRange().getValues();
    
    // Pular cabeçalho (primeira linha)
    for (let i = 1; i < data.length; i++) {
      const authorizedEmail = data[i][0]; // Coluna A
      if (authorizedEmail && authorizedEmail.toLowerCase() === email.toLowerCase()) {
        return true;
      }
    }
    
    return false;
    
  } catch (error) {
    Logger.log('Erro ao verificar autorização: ' + error.toString());
    return false;
  }
}

/**
 * Obter lista de todos os usuários autorizados
 * @return {Array} Array com emails autorizados
 */
function getAuthorizedUsers() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID_USUARIOS);
    const sheet = ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();
    
    const users = [];
    // Pular cabeçalho
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        users.push(data[i][0]);
      }
    }
    
    return users;
    
  } catch (error) {
    Logger.log('Erro ao obter usuários: ' + error.toString());
    return [];
  }
}

/**
 * Fazer logout (limpar sessão)
 */
function logout() {
  // No Apps Script, o logout é gerenciado pelo Google
  // Esta função pode ser expandida para limpar dados de sessão personalizados
  return { success: true, message: 'Logout realizado com sucesso' };
}
