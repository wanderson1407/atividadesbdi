/**
 * Módulo de Funções Utilitárias
 * 
 * Funções auxiliares para o sistema
 */

/**
 * Formatar data para padrão brasileiro (DD/MM/AAAA)
 * @param {Date} date - Data a ser formatada
 * @return {string} Data formatada
 */
function formatDateBR(date) {
  if (!date) return '';
  
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  return `${day}/${month}/${year}`;
}

/**
 * Parsear data do formato brasileiro (DD/MM/AAAA) para Date
 * @param {string} dateStr - String da data
 * @return {Date} Objeto Date
 */
function parseDateBR(dateStr) {
  if (!dateStr) return null;
  
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  
  const day = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1;
  const year = parseInt(parts[2]);
  
  return new Date(year, month, day);
}

/**
 * Formatar número como moeda Real
 * @param {number} value - Valor numérico
 * @return {string} Valor formatado
 */
function formatCurrencyBRL(value) {
  if (value === null || value === undefined) return 'R$ 0,00';
  
  return 'R$ ' + value.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Formatar número como moeda Dólar
 * @param {number} value - Valor numérico
 * @return {string} Valor formatado
 */
function formatCurrencyUSD(value) {
  if (value === null || value === undefined) return 'U$ 0.00';
  
  return 'U$ ' + value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Formatar número inteiro com separador de milhares
 * @param {number} value - Valor numérico
 * @return {string} Valor formatado
 */
function formatInteger(value) {
  if (value === null || value === undefined) return '0';
  
  return Math.floor(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Formatar número decimal (2 casas)
 * @param {number} value - Valor numérico
 * @return {string} Valor formatado
 */
function formatDecimal(value) {
  if (value === null || value === undefined) return '0,00';
  
  return value.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Formatar número de acordo com o tipo especificado
 * @param {number} value - Valor numérico
 * @param {string} tipo - Tipo de formatação (inteiro, decimal, real, dolar, outra_moeda)
 * @return {string} Valor formatado
 */
function formatNumber(value, tipo) {
  switch (tipo) {
    case 'inteiro':
      return formatInteger(value);
    case 'decimal':
      return formatDecimal(value);
    case 'real':
      return formatCurrencyBRL(value);
    case 'dolar':
      return formatCurrencyUSD(value);
    case 'outra_moeda':
      return '$ ' + formatDecimal(value);
    default:
      return value.toString();
  }
}

/**
 * Validar email
 * @param {string} email - Email a validar
 * @return {boolean} True se válido
 */
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Gerar ID único baseado em timestamp
 * @return {string} ID único
 */
function generateUniqueId() {
  return new Date().getTime().toString();
}

/**
 * Logging com timestamp
 * @param {string} message - Mensagem a logar
 * @param {string} level - Nível do log (INFO, WARN, ERROR)
 */
function logMessage(message, level) {
  level = level || 'INFO';
  const timestamp = new Date().toISOString();
  Logger.log(`[${timestamp}] [${level}] ${message}`);
}

/**
 * Tratar erro e retornar objeto de resposta padrão
 * @param {Error} error - Objeto de erro
 * @return {Object} Objeto de resposta
 */
function handleError(error) {
  logMessage(error.toString(), 'ERROR');
  return {
    success: false,
    error: error.toString(),
    message: 'Ocorreu um erro. Verifique os logs para mais detalhes.'
  };
}

/**
 * Validar objeto de atividade
 * @param {Object} atividade - Dados da atividade
 * @return {Object} Resultado da validação
 */
function validateAtividade(atividade) {
  const errors = [];
  
  if (!atividade.data) {
    errors.push('Data é obrigatória');
  }
  
  // Adicionar mais validações conforme necessário
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Sanitizar entrada de texto (prevenção XSS)
 * @param {string} text - Texto a sanitizar
 * @return {string} Texto sanitizado
 */
function sanitizeInput(text) {
  if (!text) return '';
  
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}
