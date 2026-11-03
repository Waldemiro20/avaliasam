import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, LogOut, Moon, Send, Sun, Users } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { clampAmount, formatBRL, getEventStatus, MAX_PER_PROJECT, store, useStore } from "@/lib/store";

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

const QUICK = [10_000, 20_000, 50_000];

function Voting() {
  const nav = useNavigate();
  const { ready, events, votes, evaluator, evaluatorToken, evaluatorEventId, evaluators } = useStore();
  const event = events.find((item) => item.id === evaluatorEventId);
  const eventStatus = event ? getEventStatus(event) : "unconfigured";
  const canVote = eventStatus === "active";
  const evaluatorIsAssignedToEvent = evaluators.some((item) => item.token === evaluatorToken && item.eventId === evaluatorEventId);
  const projects = event?.projects ?? [];
  const investmentLimit = event?.investmentLimit ?? MAX_PER_PROJECT;
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);
  const [done, setDone] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [themeLoaded, setThemeLoaded] = useState(false);

  useEffect(() => {
    setDarkMode(localStorage.getItem("avaliasam.darkMode") === "true");
    setThemeLoaded(true);
  }, []);

  useEffect(() => {
    if (themeLoaded) localStorage.setItem("avaliasam.darkMode", String(darkMode));
  }, [darkMode, themeLoaded]);

  useEffect(() => {
    setAmounts((current) => Object.fromEntries(
      Object.entries(current).map(([projectId, amount]) => [projectId, clampAmount(amount, investmentLimit)]),
    ));
  }, [investmentLimit]);

  useEffect(() => {
    if (!ready) return;
    if (!evaluator || !evaluatorToken || !evaluatorEventId || !event || !evaluatorIsAssignedToEvent) nav({ to: "/avaliar" });
    else if (!loaded) {
      setAmounts(Object.fromEntries(
        Object.entries(votes[evaluatorToken] ?? {}).map(([projectId, amount]) => [projectId, clampAmount(amount, investmentLimit)]),
      ));
      setLoaded(true);
    }
  }, [ready, evaluator, evaluatorToken, evaluatorEventId, event, evaluatorIsAssignedToEvent, investmentLimit, loaded, votes, nav]);

  const set = (id: string, n: number) => setAmounts((a) => ({ ...a, [id]: clampAmount(n, investmentLimit) }));
  const saveVotes = () => {
    if (!event) return;
    try {
      store.saveEvaluatorVotes(evaluatorToken, event.id, amounts);
      setDone(true);
    } catch (error) {
      console.error("Não foi possível salvar as avaliações.", error);
      toast.error("Não foi possível salvar suas avaliações. Reabra o link do evento e tente novamente.");
    }
  };

  return (
    <div className={`${darkMode ? "dark" : ""} min-h-screen bg-background text-foreground`}>
      <header className="sticky top-0 z-10 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Logo />
          <div className="flex items-center gap-4">
            <p className="hidden text-sm sm:block">Bem-vindo(a), <strong className="text-primary">{evaluator}</strong></p>
            <button
              type="button"
              onClick={() => setDarkMode((enabled) => !enabled)}
              aria-label={darkMode ? "Ativar tema claro" : "Ativar tema escuro"}
              aria-pressed={darkMode}
              className="grid h-9 w-9 place-items-center rounded-lg border text-muted-foreground transition hover:text-foreground"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button onClick={() => { store.setEvaluator("", ""); nav({ to: "/avaliar", replace: true }); }} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive"><LogOut className="h-4 w-4" /> Sair</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 pb-28">
        <div>
          <h1 className="font-display text-2xl font-bold">{event?.name ? `Projetos · ${event.name}` : "Projetos para avaliar"}</h1>
          <p className="text-muted-foreground">Você pode investir até {formatBRL(investmentLimit)} em cada projeto.</p>
          {event?.description && <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>}
          {event && (
            <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ${
              eventStatus === "active" ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" :
              eventStatus === "expired" ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" :
              "bg-muted text-muted-foreground"
            }`}>
              {eventStatus === "active" ? "Em andamento" :
                eventStatus === "expired" ? "Expirado" :
                  eventStatus === "upcoming" ? "Agendado" : "Datas pendentes"}
            </span>
          )}
        </div>
        {!canVote && event && (
          <p role="status" className="rounded-xl border border-orange-300 bg-orange-50 p-4 text-sm font-medium text-orange-900 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-200">
            {eventStatus === "expired"
              ? "Este evento já foi concluído e as avaliações foram encerradas."
              : eventStatus === "upcoming"
                ? "As avaliações deste evento ainda não começaram."
                : "As datas deste evento ainda não foram configuradas pelo administrador."}
          </p>
        )}
        {projects.length === 0 && <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Nenhum projeto cadastrado ainda.</p>}
        <div className="grid gap-5 md:grid-cols-2">
          {projects.map((p) => {
            const v = amounts[p.id] ?? 0;
            return (
              <article key={p.id} className="space-y-4 rounded-xl border bg-card p-4 shadow-soft sm:p-6">
                <div>
                  <h2 className="font-display text-xl font-bold">{p.name}</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><Users className="h-4 w-4" /> {p.members}</p>
                  <p className="mt-3 text-sm">{p.description}</p>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-display text-xl font-bold text-primary sm:text-2xl">{formatBRL(v)}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{investmentLimit > 0 ? Math.round((v / investmentLimit) * 100) : 0}%</span>
                </div>
                <input disabled={!canVote} type="range" min={0} max={investmentLimit} step={1000} value={v} onChange={(e) => set(p.id, +e.target.value)} className="w-full accent-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Investimento em ${p.name}`} />
                <div className="flex flex-wrap gap-2">
                  {QUICK.map((q) => (
                    <button disabled={!canVote} key={q} onClick={() => set(p.id, v + q)} className="rounded-lg border px-3 py-1.5 text-sm font-semibold hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50">+{q / 1000}k</button>
                  ))}
                  <button disabled={!canVote} onClick={() => set(p.id, investmentLimit)} className="bg-accent-grad rounded-lg px-3 py-1.5 text-sm font-semibold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50">Máx {investmentLimit / 1000}k</button>
                  <button disabled={!canVote} onClick={() => set(p.id, 0)} className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50">Zerar</button>
                </div>
                <input disabled={!canVote} inputMode="numeric" value={v.toLocaleString("pt-BR")} onChange={(e) => set(p.id, +e.target.value.replace(/\D/g, ""))} className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50" aria-label="Valor em reais" />
              </article>
            );
          })}
        </div>
      </main>
      {projects.length > 0 && event && canVote && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl justify-end px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <button onClick={saveVotes} className="bg-brand flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 font-semibold text-primary-foreground shadow-soft sm:w-auto">
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
