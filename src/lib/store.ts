import { useEffect, useState } from "react";
import type { StoredFile } from "./files";

export const MAX_PER_PROJECT = 100_000;
export const ADMIN_EMAIL = "admin123@gmail.com";
export const ADMIN_PASSWORD = "admin123";

export type Project = {
  id: string;
  name: string;
  members: string;
  description: string;
  /** Links antigos (antes do envio de arquivos); mantidos só para exibição. */
  prototypeUrl?: string;
  presentationUrl?: string;
  prototypeFile?: StoredFile | undefined;
  presentationFile?: StoredFile | undefined;
};
export type Competency = {
  id: string;
  name: string;
  /** O que o projeto precisa cumprir nesta competência. */
  description: string;
  /** Valor máximo de investimento (R$) reservado do teto do projeto para esta competência. */
  maxAmount: number;
};
export type Event = {
  id: string;
  name: string;
  description: string;
  investmentLimit: number;
  competencies: Competency[];
  projects: Project[];
};
export type Evaluator = { token: string; name: string; eventId: string };
/** votes[evaluatorToken][projectId] = amount */
export type Votes = Record<string, Record<string, number>>;
export type ProjectScore = {
  /** amounts[competencyId] = valor investido (R$), de 0 até o maxAmount da competência */
  amounts: Record<string, number>;
  /** justifications[competencyId] = justificativa */
  justifications: Record<string, string>;
  /** Parecer consolidado do avaliador sobre o projeto. */
  opinion: string;
};
/** scoreSheets[evaluatorToken][projectId] = valores por competência */
export type ScoreSheets = Record<string, Record<string, ProjectScore>>;

/** Valores monetários são comparados em centavos para evitar erros de ponto flutuante. */
export const toCents = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100);
export const fromCents = (cents: number) => cents / 100;

/** Limita um valor em R$ ao intervalo [0, max], com precisão de centavos. */
export const clampMoney = (n: number, max: number) =>
  fromCents(Math.max(0, Math.min(Math.max(0, toCents(max)), toCents(n))));

/** Divide um valor proporcionalmente aos pesos, em centavos; a sobra dos arredondamentos vai para as primeiras partes. */
export function distributeAmount(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const cents = Math.max(0, toCents(total));
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  const safeWeights = weightSum > 0 ? weights : weights.map(() => 1);
  const safeSum = weightSum > 0 ? weightSum : weights.length;
  const parts = safeWeights.map((w) => Math.floor((cents * w) / safeSum));
  let rest = cents - parts.reduce((sum, part) => sum + part, 0);
  for (let i = 0; rest > 0; i = (i + 1) % parts.length, rest--) parts[i]! += 1;
  return parts.map(fromCents);
}

const DEFAULT_COMPETENCIES = [
  ["Problema e Solução", "Clareza do problema, relevância e aderência da solução proposta."],
  ["Inovação", "Originalidade e diferencial da proposta frente ao que já existe."],
  ["Viabilidade Técnica", "Qualidade do protótipo e capacidade real de execução."],
  ["Modelo de Negócio", "Público-alvo, mercado, fontes de receita e sustentabilidade."],
  ["Apresentação e Equipe", "Comunicação do pitch, domínio do tema e complementaridade do time."],
] as const;

/** 5 competências padrão, dividindo o teto em partes iguais. */
export const defaultCompetencies = (investmentLimit: number): Competency[] => {
  const amounts = distributeAmount(investmentLimit, DEFAULT_COMPETENCIES.map(() => 1));
  return DEFAULT_COMPETENCIES.map(([name, description], index) => ({
    id: crypto.randomUUID(),
    name,
    description,
    maxAmount: amounts[index]!,
  }));
};

/** Soma dos valores máximos das competências (R$). */
export const competencyTotal = (competencies: Competency[]) =>
  fromCents(competencies.reduce((sum, c) => sum + toCents(c.maxAmount), 0));

