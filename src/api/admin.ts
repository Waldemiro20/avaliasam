import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ERR } from "@/lib/api-errors";
import { computeRanking } from "@/lib/investment";
import {
  evaluatorCreateInput,
  eventInput,
  eventUpdateInput,
  idInput,
  projectCreateInput,
  projectUpdateInput,
} from "@/lib/schemas";
import { generateToken, sha256Hex } from "@/server/crypto";
import { withDb, type Db } from "@/server/db";
import { AppError, safely } from "@/server/errors";
import { requireAdmin } from "@/server/guards";
import { revokeEvaluatorSessions } from "@/server/session";

const asAdmin = <T>(fn: (db: Db) => Promise<T>) =>
  safely(() =>
    withDb(async (db) => {
      await requireAdmin(db);
      return fn(db);
    }),
  );

async function newEvaluatorToken() {
  const token = generateToken();
  return { token, tokenHash: await sha256Hex(token), tokenPrefix: token.slice(0, 8) };
}

export const listEvents = createServerFn({ method: "GET" }).handler(() =>
  asAdmin(async (db) => {
    const events = await db.event.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { projects: true } } },
    });
    return events.map((event) => ({
      id: event.id,
      name: event.name,
      description: event.description,
      investmentLimit: event.investmentLimit,
      projectCount: event._count.projects,
    }));
  }),
);

export const createEvent = createServerFn({ method: "POST" })
  .validator(eventInput)
  .handler(({ data }) =>
    asAdmin(async (db) => {
      const event = await db.event.create({ data });
      return { id: event.id };
    }),
  );

export const updateEvent = createServerFn({ method: "POST" })
  .validator(eventUpdateInput)
  .handler(({ data }) =>
    asAdmin(async (db) => {
      const { id, ...fields } = data;
      await db.$transaction(async (tx) => {
        const { count } = await tx.event.updateMany({ where: { id }, data: fields });
        if (count === 0) throw new AppError(ERR.notFound);
        // Regra existente: ao reduzir o teto, investimentos acima dele são ajustados ao novo limite.
        await tx.vote.updateMany({
          where: { project: { eventId: id }, amount: { gt: fields.investmentLimit } },
          data: { amount: fields.investmentLimit },
        });
      });
      return { ok: true };
    }),
  );

export const deleteEvent = createServerFn({ method: "POST" })
  .validator(idInput)
  .handler(({ data }) =>
    asAdmin(async (db) => {
      // Projetos, avaliadores, votos e sessões são removidos em cascata.
      const { count } = await db.event.deleteMany({ where: { id: data.id } });
      if (count === 0) throw new AppError(ERR.notFound);
      return { ok: true };
    }),
  );

export const getEventDetail = createServerFn({ method: "GET" })
  .validator(z.object({ eventId: z.string().uuid() }))
  .handler(({ data }) =>
    asAdmin(async (db) => {
      const event = await db.event.findUnique({
        where: { id: data.eventId },
        include: {
          projects: { orderBy: { createdAt: "asc" } },
          evaluators: { orderBy: { createdAt: "asc" }, include: { votes: true } },
        },
      });
      if (!event) return null;

      const projects = event.projects.map((project) => ({
        id: project.id,
        name: project.name,
        members: project.members,
        description: project.description,
        prototypeUrl: project.prototypeUrl,
        presentationUrl: project.presentationUrl,
      }));
      const votes = event.evaluators.flatMap((evaluator) =>
        evaluator.votes.map((vote) => ({
          evaluatorName: evaluator.name,
          projectId: vote.projectId,
          amount: vote.amount,
          revoked: evaluator.revokedAt !== null,
        })),
      );

      return {
        event: {
          id: event.id,
          name: event.name,
          description: event.description,
          investmentLimit: event.investmentLimit,
        },
        projects,
        evaluators: event.evaluators.map((evaluator) => ({
          id: evaluator.id,
          name: evaluator.name,
          tokenPrefix: evaluator.tokenPrefix,
          revoked: evaluator.revokedAt !== null,
          submittedAt: evaluator.submittedAt?.toISOString() ?? null,
        })),
        ranking: computeRanking(projects, votes),
        submittedCount: event.evaluators.filter((evaluator) => evaluator.submittedAt).length,
      };
    }),
  );

