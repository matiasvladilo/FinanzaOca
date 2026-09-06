export const ASSISTANT_SCOPE_REPLY = 'Solo respondo consultas sobre datos de FinanzasOca.'

export type AssistantInputClassification = { allowed: true } | { allowed: false }

const SUSPICIOUS_INPUT_PATTERNS = [
  /\b(?:ignora|omite|desobedece|elude)\b(?:\s+\w+){0,7}\s+(?:instrucciones|indicaciones|reglas)\b/,
  /\b(?:ignora|omite|desobedece|elude)\b(?:\s+\w+){0,7}\s+(?:instrucciones|indicaciones|reglas)\b(?:\s+\w+){0,11}\s+(?:prompt|mensaje\s+del\s+sistema|instrucciones\s+del\s+sistema)\b/,
  /\b(?:borra|elimina|destruye)\b(?:\s+\w+){0,7}\s+(?:base\s+de\s+datos|database|bd)\b/,
  /\b(?:drop\s+table|delete\s+from|truncate\s+table|alter\s+table|insert\s+into|update\s+\w+)\b/,
  /\b(?:ejecuta|corre|lanza)\b(?:\s+\w+){0,3}\s+(?:drop\s+table|delete\s+from|truncate\s+table|alter\s+table|insert\s+into|update\s+\w+)\b/,
  /\b(?:omite|salta|elude|evade|bypassea)\b(?:\s+\w+){0,5}\s+(?:autorizaciones?|permisos|controles\s+de\s+acceso)\b/,
  /\b(?:accede|ingresa|entra)\b(?:\s+\w+){0,5}\s+sin\s+(?:autorizacion|permiso)\b/,
  /\b(?:actua|finge|hazte\s+pasar)\s+como\s+(?:un\s+)?(?:administrador(?:\s+del\s+sistema)?|sistema|developer|desarrollador)\b/,
  /\b(?:muestra|muestrame|revela|dame|extrae|comparte)\b(?:\s+\w+){0,7}\s+(?:secretos|credenciales|claves|tokens|contrasenas|passwords)\b/,
] as const

function normalizeInput(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function classifyAssistantInput(input: string): AssistantInputClassification {
  const normalizedInput = normalizeInput(input)

  return SUSPICIOUS_INPUT_PATTERNS.some((pattern) => pattern.test(normalizedInput))
    ? { allowed: false }
    : { allowed: true }
}
