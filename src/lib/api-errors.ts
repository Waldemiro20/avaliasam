/** Mensagens de erro públicas compartilhadas entre servidor e cliente. */
export const ERR = {
  unauthenticated: "Sessão expirada ou inválida. Faça login novamente.",
  forbidden: "Você não tem permissão para realizar esta ação.",
  revoked:
    "Este link de avaliação não está mais disponível. Entre em contato com a organização do evento para obter mais informações.",
  rateLimited: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  invalidCredentials: "E-mail ou senha inválidos.",
  notFound: "Registro não encontrado.",
  internal: "Não foi possível concluir a operação. Tente novamente em instantes.",
} as const;

export function errorMessage(error: unknown, fallback: string = ERR.internal): string {
  if (error instanceof Error && error.message) {
    // Erros de validação do Zod chegam serializados como JSON de issues.
    try {
      const issues = JSON.parse(error.message) as Array<{ message?: string }>;
      if (Array.isArray(issues) && issues[0]?.message) return issues[0].message;
    } catch {
      /* não é JSON: mensagem comum */
    }
    return error.message;
  }
  return fallback;
}