// ------------------------------------------------------------------ projetos

export const createProject = createServerFn({ method: "POST" })
  .validator(projectCreateInput)
  .handler(({ data }) =>
    asAdmin(async (db) => {
      const event = await db.event.findUnique({
        where: { id: data.eventId },
        select: { id: true },
      });
      if (!event) throw new AppError(ERR.notFound);
      const project = await db.project.create({ data });
      return { id: project.id };
    }),
  );

export const updateProject = createServerFn({ method: "POST" })
  .validator(projectUpdateInput)
  .handler(({ data }) =>
    asAdmin(async (db) => {
      const { id, ...fields } = data;
      const { count } = await db.project.updateMany({ where: { id }, data: fields });
      if (count === 0) throw new AppError(ERR.notFound);
      return { ok: true };
    }),
  );

export const deleteProject = createServerFn({ method: "POST" })
  .validator(idInput)
  .handler(({ data }) =>
    asAdmin(async (db) => {
      const { count } = await db.project.deleteMany({ where: { id: data.id } });
      if (count === 0) throw new AppError(ERR.notFound);
      return { ok: true };
    }),
  );

// ------------------------------------------------------------------ avaliadores

/** Cria o convite. O token em texto puro é devolvido UMA vez; o banco guarda só o hash. */
export const createEvaluator = createServerFn({ method: "POST" })
  .validator(evaluatorCreateInput)
  .handler(({ data }) =>
    asAdmin(async (db) => {
      const event = await db.event.findUnique({
        where: { id: data.eventId },
        select: { id: true },
      });
      if (!event) throw new AppError(ERR.notFound);
      const { token, tokenHash, tokenPrefix } = await newEvaluatorToken();
      const evaluator = await db.evaluator.create({
        data: { eventId: data.eventId, name: data.name, tokenHash, tokenPrefix },
      });
      return { id: evaluator.id, name: evaluator.name, token };
    }),
  );

/** Gera um novo link para o avaliador; o link anterior e suas sessões deixam de valer. */
export const regenerateEvaluatorLink = createServerFn({ method: "POST" })
  .validator(idInput)
  .handler(({ data }) =>
    asAdmin(async (db) => {
      const { token, tokenHash, tokenPrefix } = await newEvaluatorToken();
      const name = await db.$transaction(async (tx) => {
        const evaluator = await tx.evaluator.findUnique({ where: { id: data.id } });
        if (!evaluator) throw new AppError(ERR.notFound);
        if (evaluator.revokedAt)
          throw new AppError("Este avaliador foi excluído e não pode receber um novo link.");
        await tx.evaluator.update({ where: { id: data.id }, data: { tokenHash, tokenPrefix } });
        await revokeEvaluatorSessions(tx, data.id);
        return evaluator.name;
      });
      return { id: data.id, name, token };
    }),
  );

/**
 * Exclusão individual do avaliador: revoga o link e encerra as sessões ativas.
 * Os votos já enviados são preservados (dados históricos do ranking).
 */
export const revokeEvaluator = createServerFn({ method: "POST" })
  .validator(idInput)
  .handler(({ data }) =>
    asAdmin(async (db) => {
      await db.$transaction(async (tx) => {
        const { count } = await tx.evaluator.updateMany({
          where: { id: data.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        if (count === 0) {
          const exists = await tx.evaluator.findUnique({
            where: { id: data.id },
            select: { id: true },
          });
          if (!exists) throw new AppError(ERR.notFound);
        }
        await revokeEvaluatorSessions(tx, data.id);
      });
      return { ok: true };
    }),
  );
