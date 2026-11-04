// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

/**
 * O Prisma Client gerado para Cloudflare importa o query compiler como
 * `import mod from "./query_compiler_fast_bg.wasm?module"` (Workers proíbem compilar
 * WebAssembly a partir de bytes em tempo de execução).
 * - build: mantém o import externo para que o Nitro (unwasm) empacote o .wasm no Worker;
 * - dev (Node): carrega o arquivo do disco e compila o módulo localmente.
 */
const GENERATED_PRISMA_INTERNAL = path.resolve(
  import.meta.dirname,
  "src/generated/prisma/internal",
);

function prismaWasmModule(): Plugin {
  const VIRTUAL = "\0prisma-wasm:";
  let isBuild = false;
  return {
    name: "avaliasam:prisma-wasm-module",
    enforce: "pre",
    configResolved(config) {
      isBuild = config.command === "build";
    },
    resolveId(source, importer) {
      if (!source.endsWith(".wasm?module") || !importer) return null;
      // Sempre aponta para o arquivo original gerado pelo Prisma (o import pode vir de um
      // bundle intermediário do build SSR, cujo diretório não contém o .wasm).
      const file = path.resolve(
        GENERATED_PRISMA_INTERNAL,
        path.basename(source.replace(/\?module$/, "")),
      );
      if (!isBuild) return `${VIRTUAL}${file}`;
      // Build SSR do Vite: mantém externo; ambiente "nitro": entrega ao unwasm do Nitro.
      return { id: `${file}?module`, external: this.environment?.name !== "nitro" };
    },
    load(id) {
      if (!id.startsWith(VIRTUAL)) return null;
      const file = id.slice(VIRTUAL.length);
      const base64 = readFileSync(file).toString("base64");
      return `export default new WebAssembly.Module(Buffer.from(${JSON.stringify(base64)}, "base64"));`;
    },
  };
}

/**
 * O bundle final do servidor (ambiente "nitro") pode gerar import circular entre
 * chunks (react ⇄ helpers de runtime CJS do rolldown), o que quebra o SSR em Node
 * (Vercel) com "__commonJSMin is not a function". `strictExecutionOrder` faz o
 * rolldown respeitar a ordem de execução dos módulos e evita o problema.
 */
function nitroStrictExecutionOrder(): Plugin {
  return {
    name: "avaliasam:nitro-strict-execution-order",
    enforce: "post",
    configEnvironment(name, config) {
      if (name !== "nitro") return;
      const rolldownOptions = (config.build ??= {}).rolldownOptions ?? {};
      const output = rolldownOptions.output;
      if (Array.isArray(output)) output.forEach((o) => (o.strictExecutionOrder = true));
      else rolldownOptions.output = { ...output, strictExecutionOrder: true };
      config.build.rolldownOptions = rolldownOptions;
    },
  };
}

export default defineConfig({
  plugins: [prismaWasmModule(), nitroStrictExecutionOrder()],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
