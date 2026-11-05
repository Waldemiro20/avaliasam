import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#111827] lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative flex min-h-[34vh] flex-col justify-between overflow-hidden px-5 py-6 text-white sm:min-h-[38vh] sm:px-10 sm:py-7 lg:min-h-screen lg:px-14 lg:py-10">
        <div className="pointer-events-none absolute -left-36 top-24 h-96 w-96 rounded-full border border-emerald-400/10" />
        <div className="pointer-events-none absolute -left-20 top-40 h-64 w-64 rounded-full border border-orange-400/10" />
        <div className="pointer-events-none absolute -bottom-48 right-0 h-[34rem] w-[34rem] rounded-full border border-emerald-400/10" />
        <div className="relative z-10">
          <Logo tone="inverse" />
        </div>
        <div className="relative z-10 max-w-2xl py-6 sm:py-10 lg:py-16">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/5 px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-emerald-200 sm:mb-5 sm:text-xs sm:tracking-[0.18em]">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Ideias que transformam
          </div>
          <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            O futuro começa com uma{" "}
            <span className="bg-gradient-to-r from-emerald-300 to-orange-300 bg-clip-text text-transparent">
              boa ideia.
            </span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:mt-5 sm:text-base sm:leading-7">
            Plataforma inteligente de avaliação e suporte a startups.
          </p>
        </div>
        <div className="relative z-10 flex items-center gap-3 text-xs text-slate-500">
          <span className="h-px w-8 bg-emerald-400/60" /> AvaliaSAM · Escola SAM
        </div>
      </section>
      <section className="flex min-h-[58vh] items-center justify-center bg-[#f7f8fa] px-4 py-8 text-slate-900 sm:px-10 sm:py-10 lg:min-h-screen">
        <div className="w-full max-w-md">{children}</div>
      </section>
    </main>
  );
}
