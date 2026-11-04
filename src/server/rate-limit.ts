import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { ERR } from "@/lib/api-errors";
import type { Db } from "@/server/db";
import { AppError } from "@/server/errors";

/** IP do cliente (Cloudflare define cf-connecting-ip; fora dele usamos x-forwarded-for). */
export function clientIp(): string {
  return getRequestHeader("cf-connecting-ip") ?? getRequestIP({ xForwardedFor: true }) ?? "unknown";
}

/**
 * Rate limiting por janela fixa, persistido no Postgres (funciona com várias
 * instâncias serverless). A operação é atômica (INSERT ... ON CONFLICT).
 */
export async function enforceRateLimit(db: Db, key: string, limit: number, windowSeconds: number) {
  const rows = await db.$queryRaw<Array<{ count: number }>>`
    INSERT INTO rate_limits (key, count, window_start)
    VALUES (${key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
                   THEN 1 ELSE rate_limits.count + 1 END,
      window_start = CASE WHEN rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
                   THEN now() ELSE rate_limits.window_start END
    RETURNING count`;
  if ((rows[0]?.count ?? 0) > limit) throw new AppError(ERR.rateLimited);
}
