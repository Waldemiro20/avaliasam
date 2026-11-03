import { useEffect, useState } from "react";

export const MAX_PER_PROJECT = 100_000;
export const ADMIN_EMAIL = "admin123@gmail.com";
export const ADMIN_PASSWORD = "admin123";

export type Project = { id: string; name: string; members: string; description: string };
export type EventStatus = "active" | "upcoming" | "expired" | "unconfigured";
export type Event = {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: EventStatus;
  investmentLimit: number;
  projects: Project[];
};
export type Evaluator = { token: string; name: string; eventId: string };
/** votes[evaluatorToken][projectId] = amount */
export type Votes = Record<string, Record<string, number>>;

const K = {
  events: "avaliasam.events",
  projects: "avaliasam.projects",
  votes: "avaliasam.votes",
  admin: "avaliasam.admin",
  evaluator: "avaliasam.evaluator",
  evaluatorToken: "avaliasam.evaluatorToken",
  evaluatorEvent: "avaliasam.evaluatorEvent",
  evaluators: "avaliasam.evaluators",
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

export function getEventStatus(event: Pick<Event, "startDate" | "endDate">, now = new Date()): EventStatus {
  if (!event.startDate || !event.endDate || event.startDate > event.endDate) return "unconfigured";
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (today < event.startDate) return "upcoming";
  if (today > event.endDate) return "expired";
  return "active";
}

function withCurrentStatus(event: Omit<Event, "status"> | Event): Event {
  return { ...event, status: getEventStatus(event) };
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

  const event = withCurrentStatus({
    id: eventId,
    name: "Expotec",
    description: "Evento de avaliação de startups da Escola SAM.",
    startDate: "",
    endDate: "",
    investmentLimit: MAX_PER_PROJECT,
    projects,
  });
  write(K.events, [event]);
  write(K.evaluators, evaluators);
  write(K.votes, votes);
  return event;
}

function getEvents(): Event[] {
  const events = read<Event[]>(K.events, []);
  if (events.length > 0) return events.map((event) => withCurrentStatus({
    ...event,
    startDate: event.startDate ?? "",
    endDate: event.endDate ?? "",
  }));
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

export const store = {
  getEvents,
  createEvent: (name: string, description: string, startDate: string, endDate: string, investmentLimit: number): Event => {
    if (!startDate || !endDate || startDate > endDate) throw new Error("Informe datas válidas para o evento.");
    if (!Number.isFinite(investmentLimit) || investmentLimit < 0) throw new Error("Informe um teto de investimento válido.");
    const event = withCurrentStatus({
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      startDate,
      endDate,
      investmentLimit,
      projects: [],
    });
    write(K.events, [...getEvents(), event]);
    return event;
  },
  saveEvent: (event: Omit<Event, "status"> | Event) => {
    if (!event.startDate || !event.endDate || event.startDate > event.endDate) {
      throw new Error("Informe datas válidas para o evento.");
    }
    if (!Number.isFinite(event.investmentLimit) || event.investmentLimit < 0) {
      throw new Error("Informe um teto de investimento válido.");
    }
    const updatedEvent = withCurrentStatus(event);
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
  },
  getEvent: (eventId: string) => getEvents().find((event) => event.id === eventId),
  deleteEvent: (eventId: string) => {
    write(K.events, getEvents().filter((event) => event.id !== eventId));
    const evaluators = read<Evaluator[]>(K.evaluators, []);
    const removedTokens = new Set(evaluators.filter((evaluator) => evaluator.eventId === eventId).map((evaluator) => evaluator.token));
    write(K.evaluators, evaluators.filter((evaluator) => evaluator.eventId !== eventId));
    const votes = read<Votes>(K.votes, {});
    for (const token of removedTokens) delete votes[token];
    write(K.votes, votes);
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
  },
  getVotes: () => read<Votes>(K.votes, {}),
  saveEvaluatorVotes: (evaluatorToken: string, eventId: string, values: Record<string, number>) => {
    const evaluator = store.getEvaluatorByToken(evaluatorToken);
    const event = store.getEvent(eventId);
    if (!evaluator || evaluator.eventId !== eventId || !event) {
      throw new Error("O convite não corresponde a este evento.");
    }
    if (getEventStatus(event) !== "active") {
      throw new Error("As avaliações deste evento estão encerradas ou ainda não começaram.");
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
  getEvaluators: () => read<Evaluator[]>(K.evaluators, []),
  createEvaluator: (name: string, eventId: string): Evaluator => {
    if (!getEvents().some((event) => event.id === eventId)) throw new Error("Evento não encontrado.");
    const evaluator = { token: crypto.randomUUID(), name: name.trim(), eventId };
    write(K.evaluators, [...read<Evaluator[]>(K.evaluators, []), evaluator]);
    return evaluator;
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
    const statusRefresh = window.setInterval(f, 60_000);
    return () => {
      window.removeEventListener(EVT, f);
      window.removeEventListener("storage", f);
      window.clearInterval(statusRefresh);
    };
  }, []);
  return {
    ready,
    events: ready ? getEvents() : [],
    votes: ready ? store.getVotes() : {},
    isAdmin: ready && store.isAdmin(),
    evaluator: ready ? store.getEvaluator() : "",
    evaluatorToken: ready ? store.getEvaluatorToken() : "",
    evaluatorEventId: ready ? store.getEvaluatorEventId() : "",
    evaluators: ready ? store.getEvaluators() : [],
  };
}
