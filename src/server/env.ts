import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL não configurada."),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET deve ter pelo menos 32 caracteres."),
  NODE_ENV: z.string().optional(),
});

let cached: z.infer<typeof schema> | null = null;

/** Lê e valida as variáveis de ambiente do servidor (nunca expostas ao cliente). */
export function env() {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // Não inclui valores na mensagem, apenas os nomes das variáveis com problema.
    throw new Error(
      `Configuração do servidor inválida: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  }
  cached = parsed.data;
  return cached;
}

export const isProduction = () => process.env["NODE_ENV"] === "production";
