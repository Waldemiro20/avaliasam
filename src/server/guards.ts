import { ERR } from "@/lib/api-errors";
import type { Db } from "@/server/db";
import { AppError } from "@/server/errors";
import { loadAdminSession, loadEvaluatorSession } from "@/server/session";

/** RBAC: exige sessão de administrador válida (verificada no banco). */
export async function requireAdmin(db: Db) {
  const session = await loadAdminSession(db);
  if (!session) throw new AppError(ERR.unauthenticated);
  return session;
}

/** RBAC: exige sessão de avaliador válida, com link não revogado. */
export async function requireEvaluator(db: Db) {
  const session = await loadEvaluatorSession(db);
  if (session.status === "revoked") throw new AppError(ERR.revoked);
  if (session.status !== "ok") throw new AppError(ERR.unauthenticated);
  return session.evaluator;
}
