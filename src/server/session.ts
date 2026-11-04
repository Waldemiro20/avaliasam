import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { jwtVerify, SignJWT } from "jose";
import type { Db } from "@/server/db";
import { env, isProduction } from "@/server/env";

/**
 * Sessões: o cookie HttpOnly carrega um JWT HS256 (assinatura + expiração) que
 * referencia uma linha da tabela `sessions`. Toda requisição confere a linha no
 * banco, então logout e revogação têm efeito imediato mesmo com JWT ainda válido.
 */

type Kind = "admin" | "evaluator";

const CONFIG: Record<Kind, { cookie: string; ttlSeconds: number }> = {
  admin: { cookie: "avaliasam_admin", ttlSeconds: 8 * 60 * 60 },
  evaluator: { cookie: "avaliasam_evaluator", ttlSeconds: 24 * 60 * 60 },
};

const ISSUER = "avaliasam";
const secretKey = () => new TextEncoder().encode(env().SESSION_SECRET);

async function signSessionJwt(kind: Kind, sessionId: string, expiresAt: Date) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(sessionId)
    .setIssuer(ISSUER)
    .setAudience(kind)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey());
}

async function readSessionId(kind: Kind): Promise<string | null> {
  const token = getCookie(CONFIG[kind].cookie);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: kind,
    });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null; // assinatura inválida, expirado ou malformado
  }
}

async function writeCookie(kind: Kind, sessionId: string, expiresAt: Date) {
  const jwt = await signSessionJwt(kind, sessionId, expiresAt);
  setCookie(CONFIG[kind].cookie, jwt, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

function clearCookie(kind: Kind) {
  deleteCookie(CONFIG[kind].cookie, { path: "/" });
}

const expiry = (kind: Kind) => new Date(Date.now() + CONFIG[kind].ttlSeconds * 1000);

/** Renova a sessão quando já passou da metade da validade (sessão deslizante). */
async function maybeRenew(db: Db, kind: Kind, sessionId: string, expiresAt: Date) {
  if (expiresAt.getTime() - Date.now() > (CONFIG[kind].ttlSeconds * 1000) / 2) return;
  const next = expiry(kind);
  await db.session.update({ where: { id: sessionId }, data: { expiresAt: next } });
  await writeCookie(kind, sessionId, next);
}

// ---------------------------------------------------------------- admin

export async function createAdminSession(db: Db, adminId: string) {
  const expiresAt = expiry("admin");
  const session = await db.session.create({ data: { role: "ADMIN", adminId, expiresAt } });
  await writeCookie("admin", session.id, expiresAt);
}

export async function loadAdminSession(db: Db) {
  const sessionId = await readSessionId("admin");
  if (!sessionId) return null;
  const session = await db.session.findFirst({
    where: { id: sessionId, role: "ADMIN", revokedAt: null, expiresAt: { gt: new Date() } },
    include: { admin: { select: { id: true, email: true } } },
  });
  if (!session?.admin) {
    clearCookie("admin");
    return null;
  }
  await maybeRenew(db, "admin", session.id, session.expiresAt);
  return { sessionId: session.id, adminId: session.admin.id, email: session.admin.email };
}

export async function destroyAdminSession(db: Db) {
  const sessionId = await readSessionId("admin");
  if (sessionId) {
    await db.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  clearCookie("admin");
}

// ---------------------------------------------------------------- avaliador

export async function createEvaluatorSession(db: Db, evaluatorId: string) {
  const expiresAt = expiry("evaluator");
  const session = await db.session.create({ data: { role: "EVALUATOR", evaluatorId, expiresAt } });
  await writeCookie("evaluator", session.id, expiresAt);
}

export type EvaluatorSession =
  | { status: "ok"; sessionId: string; evaluator: { id: string; name: string; eventId: string } }
  | { status: "unauthenticated" }
  | { status: "revoked" };

export async function loadEvaluatorSession(db: Db): Promise<EvaluatorSession> {
  const sessionId = await readSessionId("evaluator");
  if (!sessionId) return { status: "unauthenticated" };
  const session = await db.session.findFirst({
    where: { id: sessionId, role: "EVALUATOR" },
    include: { evaluator: { select: { id: true, name: true, eventId: true, revokedAt: true } } },
  });
  if (!session?.evaluator) {
    clearCookie("evaluator");
    return { status: "unauthenticated" };
  }
  if (session.evaluator.revokedAt) {
    clearCookie("evaluator");
    return { status: "revoked" };
  }
  if (session.revokedAt || session.expiresAt <= new Date()) {
    clearCookie("evaluator");
    return { status: "unauthenticated" };
  }
  await maybeRenew(db, "evaluator", session.id, session.expiresAt);
  const { id, name, eventId } = session.evaluator;
  return { status: "ok", sessionId: session.id, evaluator: { id, name, eventId } };
}

export async function destroyEvaluatorSession(db: Db) {
  const sessionId = await readSessionId("evaluator");
  if (sessionId) {
    await db.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  clearCookie("evaluator");
}

/** Revoga todas as sessões ativas de um avaliador (usado na exclusão/regeneração do link). */
export async function revokeEvaluatorSessions(db: Pick<Db, "session">, evaluatorId: string) {
  await db.session.updateMany({
    where: { evaluatorId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
