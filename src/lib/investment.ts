/**
 * Regras de investimento compartilhadas entre cliente e servidor.
 * Todos os valores monetários são inteiros em reais.
 */

export const DEFAULT_INVESTMENT_LIMIT = 100_000;
/** Teto máximo aceito para o limite por projeto (proteção contra valores absurdos). */
export const MAX_INVESTMENT_LIMIT = 1_000_000_000;

export const clampAmount = (n: number, limit = DEFAULT_INVESTMENT_LIMIT) =>
  Math.max(0, Math.min(Math.max(0, limit), Math.round(Number.isFinite(n) ? n : 0)));

export const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Converte o texto digitado no campo "Teto de investimento" em um inteiro (reais).
 * Aceita "1000000", "1.000.000", "R$ 1.000.000" e "1.000.000,00".
 * Retorna `null` para vazio, negativo, centavos diferentes de zero ou formato inválido.
 */
export function parseInvestmentLimit(input: string): number | null {
  let value = input
    .trim()
    .replace(/^R\$\s*/i, "")
    .replace(/\s/g, "");
  if (!value) return null;

  // Parte decimal só é aceita quando for ",00" / ",0".
  const decimal = value.match(/,(\d{1,2})$/);
  if (decimal) {
    if (Number(decimal[1]) !== 0) return null;
    value = value.slice(0, decimal.index);
  }

  if (/^\d{1,3}(?:\.\d{3})+$/.test(value)) value = value.replace(/\./g, "");
  if (!/^\d+$/.test(value)) return null;

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > MAX_INVESTMENT_LIMIT) return null;
  return parsed;
}

export type RankingProject = { id: string; name: string };
export type RankingVote = {
  evaluatorName: string;
  projectId: string;
  amount: number;
  revoked?: boolean;
};

export function computeRanking<P extends RankingProject>(projects: P[], votes: RankingVote[]) {
  return projects
    .map((project) => {
      const breakdown = votes
        .filter((vote) => vote.projectId === project.id && vote.amount > 0)
        .map((vote) => ({
          evaluator: vote.evaluatorName,
          amount: vote.amount,
          revoked: vote.revoked ?? false,
        }))
        .sort((a, b) => b.amount - a.amount);
      return { project, total: breakdown.reduce((sum, item) => sum + item.amount, 0), breakdown };
    })
    .sort((a, b) => b.total - a.total);
}
