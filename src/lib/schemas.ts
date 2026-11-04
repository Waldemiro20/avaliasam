import { z } from "zod";
import { MAX_INVESTMENT_LIMIT } from "@/lib/investment";

/**
 * Schemas Zod compartilhados: o cliente valida antes de enviar e o servidor
 * valida novamente (a validação do servidor é a que vale).
 */

const text = (label: string, max: number) =>
  z
    .string({ required_error: `${label} é obrigatório.` })
    .trim()
    .min(1, `${label} é obrigatório.`)
    .max(max, `${label} deve ter no máximo ${max} caracteres.`);

export const uuid = z.string().uuid("Identificador inválido.");

/** Verifica se o texto é uma URL absoluta http(s). Bloqueia javascript:, data:, etc. */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

/** Link opcional: vazio vira `null`; caso preenchido, precisa ser http(s). */
export const optionalLink = (label: string) =>
  z
    .string()
    .trim()
    .max(2048, `${label} deve ter no máximo 2048 caracteres.`)
    .nullish()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || isSafeHttpUrl(value), {
      message: `${label}: informe uma URL válida começando com https:// ou http://.`,
    });

export const investmentLimitSchema = z
  .number({ invalid_type_error: "Informe um teto de investimento válido." })
  .int("O teto de investimento deve ser um valor inteiro em reais.")
  .min(0, "O teto de investimento não pode ser negativo.")
  .max(MAX_INVESTMENT_LIMIT, "O teto de investimento é alto demais.");

export const eventInput = z.object({
  name: text("Nome do evento", 120),
  description: text("Descrição do evento", 2000),
  investmentLimit: investmentLimitSchema,
});
export const eventUpdateInput = eventInput.extend({ id: uuid });

export const projectInput = z.object({
  name: text("Nome do projeto", 160),
  members: text("Integrantes da equipe", 1000),
  description: text("Descrição do projeto", 4000),
  prototypeUrl: optionalLink("Link do protótipo"),
  presentationUrl: optionalLink("Link da apresentação"),
});
export const projectCreateInput = projectInput.extend({ eventId: uuid });
export const projectUpdateInput = projectInput.extend({ id: uuid });

export const evaluatorCreateInput = z.object({
  eventId: uuid,
  name: text("Nome do avaliador", 120),
});

export const idInput = z.object({ id: uuid });

export const loginInput = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(254),
  password: z.string().min(1, "Informe a senha.").max(256),
});

/** Tokens de avaliador: 43 caracteres base64url (32 bytes). */
export const evaluatorTokenSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{43}$/, "Link de avaliação inválido.");

export const invitationInput = z.object({ token: evaluatorTokenSchema });
export const evaluatorStartInput = z.object({
  token: evaluatorTokenSchema,
  name: text("Nome", 120),
});

export const submitVotesInput = z.object({
  votes: z
    .array(
      z.object({
        projectId: uuid,
        amount: z
          .number()
          .int("Os valores devem ser inteiros.")
          .min(0, "Valores não podem ser negativos."),
      }),
    )
    .max(500),
});

export type EventInput = z.infer<typeof eventInput>;
export type ProjectInput = z.input<typeof projectInput>;
