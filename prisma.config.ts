import "dotenv/config";
import { defineConfig } from "prisma/config";

// DIRECT_URL (conexão direta, porta 5432) é usada pelo CLI para migrations.
// Em tempo de execução a aplicação usa DATABASE_URL (pooler do Supabase).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
