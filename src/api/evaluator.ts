import { createServerFn } from "@tanstack/react-start";
import { ERR } from "@/lib/api-errors";
import { evaluatorStartInput, invitationInput, submitVotesInput } from "@/lib/schemas";
import { sha256Hex } from "@/server/crypto";
import { withDb, type Db } from "@/server/db";
import { AppError, safely } from "@/server/errors";
import { requireEvaluator } from "@/server/guards";
import { clientIp, enforceRateLimit } from "@/server/rate-limit";
import {
  createEvaluatorSession,
  destroyEvaluatorSession,
  loadEvaluatorSession,
} from "@/server/session";

async function findByToken(db: Db, token: string) {
  return db.evaluator.findUnique({
    where: { tokenHash: await sha256Hex(token) },
    include: { event: { select: { id: true, name: true } } },
  });
}

/** Valida o link `/avaliar?token=...` no servidor antes de mostrar qualquer dado. */
export const getInvitation = createServerFn({ method: "POST" })
  .validator(invitationInput)
  .handler(({ data }) =>
    safely(() =>
      withDb(async (db) => {
        await enforceRateLimit(db, `invite:ip:${clientIp()}`, 60, 15 * 60);
        const evaluator = await findByToken(db, data.token);
        if (!evaluator) return { status: "invalid" as const };
        if (evaluator.revokedAt) return { status: "revoked" as const };
        return {
          status: "valid" as const,
          eventName: evaluator.event.name,
          evaluatorName: evaluator.name,
        };
      }),
    ),
  );

/** Confirma o nome do convite e troca o token do link por uma sessão em cookie HttpOnly. */
export const startEvaluatorSession = createServerFn({ method: "POST" })
  .validator(evaluatorStartInput)
  .handler(({ data }) =>
    safely(() =>
      withDb(async (db) => {
        await enforceRateLimit(db, `evaluator-login:ip:${clientIp()}`, 20, 15 * 60);
        const evaluator = await findByToken(db, data.token);
        if (!evaluator) throw new AppError("Link de avaliador inválido.");
        if (evaluator.revokedAt) throw new AppError(ERR.revoked);
        const normalize = (value: string) => value.trim().toLocaleLowerCase("pt-BR");
        if (normalize(data.name) !== normalize(evaluator.name)) {
          throw new AppError(
            "O nome digitado não corresponde ao convite enviado pelo administrador.",
          );
        }
        await createEvaluatorSession(db, evaluator.id);
        return { ok: true };
      }),
    ),
  );

/** Dados da sala de votação: somente o evento ao qual o avaliador está vinculado. */
export const getVotingContext = createServerFn({ method: "GET" }).handler(() =>
  safely(() =>
    withDb(async (db) => {
      const session = await loadEvaluatorSession(db);
      if (session.status !== "ok") return { status: session.status };
      const event = await db.event.findUnique({
        where: { id: session.evaluator.eventId },
        include: { projects: { orderBy: { createdAt: "asc" } } },
      });
      if (!event) return { status: "unauthenticated" as const };
      const [votes, evaluator] = await Promise.all([
        db.vote.findMany({ where: { evaluatorId: session.evaluator.id } }),
        db.evaluator.findUnique({
          where: { id: session.evaluator.id },
          select: { submittedAt: true },
        }),
      ]);
      return {
        status: "ok" as const,
        evaluatorName: session.evaluator.name,
        submittedAt: evaluator?.submittedAt?.toISOString() ?? null,
        event: {
          name: event.name,
          description: event.description,
          investmentLimit: event.investmentLimit,
        },
        projects: event.projects.map((project) => ({
          id: project.id,
          name: project.name,
          members: project.members,
          description: project.description,
          prototypeUrl: project.prototypeUrl,
          presentationUrl: project.presentationUrl,
        })),
        votes: Object.fromEntries(votes.map((vote) => [vote.projectId, vote.amount])),
      };
    }),
  ),
);

/**
 * Persiste as avaliações. Nada vindo do cliente é tomado como verdade:
 * sessão, revogação, vínculo projeto↔evento e limites são verificados aqui.
 * Reenviar substitui a alocação anterior (regra atual do sistema).
 */
export const submitVotes = createServerFn({ method: "POST" })
  .validator(submitVotesInput)
  .handler(({ data }) =>
    safely(() =>
      withDb(async (db) => {
        const evaluator = await requireEvaluator(db);
        await enforceRateLimit(db, `votes:${evaluator.id}`, 30, 60);

        const event = await db.event.findUnique({
          where: { id: evaluator.eventId },
          select: { investmentLimit: true, projects: { select: { id: true } } },
        });
        if (!event) throw new AppError(ERR.notFound);

        const allowed = new Set(event.projects.map((project) => project.id));
        const seen = new Set<string>();
        for (const vote of data.votes) {
          if (!allowed.has(vote.projectId))
            throw new AppError("Há um projeto que não pertence a este evento.");
          if (seen.has(vote.projectId)) throw new AppError("Projeto repetido na avaliação.");
          if (vote.amount > event.investmentLimit) {
            throw new AppError("Um dos valores ultrapassa o teto de investimento do projeto.");
          }
          seen.add(vote.projectId);
        }

        const submittedAt = new Date();
        await db.$transaction(async (tx) => {
          // Confere a revogação dentro da transação (evita corrida com a exclusão pelo admin).
          const { count } = await tx.evaluator.updateMany({
            where: { id: evaluator.id, revokedAt: null },
            data: { submittedAt },
          });
          if (count === 0) throw new AppError(ERR.revoked);
          await tx.vote.deleteMany({ where: { evaluatorId: evaluator.id } });
          if (data.votes.length > 0) {
            await tx.vote.createMany({
              data: data.votes.map((vote) => ({
                evaluatorId: evaluator.id,
                projectId: vote.projectId,
                amount: vote.amount,
              })),
            });
          }
        });
        return { submittedAt: submittedAt.toISOString() };
      }),
    ),
  );

export const evaluatorLogout = createServerFn({ method: "POST" }).handler(() =>
  safely(() =>
    withDb(async (db) => {
      await destroyEvaluatorSession(db);
      return { ok: true };
    }),
  ),
);
