import { createServerFn } from "@tanstack/react-start";
import { ERR } from "@/lib/api-errors";
import { loginInput } from "@/lib/schemas";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/server/crypto";
import { withDb } from "@/server/db";
import { AppError, safely } from "@/server/errors";
import { clientIp, enforceRateLimit } from "@/server/rate-limit";
import { createAdminSession, destroyAdminSession, loadAdminSession } from "@/server/session";

/** Retorna o administrador logado (ou null). Usado pelos guards de rota. */
export const getAdminMe = createServerFn({ method: "GET" }).handler(() =>
  safely(() =>
    withDb(async (db) => {
      const session = await loadAdminSession(db);
      return session ? { email: session.email } : null;
    }),
  ),
);

export const adminLogin = createServerFn({ method: "POST" })
  .validator(loginInput)
  .handler(({ data }) =>
    safely(() =>
      withDb(async (db) => {
        await enforceRateLimit(db, `login:ip:${clientIp()}`, 10, 15 * 60);
        await enforceRateLimit(db, `login:email:${data.email}`, 10, 15 * 60);

        const admin = await db.adminUser.findUnique({ where: { email: data.email } });
        // Sempre executa o hash para não revelar, pelo tempo de resposta, se o e-mail existe.
        const valid = await verifyPassword(
          data.password,
          admin?.passwordHash ?? DUMMY_PASSWORD_HASH,
        );
        if (!admin || !valid) throw new AppError(ERR.invalidCredentials);

        await createAdminSession(db, admin.id);
        return { email: admin.email };
      }),
    ),
  );

export const adminLogout = createServerFn({ method: "POST" }).handler(() =>
  safely(() =>
    withDb(async (db) => {
      await destroyAdminSession(db);
      return { ok: true };
    }),
  ),
);
