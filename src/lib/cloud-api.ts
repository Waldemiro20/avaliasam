import { createServerFn } from "@tanstack/react-start";

/**
 * Persistência compartilhada no Supabase (tabela `avaliasam_kv` + bucket `avaliasam-files`).
 * A service_role key só existe no servidor; o navegador fala apenas com estas server functions.
 *
 * Chaves da tabela:
 *   events            → Event[]
 *   evaluators        → Evaluator[]
 *   votes:<token>     → Record<projectId, number>
 *   scores:<token>    → Record<projectId, ProjectScore>
 */

const TABLE = "avaliasam_kv";
export const FILES_BUCKET = "avaliasam-files";

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type Row = { key: string; value: Json };

function env() {
  const url = (process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "").replace(/\/+$/, "");
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
  return url && key ? { url, key } : null;
}

const adminEmail = () => (process.env["ADMIN_EMAIL"] ?? "admin123@gmail.com").trim().toLowerCase();
const adminPassword = () => process.env["ADMIN_PASSWORD"] ?? "admin123";

async function supabase(path: string, init: RequestInit = {}) {
  const config = env();
  if (!config) throw new Error("Supabase não configurado.");
  const response = await fetch(`${config.url}${path}`, {
    ...init,
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, ...init.headers },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`Supabase ${init.method ?? "GET"} ${path} → ${response.status}: ${body}`);
    throw new Error("Falha ao acessar o banco de dados.");
  }
  return response;
}

async function selectRows(filter: string): Promise<Row[]> {
  const response = await supabase(`/rest/v1/${TABLE}?select=key,value&${filter}`);
  return (await response.json()) as Row[];
}

async function upsertRows(rows: Row[]) {
  if (rows.length === 0) return;
  await supabase(`/rest/v1/${TABLE}?on_conflict=key`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows.map((row) => ({ ...row, updated_at: new Date().toISOString() }))),
  });
}

async function deleteRows(keys: string[]) {
  if (keys.length === 0) return;
  const list = keys.map((key) => `"${key.replace(/"/g, "")}"`).join(",");
  await supabase(`/rest/v1/${TABLE}?key=in.(${encodeURIComponent(list)})`, { method: "DELETE" });
}

function assertAdmin(password: unknown) {
  if (typeof password !== "string" || password !== adminPassword()) throw new Error("Sessão de administrador inválida. Entre novamente.");
}

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_KEY_RE = /^(events|evaluators|(votes|scores):[0-9a-f-]{36})$/i;

type Evaluator = { token: string; name: string; eventId: string };
type Event = { id: string };

export type CloudState = {
  events: Json[] | null;
  evaluators: Evaluator[];
  votes: Record<string, Json>;
  scores: Record<string, Json>;
};

function toState(rows: Row[]): CloudState {
  const state: CloudState = { events: null, evaluators: [], votes: {}, scores: {} };
  for (const { key, value } of rows) {
    if (key === "events") state.events = Array.isArray(value) ? value : [];
    else if (key === "evaluators") state.evaluators = Array.isArray(value) ? (value as unknown as Evaluator[]) : [];
    else if (key.startsWith("votes:")) state.votes[key.slice(6)] = value;
    else if (key.startsWith("scores:")) state.scores[key.slice(7)] = value;
  }
  return state;
}

/** Indica se o servidor tem Supabase configurado (sem isso o app funciona só no navegador). */
export const cloudStatus = createServerFn({ method: "GET" }).handler(async () => ({ configured: env() !== null }));

export const adminLogin = createServerFn({ method: "POST" })
  .validator((data: { email: string; password: string }) => data)
  .handler(async ({ data }) => ({
    ok: data.email.trim().toLowerCase() === adminEmail() && data.password === adminPassword(),
  }));

export const adminPull = createServerFn({ method: "POST" })
  .validator((data: { password: string }) => data)
  .handler(async ({ data }): Promise<CloudState | null> => {
    if (!env()) return null;
    assertAdmin(data.password);
    return toState(await selectRows("order=key"));
  });

export const adminPush = createServerFn({ method: "POST" })
  .validator((data: { password: string; set: Array<{ key: string; value: Json }>; remove: string[] }) => data)
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    const keys = [...data.set.map((row) => row.key), ...data.remove];
    if (keys.some((key) => !SAFE_KEY_RE.test(key))) throw new Error("Chave inválida.");
    await upsertRows(data.set.map((row) => ({ key: row.key, value: row.value ?? null })));
    await deleteRows(data.remove);
    return { ok: true };
  });

/** Dados que um avaliador precisa: o convite dele, o evento e as próprias notas. */
export const evaluatorPull = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    if (!env()) return null;
    const token = data.token.trim().toLowerCase();
    if (!TOKEN_RE.test(token)) return { empty: false, evaluator: null, event: null, votes: null, scores: null };
    const state = toState(await selectRows(`key=in.(${encodeURIComponent(`"events","evaluators","votes:${token}","scores:${token}"`)})`));
    const evaluator = state.evaluators.find((item) => item.token.toLowerCase() === token) ?? null;
    const event = evaluator ? ((state.events ?? []) as unknown as Event[]).find((item) => item.id === evaluator.eventId) ?? null : null;
    return {
      /** Nuvem ainda sem dados (antes da primeira sincronização do administrador). */
      empty: state.events === null,
      evaluator,
      event,
      votes: evaluator ? state.votes[evaluator.token] ?? state.votes[token] ?? null : null,
      scores: evaluator ? state.scores[evaluator.token] ?? state.scores[token] ?? null : null,
    };
  });

export const evaluatorPush = createServerFn({ method: "POST" })
  .validator((data: { token: string; votes: Json; scores: Json }) => data)
  .handler(async ({ data }) => {
    const token = data.token.trim();
    if (!TOKEN_RE.test(token)) throw new Error("Convite inválido.");
    const [row] = await selectRows("key=eq.evaluators");
    const evaluators = Array.isArray(row?.value) ? (row.value as unknown as Evaluator[]) : [];
    if (!evaluators.some((item) => item.token === token)) throw new Error("Este link de avaliador foi revogado.");
    await upsertRows([
      { key: `votes:${token}`, value: data.votes ?? {} },
      { key: `scores:${token}`, value: data.scores ?? {} },
    ]);
    return { ok: true };
  });

/** Gera uma URL assinada para o navegador enviar o arquivo direto ao Supabase Storage (sem passar pelo limite de corpo da Vercel). */
export const createFileUpload = createServerFn({ method: "POST" })
  .validator((data: { password: string; name: string }) => data)
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    const config = env()!;
    const safeName = data.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(-80) || "arquivo";
    const path = `${crypto.randomUUID()}/${safeName}`;
    const response = await supabase(`/storage/v1/object/upload/sign/${FILES_BUCKET}/${path}`, { method: "POST" });
    const { url } = (await response.json()) as { url: string };
    return {
      path,
      uploadUrl: `${config.url}/storage/v1${url}`,
      publicUrl: `${config.url}/storage/v1/object/public/${FILES_BUCKET}/${path}`,
    };
  });

export const deleteCloudFile = createServerFn({ method: "POST" })
  .validator((data: { password: string; path: string }) => data)
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    await supabase(`/storage/v1/object/${FILES_BUCKET}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: [data.path] }),
    });
    return { ok: true };
  });
