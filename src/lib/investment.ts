/**
 * Regras de investimento compartilhadas entre cliente e servidor.
 * Todos os valores monetários são inteiros em reais.
 */

export const DEFAULT_INVESTMENT_LIMIT = 100_000;
/** Teto máximo aceito para o limite por projeto (proteção contra valores absurdos). */
export const MAX_INVESTMENT_LIMIT = 1_000_000_000;

/** Limita o valor ao intervalo [0, teto do evento]. O teto é sempre obrigatório. */
export const clampAmount = (n: number, limit: number) =>
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

/** Valor compacto para rótulos de botões: 500 → "500", 2500 → "2,5k", 100000 → "100k", 1500000 → "1,5M". */
export function formatCompact(n: number): string {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  if (Math.abs(n) >= 1_000_000) return `${fmt(n / 1_000_000)}M`;
  if (Math.abs(n) >= 1_000) return `${fmt(n / 1_000)}k`;
  return fmt(n);
}

const NICE_STEPS = [10_000, 5_000, 1_000, 500, 100, 50, 10, 5, 1];

/**
 * Passo do slider para o teto do evento: o maior passo "redondo" que divide o teto
 * exatamente (para o slider alcançar o máximo) e ainda gera pelo menos 50 posições
 * (para deslizar suavemente). Ex.: 100.000 → 1.000; 500 → 10; 12.345 → 5.
 */
export function sliderStep(limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return 1;
  return NICE_STEPS.find((step) => limit % step === 0 && limit / step >= 50) ?? 1;
}

/**
 * Incrementos dos atalhos rápidos. Com teto acima de R$ 50 mil, mantém +10k/+20k/+50k;
 * com teto menor, usa 10%, 20% e 50% do teto (arredondados ao passo do slider),
 * para nunca saltar direto ao máximo.
 */
export function quickIncrements(limit: number): number[] {
  if (!Number.isFinite(limit) || limit <= 0) return [];
  if (limit > 50_000) return [10_000, 20_000, 50_000];
  const step = sliderStep(limit);
  const values = [0.1, 0.2, 0.5].map((ratio) =>
    Math.max(step, Math.round((limit * ratio) / step) * step),
  );
  return [...new Set(values)].filter((value) => value > 0 && value < limit);
}
