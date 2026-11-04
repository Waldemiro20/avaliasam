import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/server/env";

export type Db = PrismaClient;

/**
 * Cria um Prisma Client por requisição. Em Cloudflare Workers, conexões de I/O
 * não podem ser compartilhadas entre requisições, então o cliente é aberto e
 * fechado no escopo de cada chamada (ver `withDb`).
 * DATABASE_URL deve apontar para o pooler do Supabase (porta 6543).
 */
export function createDb(): Db {
  const adapter = new PrismaPg({ connectionString: env().DATABASE_URL, max: 1 });
  return new PrismaClient({ adapter });
}

export async function withDb<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const db = createDb();
  try {
    return await fn(db);
  } finally {
    await db.$disconnect().catch(() => undefined);
  }
}
