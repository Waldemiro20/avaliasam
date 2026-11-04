import { ERR } from "@/lib/api-errors";

/** Erro cuja mensagem pode ser exibida ao usuário. */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Executa o handler e converte erros inesperados (banco, rede, bugs) em uma
 * mensagem genérica, registrando o detalhe apenas no log do servidor.
 */
export async function safely<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AppError) throw error;
    // Redirecionamentos/notFound do router são objetos especiais e devem passar adiante.
    if (error instanceof Response || (error && typeof error === "object" && "isRedirect" in error))
      throw error;
    console.error("[avaliasam] erro inesperado no servidor", error);
    throw new AppError(ERR.internal);
  }
}
