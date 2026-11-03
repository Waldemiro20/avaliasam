import { useEffect, useState } from "react";

export const MAX_PER_PROJECT = 100_000;
export const ADMIN_EMAIL = "admin123@gmail.com";
export const ADMIN_PASSWORD = "admin123";

export type Project = { id: string; name: string; members: string; description: string };
/** votes[evaluatorName][projectId] = amount */
export type Votes = Record<string, Record<string, number>>;

const K = { projects: "avaliasam.projects", votes: "avaliasam.votes", admin: "avaliasam.admin", evaluator: "avaliasam.evaluator" };
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

export const clampAmount = (n: number) => Math.max(0, Math.min(MAX_PER_PROJECT, Math.round(Number.isFinite(n) ? n : 0)));

export const formatBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function computeRanking(projects: Project[], votes: Votes) {
  return projects
    .map((p) => {
      const breakdown = Object.entries(votes)
        .map(([evaluator, v]) => ({ evaluator, amount: v[p.id] ?? 0 }))
        .filter((b) => b.amount > 0)
        .sort((a, b) => b.amount - a.amount);
      return { project: p, total: breakdown.reduce((s, b) => s + b.amount, 0), breakdown };
    })
    .sort((a, b) => b.total - a.total);
}

export const store = {
  getProjects: () => read<Project[]>(K.projects, []),
  saveProjects: (p: Project[]) => write(K.projects, p),
  getVotes: () => read<Votes>(K.votes, {}),
  saveEvaluatorVotes: (name: string, v: Record<string, number>) => {
    const all = read<Votes>(K.votes, {});
    all[name] = Object.fromEntries(Object.entries(v).map(([k, n]) => [k, clampAmount(n)]));
    write(K.votes, all);
  },
  isAdmin: () => read<boolean>(K.admin, false),
  setAdmin: (v: boolean) => write(K.admin, v),
  getEvaluator: () => read<string>(K.evaluator, ""),
  setEvaluator: (n: string) => write(K.evaluator, n),
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
    projects: ready ? store.getProjects() : [],
    votes: ready ? store.getVotes() : {},
    isAdmin: ready && store.isAdmin(),
    evaluator: ready ? store.getEvaluator() : "",
  };
}
