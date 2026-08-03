/**
 * MÓDULO DE SEGURANÇA - BLINDAGEM CONTRA ATAQUES
 * Proteção contra: spam, loops, disparo em massa, injeção de código
 */

// ============================================
// CONFIGURAÇÕES DE RATE LIMITING
// ============================================

const RATE_LIMITS = {
  // Máximo de requisições por IP em janelas de tempo
  webhook: { max: 10, windowMs: 60000 }, // 10 req/min
  auth: { max: 5, windowMs: 60000 }, // 5 req/min
  games: { max: 30, windowMs: 60000 }, // 30 req/min
  default: { max: 100, windowMs: 60000 }, // 100 req/min (para requisições normais)
};

// Armazenamento em memória (em produção usar Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Verifica rate limiting por IP
 */
export function checkRateLimit(
  identifier: string,
  type: keyof typeof RATE_LIMITS,
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const limit = RATE_LIMITS[type];
  const key = `${type}:${identifier}`;

  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    // Nova janela de tempo
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + limit.windowMs,
    });
    return { allowed: true, remaining: limit.max - 1, resetTime: now + limit.windowMs };
  }

  if (record.count >= limit.max) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }

  record.count++;
  return { allowed: true, remaining: limit.max - record.count, resetTime: record.resetTime };
}

// ============================================
// SANITIZAÇÃO DE INPUTS
// ============================================

/**
 * Sanitiza string removendo caracteres perigosos
 */
export function sanitizeString(input: string, maxLength = 1000): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>\"'&]/g, '') // Remove caracteres perigosos
    .replace(/\s+/g, ' ') // Normaliza espaços
    .trim()
    .substring(0, maxLength);
}

/**
 * Sanitiza telefone (apenas números)
 */
export function sanitizePhone(input: string): string {
  if (typeof input !== 'string') return '';
  const sanitized = input.replace(/[^0-9]/g, '');
  // Valida tamanho (10-15 dígitos)
  if (sanitized.length < 10 || sanitized.length > 15) return '';
  return sanitized;
}

/**
 * Sanitiza ID (apenas alfanumérico, underscore e hífen)
 */
export function sanitizeId(input: string, maxLength = 100): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, maxLength);
}

/**
 * Sanitiza código (apenas alfanumérico e hífen)
 */
export function sanitizeCode(input: string, maxLength = 50): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[^a-zA-Z0-9-]/g, '').substring(0, maxLength);
}

// ============================================
// VALIDAÇÃO DE PAYLOAD
// ============================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: unknown;
}

/**
 * Valida payload de pedido
 */
export function validateOrderPayload(payload: unknown): ValidationResult {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Payload inválido' };
  }

  const data = payload as Record<string, unknown>;

  // Campos obrigatórios
  const required = ['cliente', 'telefone', 'endereco', 'total', 'itens', 'tipo_entrega', 'origem', 'comanda', 'evento', 'timestamp', 'pagamento'];
  for (const field of required) {
    if (!data[field]) {
      return { valid: false, error: `Campo obrigatório ausente: ${field}` };
    }
  }

  // Validar origem
  if (data.origem !== 'CIDADELA_PWA') {
    return { valid: false, error: 'Origem inválida' };
  }

  // Validar telefone
  const phone = sanitizePhone(data.telefone as string);
  if (!phone) {
    return { valid: false, error: 'Telefone inválido' };
  }

  // Validar total
  const total = Number(data.total);
  if (isNaN(total) || total < 0 || total > 100000) {
    return { valid: false, error: 'Total inválido' };
  }

  // Validar itens
  if (!Array.isArray(data.itens) || data.itens.length === 0 || data.itens.length > 50) {
    return { valid: false, error: 'Lista de itens inválida' };
  }

  // Validar cada item
  for (const item of data.itens) {
    if (!item || typeof item !== 'object') {
      return { valid: false, error: 'Item inválido' };
    }
    const itemData = item as Record<string, unknown>;
    if (!itemData.name || !itemData.quantity || !itemData.total) {
      return { valid: false, error: 'Item incompleto' };
    }
    const qty = Number(itemData.quantity);
    if (isNaN(qty) || qty < 1 || qty > 100) {
      return { valid: false, error: 'Quantidade inválida' };
    }
    const itemTotal = Number(itemData.total);
    if (isNaN(itemTotal) || itemTotal < 0 || itemTotal > 10000) {
      return { valid: false, error: 'Valor do item inválido' };
    }
  }

  // Validar timestamp
  const timestamp = new Date(data.timestamp as string);
  const now = new Date();
  const diffMinutes = (now.getTime() - timestamp.getTime()) / 60000;
  if (Math.abs(diffMinutes) > 60) {
    return { valid: false, error: 'Timestamp inválido' };
  }

  // Validar método de pagamento
  const validPayments = ['pix', 'dinheiro', 'cartao'];
  if (!validPayments.includes(data.pagamento as string)) {
    return { valid: false, error: 'Método de pagamento inválido' };
  }

  // Retornar payload sanitizado
  return {
    valid: true,
    sanitized: {
      ...data,
      cliente: sanitizeString(data.cliente as string, 100),
      telefone: phone,
      endereco: sanitizeString(data.endereco as string, 200),
      total,
      itens: data.itens.map((item: unknown) => {
        const i = item as Record<string, unknown>;
        return {
          ...i,
          name: sanitizeString(i.name as string, 100),
          quantity: Number(i.quantity),
          total: Number(i.total),
          observacoes: i.observacoes ? sanitizeString(i.observacoes as string, 200) : undefined,
        };
      }),
    },
  };
}