/** Retorna a mensagem de erro, ou null quando a distribuição fecha exatamente no teto. */
export function validateCompetencies(competencies: Competency[], investmentLimit: number): string | null {
  if (!(toCents(investmentLimit) > 0)) {
    return "Erro ao salvar: informe um Teto de Investimento por Projeto maior que R$ 0,00.";
  }
  if (competencies.length === 0) return "Erro ao salvar: cadastre ao menos uma competência.";
  const unnamed = competencies.findIndex((c) => !c.name.trim());
  if (unnamed >= 0) return `Erro ao salvar: a competência ${unnamed + 1} precisa de um nome.`;
  const empty = competencies.find((c) => !(toCents(c.maxAmount) > 0));
  if (empty) return `Erro ao salvar: a competência "${empty.name.trim()}" precisa ter um valor máximo maior que R$ 0,00.`;
  const total = competencyTotal(competencies);
  if (toCents(total) !== toCents(investmentLimit)) {
    return `Erro ao salvar: A soma dos valores das competências (${formatBRL(total)}) não bate com o Teto de Investimento do Projeto (${formatBRL(investmentLimit)}). Ajuste os valores para continuar.`;
  }
  return null;
}

/** Valor investido pelo avaliador em cada competência (limitado ao máximo dela) e o total do projeto. */
export function evaluateProject(competencies: Competency[], score: Pick<ProjectScore, "amounts"> | undefined) {
  const items = competencies.map((competency) => ({
    competency,
    amount: clampMoney(score?.amounts?.[competency.id] ?? 0, competency.maxAmount),
  }));
  return {
    items,
    amount: fromCents(items.reduce((sum, item) => sum + toCents(item.amount), 0)),
    maxAmount: competencyTotal(competencies),
  };
}

const K = {
  events: "avaliasam.events",
  projects: "avaliasam.projects",
  votes: "avaliasam.votes",
  admin: "avaliasam.admin",
  evaluator: "avaliasam.evaluator",
  evaluatorToken: "avaliasam.evaluatorToken",
  evaluatorEvent: "avaliasam.evaluatorEvent",
  evaluators: "avaliasam.evaluators",
  scores: "avaliasam.scores",
};
const EVT = "avaliasam:change";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(EVT));
}

export const clampAmount = (n: number, limit = MAX_PER_PROJECT) =>
  Math.max(0, Math.min(Math.max(0, limit), Math.round(Number.isFinite(n) ? n : 0)));

