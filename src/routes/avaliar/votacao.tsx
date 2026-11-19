import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, LogOut, Moon, Send, Sun, Users } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { MoneyInput } from "@/components/MoneyInput";
import { openStoredFile, type StoredFile } from "@/lib/files";
import { clampMoney, evaluateProject, formatBRL, MAX_PER_PROJECT, store, useStore, type ProjectScore } from "@/lib/store";

export const Route = createFileRoute("/avaliar/votacao")({
  head: () => ({
    meta: [
      { title: "Votação | AvaliaSAM" },
      { name: "description", content: "Avalie cada startup por competência e veja o investimento liberado." },
      { property: "og:title", content: "Votação | AvaliaSAM" },
      { property: "og:description", content: "Avalie cada startup por competência e veja o investimento liberado." },
    ],
  }),
  component: Voting,
});

function Voting() {
  const nav = useNavigate();
  const { ready, events, scoreSheets, evaluator, evaluatorToken, evaluatorEventId, evaluators } = useStore();
  const event = events.find((item) => item.id === evaluatorEventId);
  const canVote = Boolean(event);
  const evaluatorIsAssignedToEvent = evaluators.some((item) => item.token === evaluatorToken && item.eventId === evaluatorEventId);
  const projects = event?.projects ?? [];
  const investmentLimit = event?.investmentLimit ?? MAX_PER_PROJECT;
  const competencies = event?.competencies ?? [];
  const [sheets, setSheets] = useState<Record<string, ProjectScore>>({});
  const [loaded, setLoaded] = useState(false);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
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
    if (!ready) return;
    if (!evaluator || !evaluatorToken || !evaluatorEventId || !event || !evaluatorIsAssignedToEvent) nav({ to: "/avaliar" });
    else if (!loaded) {
      setSheets(scoreSheets[evaluatorToken] ?? {});
      setLoaded(true);
    }
  }, [ready, evaluator, evaluatorToken, evaluatorEventId, event, evaluatorIsAssignedToEvent, loaded, scoreSheets, nav]);

  const sheetOf = (projectId: string): ProjectScore => sheets[projectId] ?? { amounts: {}, justifications: {}, opinion: "" };
  const updateSheet = (projectId: string, change: (sheet: ProjectScore) => ProjectScore) =>
    setSheets((all) => ({ ...all, [projectId]: change(all[projectId] ?? { amounts: {}, justifications: {}, opinion: "" }) }));
  const setAmount = (projectId: string, competencyId: string, max: number, n: number) =>
    updateSheet(projectId, (sheet) => ({ ...sheet, amounts: { ...sheet.amounts, [competencyId]: clampMoney(n, max) } }));
  const setJustification = (projectId: string, competencyId: string, text: string) =>
    updateSheet(projectId, (sheet) => ({ ...sheet, justifications: { ...sheet.justifications, [competencyId]: text } }));
  const setOpinion = (projectId: string, text: string) => updateSheet(projectId, (sheet) => ({ ...sheet, opinion: text }));
  const saveVotes = async () => {
    if (!event || saving) return;
    setSaving(true);
    try {
      store.saveEvaluatorScores(evaluatorToken, event.id, sheets);
      await store.flush();
      setDone(true);
    } catch (error) {
      console.error("Não foi possível salvar as avaliações.", error);
      toast.error("Não foi possível salvar suas avaliações. Verifique a conexão e tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${darkMode ? "dark" : ""} min-h-screen bg-background text-foreground`}>
      <header className="sticky top-0 z-10 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
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
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:py-8">
        <div>
          <p className="mb-1 text-sm text-muted-foreground sm:hidden">Bem-vindo(a), <strong className="text-primary">{evaluator}</strong></p>
          <h1 className="break-words font-display text-xl font-bold sm:text-2xl">{event?.name ? `Projetos · ${event.name}` : "Projetos para avaliar"}</h1>
          <p className="text-muted-foreground">
            Invista em cada competência um valor entre R$ 0,00 e o máximo definido para ela. O teto por projeto é {formatBRL(investmentLimit)}.
          </p>
          {event?.description && <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>}
        </div>
        {!ready ? <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Carregando projetos...</p> : projects.length === 0 && <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Nenhum projeto cadastrado ainda.</p>}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {projects.map((p) => {
            const sheet = sheetOf(p.id);
            const result = evaluateProject(competencies, sheet);
            return (
              <article key={p.id} className="min-w-0 space-y-4 rounded-xl border bg-card p-4 shadow-soft sm:p-6">
                <div>
                  <h2 className="break-words font-display text-xl font-bold">{p.name}</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><Users className="h-4 w-4" /> {p.members}</p>
                  <p className="mt-3 whitespace-pre-line break-words text-sm">{p.description}</p>
                  {(p.prototypeFile || p.presentationFile || p.prototypeUrl || p.presentationUrl) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {p.prototypeFile && <FileButton file={p.prototypeFile} label={p.prototypeUrl ? "🎨 Protótipo (arquivo)" : "🎨 Ver Protótipo"} />}
                      {p.prototypeUrl && <a href={p.prototypeUrl} target="_blank" rel="noopener noreferrer" className={fileButtonClass}>{p.prototypeFile ? "🔗 Protótipo (link)" : "🎨 Ver Protótipo"}</a>}
                      {p.presentationFile && <FileButton file={p.presentationFile} label={p.presentationUrl ? "📊 Apresentação (arquivo)" : "📊 Ver Apresentação"} />}
                      {p.presentationUrl && <a href={p.presentationUrl} target="_blank" rel="noopener noreferrer" className={fileButtonClass}>{p.presentationFile ? "🔗 Apresentação (link)" : "📊 Ver Apresentação"}</a>}
                    </div>
                  )}
                </div>
                <ol className="space-y-3">
                  {result.items.map(({ competency, amount }, index) => (
                    <li key={competency.id} className="space-y-2 rounded-lg border bg-background p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="min-w-0 break-words font-semibold">{index + 1}. {competency.name}</span>
                        <span className="text-xs text-muted-foreground">até <strong className="text-foreground">{formatBRL(competency.maxAmount)}</strong></span>
                      </div>
                      {competency.description && <p className="text-xs text-muted-foreground">{competency.description}</p>}
                      <input disabled={!canVote} type="range" min={0} max={competency.maxAmount} step={0.01} value={amount} onChange={(e) => setAmount(p.id, competency.id, competency.maxAmount, +e.target.value)} className="h-6 w-full accent-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Investimento de ${p.name} em ${competency.name}`} />
                      <div className="flex flex-wrap items-center gap-2">
                        <MoneyInput disabled={!canVote} value={amount} onChange={(value) => setAmount(p.id, competency.id, competency.maxAmount, value)} aria-label={`Valor investido em ${competency.name} (R$ 0,00 a ${formatBRL(competency.maxAmount)})`} className="min-w-[9rem] flex-1 bg-card text-sm" inputClassName="py-2 sm:py-1.5" />
                        <button type="button" disabled={!canVote} onClick={() => setAmount(p.id, competency.id, competency.maxAmount, competency.maxAmount)} className="bg-accent-grad min-h-10 rounded-lg px-4 py-2 text-xs font-semibold sm:min-h-0 sm:px-3 sm:py-1.5 text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50">Máx</button>
                        <button type="button" disabled={!canVote} onClick={() => setAmount(p.id, competency.id, competency.maxAmount, 0)} className="min-h-10 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-destructive sm:min-h-0 sm:px-2 sm:py-1.5 disabled:cursor-not-allowed disabled:opacity-50">Zerar</button>
                      </div>
                      <textarea disabled={!canVote} rows={1} value={sheet.justifications[competency.id] ?? ""} onChange={(e) => setJustification(p.id, competency.id, e.target.value)} placeholder="Justificativa (opcional)" aria-label={`Justificativa de ${competency.name}`} className="w-full resize-y rounded-md border bg-card px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </li>
                  ))}
                </ol>
                <div className="space-y-2 rounded-lg bg-muted p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm text-muted-foreground">Total investido no projeto <span className="tabular-nums">(de {formatBRL(result.maxAmount)})</span></span>
                    <span className="font-display text-xl font-bold text-primary sm:text-2xl">{formatBRL(result.amount)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-background"><div className="bg-brand h-full rounded-full transition-all" style={{ width: `${result.maxAmount > 0 ? (result.amount / result.maxAmount) * 100 : 0}%` }} /></div>
                  <textarea disabled={!canVote} rows={2} value={sheet.opinion} onChange={(e) => setOpinion(p.id, e.target.value)} placeholder="Parecer consolidado (opcional)" aria-label={`Parecer sobre ${p.name}`} className="w-full resize-y rounded-md border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                </div>
              </article>
            );
          })}
        </div>
        {projects.length > 0 && event && canVote && (
          <div className="mt-6 flex w-full justify-center">
            <button onClick={() => void saveVotes()} disabled={saving} className="bg-brand flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-6 py-3 font-semibold text-primary-foreground shadow-soft disabled:opacity-60 sm:w-auto">
              <Send className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar / Enviar Avaliações"}
            </button>
          </div>
        )}
      </main>
      {done && (
        <div className="fixed inset-0 z-20 grid place-items-center overflow-y-auto bg-foreground/40 px-4 py-8">
          <div className="w-full max-w-sm space-y-4 rounded-xl bg-card p-6 text-center shadow-soft sm:p-8">
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

const fileButtonClass = "rounded-lg border px-3 py-2 text-sm font-semibold transition hover:border-accent hover:text-accent";

function FileButton({ file, label }: { file: StoredFile; label: string }) {
  return (
    <button type="button" title={file.name} onClick={() => openStoredFile(file).catch((error) => toast.error(error instanceof Error ? error.message : "Não foi possível abrir o arquivo."))} className={fileButtonClass}>
      {label}
    </button>
  );
}