/**
 * Valida payload de autenticação
 */
export function validateAuthPayload(payload: unknown): ValidationResult {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Payload inválido' };
  }

  const data = payload as Record<string, unknown>;

  if (!data.codigo || typeof data.codigo !== 'string') {
    return { valid: false, error: 'Código ausente ou inválido' };
  }

  const code = sanitizeCode(data.codigo as string);
  if (code.length < 5) {
    return { valid: false, error: 'Código inválido' };
  }

  if (data.origem !== 'CIDADELA_PWA') {
    return { valid: false, error: 'Origem inválida' };
  }

  return { valid: true, sanitized: { ...data, codigo: code } };
}

/**
 * Valida payload de jogos
 */
export function validateGamesPayload(payload: unknown, type: 'session' | 'move'): ValidationResult {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Payload inválido' };
  }

  const data = payload as Record<string, unknown>;

  if (type === 'session') {
    if (!data.acao || !data.game_type) {
      return { valid: false, error: 'Campos obrigatórios ausentes' };
    }

    const validActions = ['criar', 'entrar', 'atualizar', 'completar'];
    if (!validActions.includes(data.acao as string)) {
      return { valid: false, error: 'Ação inválida' };
    }

    const validGameTypes = ['battle', 'trilha', 'iq_test'];
    if (!validGameTypes.includes(data.game_type as string)) {
      return { valid: false, error: 'Tipo de jogo inválido' };
    }

    return { valid: true, sanitized: data };
  }

  if (type === 'move') {
    if (!data.session_id || !data.player_id || !data.move_type) {
      return { valid: false, error: 'Campos obrigatórios ausentes' };
    }

    const sessionId = sanitizeId(data.session_id as string);
    if (sessionId.length < 5) {
      return { valid: false, error: 'Session ID inválido' };
    }

    const playerId = sanitizeId(data.player_id as string);
    if (playerId.length < 5) {
      return { valid: false, error: 'Player ID inválido' };
    }

    if (data.player_number && data.player_number !== 1 && data.player_number !== 2) {
      return { valid: false, error: 'Player number inválido' };
    }

    const roundNumber = Number(data.round_number) || 1;
    if (roundNumber < 1 || roundNumber > 1000) {
      return { valid: false, error: 'Round number inválido' };
    }

    return { valid: true, sanitized: { ...data, session_id: sessionId, player_id: playerId } };
  }

  return { valid: false, error: 'Tipo inválido' };
}

/**
 * Valida payload de admin trial
 */
export function validateAdminTrialPayload(payload: unknown): ValidationResult {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Payload inválido' };
  }

  const data = payload as Record<string, unknown>;

  if (data.acao !== 'criar_trial' || !data.store_name || !data.admin_phone) {
    return { valid: false, error: 'Campos obrigatórios ausentes' };
  }

  const storeName = sanitizeString(data.store_name as string, 100);
  if (storeName.length < 2) {
    return { valid: false, error: 'Nome da loja inválido' };
  }

  const phone = sanitizePhone(data.admin_phone as string);
  if (!phone) {
    return { valid: false, error: 'Telefone inválido' };
  }

  return { valid: true, sanitized: { ...data, store_name: storeName, admin_phone: phone } };
}

// ============================================
// PROTEÇÃO CONTRA LOOPS
// ============================================

const operationTracker = new Map<string, { count: number; lastOperation: number }>();

/**
 * Detecta loops em operações repetidas
 */
export function detectLoop(identifier: string, operation: string, maxOps = 10, windowMs = 5000): boolean {
  const now = Date.now();
  const key = `${identifier}:${operation}`;
  const record = operationTracker.get(key);

  if (!record || now - record.lastOperation > windowMs) {
    operationTracker.set(key, { count: 1, lastOperation: now });
    return false;
  }

  record.count++;
  record.lastOperation = now;

  if (record.count > maxOps) {
    return true; // Loop detectado
  }

  return false;
}

// ============================================
// PROTEÇÃO CONTRA DISPARO EM MASSA
// ============================================

const massOperationTracker = new Map<string, { operations: number[] }>();

/**
 * Detecta disparo em massa de operações
 */
export function detectMassOperation(identifier: string, maxOps = 100, windowMs = 60000): boolean {
  const now = Date.now();
  const record = massOperationTracker.get(identifier);

  if (!record) {
    massOperationTracker.set(identifier, { operations: [now] });
    return false;
  }

  // Remover operações antigas fora da janela
  record.operations = record.operations.filter((time) => now - time < windowMs);
  record.operations.push(now);

  if (record.operations.length > maxOps) {
    return true; // Disparo em massa detectado
  }

  return false;
}

// ============================================
// LIMPEZA DE TRACKERS (para evitar memory leak)
// ============================================

setInterval(() => {
  const now = Date.now();

  // Limpar rate limit store
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }

  // Limpar operation tracker
  for (const [key, record] of operationTracker.entries()) {
    if (now - record.lastOperation > 60000) {
      operationTracker.delete(key);
    }
  }

  // Limpar mass operation tracker
  for (const [key, record] of massOperationTracker.entries()) {
    record.operations = record.operations.filter((time) => now - time < 60000);
    if (record.operations.length === 0) {
      massOperationTracker.delete(key);
    }
  }
}, 60000); // Limpar a cada minuto