export const formatBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function parseInvestmentLimit(input: string): number | null {
  let value = input.trim().replace(/^R\$\s*/, "").replace(/\s/g, "");
  if (!value) return null;

  if (value.includes(",")) {
    if ((value.match(/,/g) ?? []).length > 1) return null;
    value = value.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(value)) {
    value = value.replace(/\./g, "");
  }

  if (/^\d+\.$/.test(value)) value = value.slice(0, -1);
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function createDefaultEvent(): Event {
  const eventId = crypto.randomUUID();
  const projects = read<Project[]>(K.projects, []);
  const legacyVotes = read<Votes>(K.votes, {});
  const legacyEvaluators = read<Array<Partial<Evaluator> & { token: string; name: string }>>(K.evaluators, []);
  const evaluators: Evaluator[] = legacyEvaluators.map((evaluator) => ({
    token: evaluator.token,
    name: evaluator.name,
    eventId: evaluator.eventId ?? eventId,
  }));
  const votes: Votes = {};

  for (const [legacyId, amounts] of Object.entries(legacyVotes)) {
    const existing = evaluators.find((evaluator) => evaluator.token === legacyId || evaluator.name === legacyId);
    if (existing) {
      votes[existing.token] = amounts;
      continue;
    }

    const evaluator = { token: crypto.randomUUID(), name: legacyId, eventId };
    evaluators.push(evaluator);
    votes[evaluator.token] = amounts;
  }

  const event: Event = {
    id: eventId,
    name: "Expotec",
    description: "Evento de avaliação de startups da Escola SAM.",
    investmentLimit: MAX_PER_PROJECT,
    competencies: defaultCompetencies(MAX_PER_PROJECT),
    projects,
  };
  write(K.events, [event]);
  write(K.evaluators, evaluators);
  write(K.votes, votes);
  return event;
}

function getEvents(): Event[] {
  const events = read<Array<Event & { startDate?: string; endDate?: string; status?: string }>>(K.events, []);
  if (events.length > 0) {
    if (events.some(needsCompetencyMigration)) {
      migrateCompetencies(events);
      return getEvents();
    }
  }
  if (events.length > 0) return events.map((event) => {
    const activeEvent = Object.fromEntries(
      Object.entries(event).filter(([key]) => key !== "startDate" && key !== "endDate" && key !== "status"),
    ) as Event;
    return {
      ...activeEvent,
      projects: (activeEvent.projects ?? []).map((project) => ({
        ...project,
        prototypeUrl: project.prototypeUrl ?? "",
        presentationUrl: project.presentationUrl ?? "",
      })),
    };
  });
  if (typeof window !== "undefined" && window.localStorage.getItem(K.events) !== null) return [];
  return [createDefaultEvent()];
}

export function computeRanking(projects: Project[], votes: Votes, evaluatorNames: Record<string, string> = {}) {
  return projects
    .map((p) => {
      const breakdown = Object.entries(votes)
        .map(([evaluator, v]) => ({ evaluator: evaluatorNames[evaluator] ?? evaluator, amount: v[p.id] ?? 0 }))
        .filter((b) => b.amount > 0)
        .sort((a, b) => b.amount - a.amount);
      return { project: p, total: breakdown.reduce((s, b) => s + b.amount, 0), breakdown };
    })
    .sort((a, b) => b.total - a.total);
}

type LegacyCompetency = Partial<Competency> & { maxScore?: number };
type LegacySheet = Partial<ProjectScore> & { scores?: Record<string, number> };

function needsCompetencyMigration(event: { competencies?: LegacyCompetency[] }) {
  return !Array.isArray(event.competencies) || event.competencies.length === 0
    || event.competencies.some((competency) => typeof competency.maxAmount !== "number");
}

/**
 * Eventos antigos não tinham competências, ou as tinham em pontos (maxScore).
 * Converte para valores em R$ que fecham no teto e persiste, para que os ids fiquem estáveis.
 * Notas antigas em pontos viram o valor proporcional em R$.
 */
function migrateCompetencies(events: Array<Omit<Event, "competencies"> & { competencies?: LegacyCompetency[] }>) {
  const converted: Record<string, { maxScore: number; maxAmount: number }> = {};
  const migrated = events.map((event) => {
    if (!needsCompetencyMigration(event)) return event;
    const legacy = event.competencies ?? [];
    if (legacy.length === 0) return { ...event, competencies: defaultCompetencies(event.investmentLimit) };
    const amounts = distributeAmount(event.investmentLimit, legacy.map((c) => Math.max(0, c.maxScore ?? c.maxAmount ?? 0)));
    const competencies: Competency[] = legacy.map((c, index) => {
      const competency = { id: c.id ?? crypto.randomUUID(), name: c.name ?? "", description: c.description ?? "", maxAmount: amounts[index]! };
      if (c.maxScore && c.maxScore > 0) converted[competency.id] = { maxScore: c.maxScore, maxAmount: competency.maxAmount };
      return competency;
    });
    return { ...event, competencies };
  });
  localStorage.setItem(K.events, JSON.stringify(migrated));

  const sheets = read<Record<string, Record<string, LegacySheet>>>(K.scores, {});
  for (const projects of Object.values(sheets)) {
    for (const sheet of Object.values(projects)) {
      if (!sheet.scores) continue;
      sheet.amounts ??= Object.fromEntries(
        Object.entries(sheet.scores)
          .filter(([id]) => converted[id])
          .map(([id, score]) => [id, clampMoney((score / converted[id]!.maxScore) * converted[id]!.maxAmount, converted[id]!.maxAmount)]),
      );
      delete sheet.scores;
    }
  }
  localStorage.setItem(K.scores, JSON.stringify(sheets));
}

function sanitizeSheet(competencies: Competency[], sheet: ProjectScore): ProjectScore {
  return {
    amounts: Object.fromEntries(competencies.map((c) => [c.id, clampMoney(sheet.amounts?.[c.id] ?? 0, c.maxAmount)])),
    justifications: Object.fromEntries(
      competencies
        .map((c) => [c.id, (sheet.justifications?.[c.id] ?? "").trim()] as const)
        .filter(([, text]) => text),
    ),
    opinion: (sheet.opinion ?? "").trim(),
  };
}

/** Recalcula o valor liberado de cada projeto a partir das notas (teto ou pesos podem ter mudado). */
function syncScoredVotes(event: Event, tokens: Set<string>) {
  const sheets = read<ScoreSheets>(K.scores, {});
  const votes = read<Votes>(K.votes, {});
  const projectIds = new Set(event.projects.map((project) => project.id));
  let changed = false;
  for (const token of tokens) {
    const evaluatorSheets = sheets[token];
    if (!evaluatorSheets) continue;
    votes[token] = Object.fromEntries(
      Object.entries(evaluatorSheets)
        .filter(([projectId]) => projectIds.has(projectId))
        .map(([projectId, sheet]) => [projectId, evaluateProject(event.competencies, sheet).amount]),
    );
    changed = true;
  }
  if (changed) write(K.votes, votes);
}

export const store = {
  getEvents,
  createEvent: (name: string, description: string, investmentLimit: number, competencies = defaultCompetencies(investmentLimit)): Event => {
    if (!Number.isFinite(investmentLimit) || investmentLimit < 0) throw new Error("Informe um teto de investimento válido.");
    const competencyError = validateCompetencies(competencies, investmentLimit);
    if (competencyError) throw new Error(competencyError);
    const event: Event = {
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      investmentLimit,
      competencies,
      projects: [],
    };
    write(K.events, [...getEvents(), event]);
    return event;
  },
  saveEvent: (event: Event) => {
    if (!Number.isFinite(event.investmentLimit) || event.investmentLimit < 0) {
      throw new Error("Informe um teto de investimento válido.");
    }
    const competencyError = validateCompetencies(event.competencies, event.investmentLimit);
    if (competencyError) throw new Error(competencyError);
    const updatedEvent = event;
    write(K.events, getEvents().map((item) => item.id === updatedEvent.id ? updatedEvent : item));
    const evaluatorTokens = new Set(read<Evaluator[]>(K.evaluators, [])
      .filter((evaluator) => evaluator.eventId === updatedEvent.id)
      .map((evaluator) => evaluator.token));
    const projectIds = new Set(updatedEvent.projects.map((project) => project.id));
    const votes = read<Votes>(K.votes, {});
    for (const token of evaluatorTokens) {
      if (votes[token]) {
        votes[token] = Object.fromEntries(
          Object.entries(votes[token]!)
            .filter(([projectId]) => projectIds.has(projectId))
            .map(([projectId, amount]) => [projectId, clampAmount(amount, updatedEvent.investmentLimit)]),
        );
      }
    }
    write(K.votes, votes);
    syncScoredVotes(updatedEvent, evaluatorTokens);
  },
  getEvent: (eventId: string) => getEvents().find((event) => event.id === eventId),
  deleteEvent: (eventId: string) => {
    write(K.events, getEvents().filter((event) => event.id !== eventId));
    const evaluators = read<Evaluator[]>(K.evaluators, []);
    const removedTokens = new Set(evaluators.filter((evaluator) => evaluator.eventId === eventId).map((evaluator) => evaluator.token));
    write(K.evaluators, evaluators.filter((evaluator) => evaluator.eventId !== eventId));
    const votes = read<Votes>(K.votes, {});
    const sheets = read<ScoreSheets>(K.scores, {});
    for (const token of removedTokens) {
      delete votes[token];
      delete sheets[token];
    }
    write(K.votes, votes);
    write(K.scores, sheets);
  },
  saveEventProjects: (eventId: string, projects: Project[]) => {
    write(K.events, getEvents().map((event) => event.id === eventId ? { ...event, projects } : event));
    const projectIds = new Set(projects.map((project) => project.id));
    const evaluatorTokens = new Set(read<Evaluator[]>(K.evaluators, [])
      .filter((evaluator) => evaluator.eventId === eventId)
      .map((evaluator) => evaluator.token));
    const votes = read<Votes>(K.votes, {});
    for (const token of evaluatorTokens) {
      if (votes[token]) {
        votes[token] = Object.fromEntries(
          Object.entries(votes[token]!).filter(([projectId]) => projectIds.has(projectId)),
        );
      }
    }
    write(K.votes, votes);
    const sheets = read<ScoreSheets>(K.scores, {});
    for (const token of evaluatorTokens) {
      if (sheets[token]) {
        sheets[token] = Object.fromEntries(
          Object.entries(sheets[token]!).filter(([projectId]) => projectIds.has(projectId)),
        );
      }
    }
    write(K.scores, sheets);
  },
  getVotes: () => read<Votes>(K.votes, {}),
  saveEvaluatorVotes: (evaluatorToken: string, eventId: string, values: Record<string, number>) => {
    const evaluator = store.getEvaluatorByToken(evaluatorToken);
    const event = store.getEvent(eventId);
    if (!evaluator || evaluator.eventId !== eventId || !event) {
      throw new Error("O convite não corresponde a este evento.");
    }
    const projectIds = new Set(event.projects.map((project) => project.id));
    const votes = read<Votes>(K.votes, {});
    votes[evaluatorToken] = Object.fromEntries(
      Object.entries(values)
        .filter(([projectId]) => projectIds.has(projectId))
        .map(([projectId, amount]) => [projectId, clampAmount(amount, event.investmentLimit)]),
    );
    write(K.votes, votes);
  },
  getScoreSheets: () => read<ScoreSheets>(K.scores, {}),
  /** Salva as notas por competência e grava o valor financeiro proporcional em `votes`. */
  saveEvaluatorScores: (evaluatorToken: string, eventId: string, values: Record<string, ProjectScore>) => {
    const evaluator = store.getEvaluatorByToken(evaluatorToken);
    const event = store.getEvent(eventId);
    if (!evaluator || evaluator.eventId !== eventId || !event) {
      throw new Error("O convite não corresponde a este evento.");
    }
    const projectIds = new Set(event.projects.map((project) => project.id));
    const sheets = read<ScoreSheets>(K.scores, {});
    sheets[evaluatorToken] = Object.fromEntries(
      Object.entries(values)
        .filter(([projectId]) => projectIds.has(projectId))
        .map(([projectId, sheet]) => [projectId, sanitizeSheet(event.competencies, sheet)]),
    );
    write(K.scores, sheets);
    syncScoredVotes(event, new Set([evaluatorToken]));
  },
  getEvaluators: () => read<Evaluator[]>(K.evaluators, []),
  createEvaluator: (name: string, eventId: string): Evaluator => {
    if (!getEvents().some((event) => event.id === eventId)) throw new Error("Evento não encontrado.");
    const evaluator = { token: crypto.randomUUID(), name: name.trim(), eventId };
    write(K.evaluators, [...read<Evaluator[]>(K.evaluators, []), evaluator]);
    return evaluator;
  },
  deleteEvaluator: (token: string) => {
    const evaluators = read<Evaluator[]>(K.evaluators, []);
    if (!evaluators.some((evaluator) => evaluator.token === token)) {
      throw new Error("O link do avaliador não foi encontrado ou já foi revogado.");
    }
    write(K.evaluators, evaluators.filter((evaluator) => evaluator.token !== token));
    const votes = read<Votes>(K.votes, {});
    delete votes[token];
    write(K.votes, votes);
    const sheets = read<ScoreSheets>(K.scores, {});
    delete sheets[token];
    write(K.scores, sheets);
    if (read<string>(K.evaluatorToken, "") === token) store.setEvaluator("");
  },
  getEvaluatorByToken: (token: string) => read<Evaluator[]>(K.evaluators, []).find((evaluator) => evaluator.token === token),
  isAdmin: () => read<boolean>(K.admin, false),
  setAdmin: (v: boolean) => write(K.admin, v),
  getEvaluator: () => read<string>(K.evaluator, ""),
  getEvaluatorToken: () => read<string>(K.evaluatorToken, ""),
  getEvaluatorEventId: () => read<string>(K.evaluatorEvent, "") || store.getEvaluatorByToken(read<string>(K.evaluatorToken, ""))?.eventId || "",
  setEvaluator: (name: string, token = "", eventId = "") => {
    write(K.evaluator, name);
    write(K.evaluatorToken, token);
    write(K.evaluatorEvent, eventId);
  },
};

/** Reactive hook over the localStorage store (client only). */
export function useStore() {
  const [, setTick] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
    const f = () => setTick((t) => t + 1);
    window.addEventListener(EVT, f);
    window.addEventListener("storage", f);
    return () => {
      window.removeEventListener(EVT, f);
      window.removeEventListener("storage", f);
    };
  }, []);
  return {
    ready,
    events: ready ? getEvents() : [],
    votes: ready ? store.getVotes() : {},
    scoreSheets: ready ? store.getScoreSheets() : {},
    isAdmin: ready && store.isAdmin(),
    evaluator: ready ? store.getEvaluator() : "",
    evaluatorToken: ready ? store.getEvaluatorToken() : "",
    evaluatorEventId: ready ? store.getEvaluatorEventId() : "",
    evaluators: ready ? store.getEvaluators() : [],
  };
}
