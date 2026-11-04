import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CheckCircle2, LogOut, Moon, Send, Sun, Users } from "lucide-react";
import { toast } from "sonner";
import { evaluatorLogout, getVotingContext, submitVotes } from "@/api/evaluator";
import { AuthLayout } from "@/components/AuthLayout";
import { RevokedLinkNotice } from "@/components/EvaluatorAccess";
import { Logo } from "@/components/Logo";
import { ProjectLinks } from "@/components/ProjectLinks";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { ERR, errorMessage } from "@/lib/api-errors";
import { clampAmount, formatBRL } from "@/lib/investment";

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
const compactBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);

function Voting() {
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const [darkMode, setDarkMode] = useDarkMode();
  const [amounts, setAmounts] = useState<Record<string, number> | null>(null);
  const [done, setDone] = useState(false);
  const [revoked, setRevoked] = useState(false);

  // Reconsulta periodicamente: se o link for revogado, a sessão perde o acesso nesta tela.
  const contextQuery = useQuery({
    queryKey: ["voting-context"],
    queryFn: () => getVotingContext(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const context = contextQuery.data;

  useEffect(() => {
    if (context?.status === "unauthenticated") void nav({ to: "/avaliar", replace: true });
    if (context?.status === "revoked") setRevoked(true);
    // Carrega os valores salvos apenas uma vez, para não sobrescrever a edição em andamento.
    if (context?.status === "ok" && amounts === null) setAmounts(context.votes);
  }, [context, amounts, nav]);

  const submitMutation = useMutation({
    mutationFn: (votes: Array<{ projectId: string; amount: number }>) =>
      submitVotes({ data: { votes } }),
    onSuccess: async () => {
      setDone(true);
      await queryClient.invalidateQueries({ queryKey: ["voting-context"] });
    },
    onError: (error) => {
      const message = errorMessage(error);
      if (message === ERR.revoked) setRevoked(true);
      else if (message === ERR.unauthenticated) void nav({ to: "/avaliar", replace: true });
      else toast.error(message);
    },
  });

  if (revoked) {
    return (
      <AuthLayout>
        <RevokedLinkNotice />
      </AuthLayout>
    );
  }

  const ready = context?.status === "ok" && amounts !== null;
  const investmentLimit = context?.status === "ok" ? context.event.investmentLimit : 0;
  const projects = context?.status === "ok" ? context.projects : [];

  const set = (id: string, n: number) =>
    setAmounts((a) => ({ ...(a ?? {}), [id]: clampAmount(n, investmentLimit) }));

  const save = () => {
    if (!ready || submitMutation.isPending) return;
    const votes = projects.map((project) => ({
      projectId: project.id,
      amount: clampAmount(amounts[project.id] ?? 0, investmentLimit),
    }));
    submitMutation.mutate(votes);
  };

  const logout = async () => {
    try {
      await evaluatorLogout();
    } finally {
      queryClient.removeQueries({ queryKey: ["voting-context"] });
      await nav({ to: "/avaliar", replace: true });
    }
  };

  return (
    <div className={`${darkMode ? "dark" : ""} min-h-screen bg-background text-foreground`}>
      <header className="sticky top-0 z-10 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Logo />
          <div className="flex items-center gap-4">
            {context?.status === "ok" && (
              <p className="hidden text-sm sm:block">
                Bem-vindo(a), <strong className="text-primary">{context.evaluatorName}</strong>
              </p>
            )}
            <button
              type="button"
              onClick={() => setDarkMode((enabled) => !enabled)}
              aria-label={darkMode ? "Ativar tema claro" : "Ativar tema escuro"}
              aria-pressed={darkMode}
              className="grid h-9 w-9 place-items-center rounded-lg border text-muted-foreground transition hover:text-foreground"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </div>
      </header>

      {!ready ? (
        <main className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-muted-foreground">
          {contextQuery.isError ? (
            <div role="alert" className="space-y-4">
              <p className="text-destructive">{errorMessage(contextQuery.error)}</p>
              <button
                type="button"
                onClick={() => contextQuery.refetch()}
                className="rounded-lg border px-4 py-2 font-semibold text-foreground"
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            "Carregando projetos..."
          )}
        </main>
      ) : (
        <>
          <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 pb-28">
            <div>
              <h1 className="font-display text-2xl font-bold">{`Projetos · ${context.event.name}`}</h1>
              <p className="text-muted-foreground">
                Cada projeto tem um orçamento independente de até {formatBRL(investmentLimit)}.
              </p>
              {context.event.description && (
                <p className="mt-1 text-sm text-muted-foreground">{context.event.description}</p>
              )}
              {context.submittedAt && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Última avaliação enviada em{" "}
                  {new Date(context.submittedAt).toLocaleString("pt-BR")}. Você pode ajustar e
                  enviar novamente.
                </p>
              )}
            </div>
            {projects.length === 0 && (
              <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
                Nenhum projeto cadastrado ainda.
              </p>
            )}
            <div className="grid gap-5 md:grid-cols-2">
              {projects.map((p) => {
                const v = amounts[p.id] ?? 0;
                return (
                  <article
                    key={p.id}
                    className="space-y-4 rounded-xl border bg-card p-4 shadow-soft sm:p-6"
                  >
                    <div>
                      <h2 className="break-words font-display text-xl font-bold">{p.name}</h2>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Users className="h-4 w-4 shrink-0" /> {p.members}
                      </p>
                      <p className="mt-3 whitespace-pre-line text-sm">{p.description}</p>
                    </div>
                    <ProjectLinks
                      prototypeUrl={p.prototypeUrl}
                      presentationUrl={p.presentationUrl}
                      projectName={p.name}
                    />
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-display text-xl font-bold text-primary sm:text-2xl">
                        {formatBRL(v)}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        de {formatBRL(investmentLimit)} ·{" "}
                        {investmentLimit > 0 ? Math.round((v / investmentLimit) * 100) : 0}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={investmentLimit}
                      step={1000}
                      value={v}
                      onChange={(e) => set(p.id, +e.target.value)}
                      className="w-full accent-[var(--primary)]"
                      aria-label={`Investimento em ${p.name}`}
                    />
                    <div className="flex flex-wrap gap-2">
                      {QUICK.map((q) => (
                        <button
                          type="button"
                          key={q}
                          onClick={() => set(p.id, v + q)}
                          className="rounded-lg border px-3 py-1.5 text-sm font-semibold hover:border-accent hover:text-accent"
                        >
                          +{q / 1000}k
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => set(p.id, investmentLimit)}
                        className="bg-accent-grad rounded-lg px-3 py-1.5 text-sm font-semibold text-accent-foreground"
                      >
                        Máx {compactBRL(investmentLimit)}
                      </button>
                      <button
                        type="button"
                        onClick={() => set(p.id, 0)}
                        className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-destructive"
                      >
                        Zerar
                      </button>
                    </div>
                    <AmountInput
                      value={v}
                      limit={investmentLimit}
                      label={`Valor em reais para ${p.name}`}
                      onChange={(n) => set(p.id, n)}
                    />
                  </article>
                );
              })}
            </div>
          </main>
          {projects.length > 0 && (
            <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-card/95 backdrop-blur">
              <div className="mx-auto flex max-w-6xl justify-end px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={save}
                  disabled={submitMutation.isPending}
                  className="bg-brand flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 font-semibold text-primary-foreground shadow-soft disabled:cursor-wait disabled:opacity-70 sm:w-auto"
                >
                  <Send className="h-4 w-4" />{" "}
                  {submitMutation.isPending ? "Enviando..." : "Salvar / Enviar Avaliações"}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {done && context?.status === "ok" && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-foreground/40 px-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm space-y-4 rounded-xl bg-card p-8 text-center shadow-soft"
          >
            <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
            <h2 className="font-display text-2xl font-bold">Obrigado, {context.evaluatorName}!</h2>
            <p className="text-muted-foreground">Suas avaliações foram salvas com sucesso.</p>
            <button
              type="button"
              onClick={() => setDone(false)}
              className="bg-brand w-full rounded-lg py-2.5 font-semibold text-primary-foreground"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Campo numérico do investimento: enquanto focado mostra exatamente o que foi digitado
 * (somente dígitos), sem reformatar a cada tecla; ao sair, exibe o valor formatado.
 */
function AmountInput({
  value,
  limit,
  label,
  onChange,
}: {
  value: number;
  limit: number;
  label: string;
  onChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const typed = draft === null ? null : Number(draft || "0");
  const overLimit = typed !== null && typed > limit;
  return (
    <div className="space-y-1">
      <input
        inputMode="numeric"
        autoComplete="off"
        value={draft ?? value.toLocaleString("pt-BR")}
        onFocus={() => setDraft(value === 0 ? "" : String(value))}
        onBlur={() => setDraft(null)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
          setDraft(digits);
          onChange(Number(digits || "0"));
        }}
        aria-label={label}
        aria-invalid={overLimit}
        className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
      />
      {overLimit && (
        <p className="text-xs text-destructive">
          O máximo por projeto é {formatBRL(limit)}; o valor foi ajustado.
        </p>
      )}
    </div>
  );
}
