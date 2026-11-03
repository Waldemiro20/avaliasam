import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Send, Users } from "lucide-react";
import { Logo } from "@/components/Logo";
import { clampAmount, formatBRL, MAX_PER_PROJECT, store, useStore } from "@/lib/store";

export const Route = createFileRoute("/avaliar/votacao")({
  head: () => ({
    meta: [
      { title: "Votação | AvaliaSAM" },
      { name: "description", content: "Distribua seus investimentos entre as startups." },
      { property: "og:title", content: "Votação | AvaliaSAM" },
      { property: "og:description", content: "Distribua seus investimentos entre as startups." },
    ],
  }),
  component: Voting,
});

const QUICK = [10_000, 25_000, 50_000];

function Voting() {
  const nav = useNavigate();
  const { ready, projects, votes, evaluator } = useStore();
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!evaluator) nav({ to: "/avaliar" });
    else if (!loaded) {
      setAmounts(votes[evaluator] ?? {});
      setLoaded(true);
    }
  }, [ready, evaluator, loaded, votes, nav]);

  const set = (id: string, n: number) => setAmounts((a) => ({ ...a, [id]: clampAmount(n) }));
  const total = projects.reduce((s, p) => s + (amounts[p.id] ?? 0), 0);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Logo />
          <p className="text-sm">Bem-vindo(a), <strong className="text-primary">{evaluator}</strong></p>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 pb-32">
        <div>
          <h1 className="font-display text-2xl font-bold">Projetos para avaliar</h1>
          <p className="text-muted-foreground">Você pode investir até {formatBRL(MAX_PER_PROJECT)} em cada projeto.</p>
        </div>
        {projects.length === 0 && <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Nenhum projeto cadastrado ainda.</p>}
        <div className="grid gap-5 md:grid-cols-2">
          {projects.map((p) => {
            const v = amounts[p.id] ?? 0;
            return (
              <article key={p.id} className="space-y-4 rounded-xl border bg-card p-6 shadow-soft">
                <div>
                  <h2 className="font-display text-xl font-bold">{p.name}</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><Users className="h-4 w-4" /> {p.members}</p>
                  <p className="mt-3 text-sm">{p.description}</p>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-2xl font-bold text-primary">{formatBRL(v)}</span>
                  <span className="text-xs text-muted-foreground">{Math.round((v / MAX_PER_PROJECT) * 100)}%</span>
                </div>
                <input type="range" min={0} max={MAX_PER_PROJECT} step={1000} value={v} onChange={(e) => set(p.id, +e.target.value)} className="w-full accent-[var(--primary)]" aria-label={`Investimento em ${p.name}`} />
                <div className="flex flex-wrap gap-2">
                  {QUICK.map((q) => (
                    <button key={q} onClick={() => set(p.id, v + q)} className="rounded-lg border px-3 py-1.5 text-sm font-semibold hover:border-accent hover:text-accent">+{q / 1000}k</button>
                  ))}
                  <button onClick={() => set(p.id, MAX_PER_PROJECT)} className="bg-accent-grad rounded-lg px-3 py-1.5 text-sm font-semibold text-accent-foreground">Máx 100k</button>
                  <button onClick={() => set(p.id, 0)} className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-destructive">Zerar</button>
                </div>
                <input inputMode="numeric" value={v.toLocaleString("pt-BR")} onChange={(e) => set(p.id, +e.target.value.replace(/\D/g, ""))} className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" aria-label="Valor em reais" />
              </article>
            );
          })}
        </div>
      </main>
      {projects.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
            <div><p className="text-xs text-muted-foreground">Total investido</p><p className="font-display text-lg font-bold">{formatBRL(total)}</p></div>
            <button onClick={() => { store.saveEvaluatorVotes(evaluator, amounts); setDone(true); }} className="bg-brand flex items-center gap-2 rounded-lg px-6 py-3 font-semibold text-primary-foreground shadow-soft">
              <Send className="h-4 w-4" /> Salvar / Enviar Avaliações
            </button>
          </div>
        </div>
      )}
      {done && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-foreground/40 px-4">
          <div className="w-full max-w-sm space-y-4 rounded-xl bg-card p-8 text-center shadow-soft">
            <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
            <h2 className="font-display text-2xl font-bold">Obrigado, {evaluator}!</h2>
            <p className="text-muted-foreground">Suas avaliações foram salvas com sucesso.</p>
            <button onClick={() => setDone(false)} className="bg-brand w-full rounded-lg py-2.5 font-semibold text-primary-foreground">Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}
