import { useState } from "react";
import { AlertTriangle, CheckCircle2, Plus, Save, Scale, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MoneyInput } from "@/components/MoneyInput";
import {
  competencyTotal,
  defaultCompetencies,
  distributeAmount,
  formatBRL,
  fromCents,
  MAX_PER_PROJECT,
  toCents,
  validateCompetencies,
  type Competency,
  type Event,
} from "@/lib/store";
import { cn } from "@/lib/utils";

export type EventFormValues = {
  name: string;
  description: string;
  investmentLimit: number;
  competencies: Competency[];
};

type EventFormProps = {
  /** Evento sendo editado; ausente ao criar um novo. */
  event?: Event | undefined;
  submitLabel: string;
  autoFocus?: boolean;
  /** Recebe os dados já validados (soma das competências === teto). */
  onSubmit: (values: EventFormValues) => void;
};

/**
 * Formulário único de evento: dados do evento, teto de investimento por projeto e
 * competências com o valor máximo (R$) de cada uma. Só envia quando a soma fecha no teto.
 */
export function EventForm({ event, submitLabel, autoFocus, onSubmit }: EventFormProps) {
  const [name, setName] = useState(event?.name ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [investmentLimit, setInvestmentLimit] = useState(event?.investmentLimit ?? MAX_PER_PROJECT);
  const [competencies, setCompetencies] = useState<Competency[]>(() =>
    event ? event.competencies.map((competency) => ({ ...competency })) : defaultCompetencies(MAX_PER_PROJECT),
  );

  const total = competencyTotal(competencies);
  const differenceCents = toCents(investmentLimit) - toCents(total);
  const error = validateCompetencies(competencies, investmentLimit);
  const balanced = differenceCents === 0;
  const progress = investmentLimit > 0 ? Math.min(100, (total / investmentLimit) * 100) : 0;

  const updateCompetency = (id: string, change: Partial<Competency>) =>
    setCompetencies((list) => list.map((competency) => (competency.id === id ? { ...competency, ...change } : competency)));
  const addCompetency = () =>
    setCompetencies((list) => [
      ...list,
      { id: crypto.randomUUID(), name: "", description: "", maxAmount: Math.max(0, fromCents(differenceCents)) },
    ]);
  const distributeEvenly = () => {
    const amounts = distributeAmount(investmentLimit, competencies.map(() => 1));
    setCompetencies((list) => list.map((competency, index) => ({ ...competency, maxAmount: amounts[index]! })));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) {
      toast.error("Preencha o nome e a descrição do evento.");
      return;
    }
    if (error) {
      toast.error(error);
      return;
    }
    const removed = (event?.competencies ?? []).filter((old) => !competencies.some((item) => item.id === old.id));
    if (
      removed.length > 0 &&
      !confirm(`Remover ${removed.map((c) => `"${c.name}"`).join(", ")} apaga os valores já investidos pelos avaliadores nessa competência. Continuar?`)
    ) {
      return;
    }
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      investmentLimit,
      competencies: competencies.map((c) => ({ ...c, name: c.name.trim(), description: c.description.trim() })),
    });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5 text-sm font-medium">
          Nome do Evento
          <input
            required
            autoFocus={autoFocus}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Expotec"
            className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Teto de Investimento por Projeto
          <MoneyInput value={investmentLimit} onChange={setInvestmentLimit} aria-label="Teto de Investimento por Projeto (R$)" />
        </label>
        <label className="space-y-1.5 text-sm font-medium md:col-span-2">
          Descrição do Evento
          <textarea
            required
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>

      <section className="space-y-3 border-t pt-5" aria-labelledby="competencies-title">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 id="competencies-title" className="font-display text-base font-bold">Competências e Critérios de Avaliação</h3>
            <p className="text-sm text-muted-foreground">Distribua o teto do projeto entre as competências. O avaliador investe de R$ 0,00 até o valor máximo de cada uma.</p>
          </div>
          <button
            type="button"
            onClick={distributeEvenly}
            disabled={competencies.length === 0}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
          >
            <Scale className="h-3.5 w-3.5" /> Distribuir igualmente
          </button>
        </div>

        <BudgetIndicator total={total} investmentLimit={investmentLimit} differenceCents={differenceCents} progress={progress} />

        <ol className="space-y-3">
          {competencies.map((competency, index) => (
            <li key={competency.id} className="rounded-xl border bg-card p-3 shadow-soft sm:p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_11rem_auto] sm:items-start">
                <div className="space-y-2">
                  <input
                    value={competency.name}
                    onChange={(e) => updateCompetency(competency.id, { name: e.target.value })}
                    placeholder={`Nome da competência ${index + 1}`}
                    aria-label={`Nome da competência ${index + 1}`}
                    className={cn(
                      "w-full rounded-lg border bg-background px-3 py-2 font-semibold outline-none focus:ring-2 focus:ring-ring",
                      !competency.name.trim() && "border-red-300 dark:border-red-800",
                    )}
                  />
                  <textarea
                    rows={2}
                    value={competency.description}
                    onChange={(e) => updateCompetency(competency.id, { description: e.target.value })}
                    placeholder="Descrição do critério: o que será avaliado nesta competência"
                    aria-label={`Descrição do critério da competência ${index + 1}`}
                    className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <label className="space-y-1 text-xs font-medium text-muted-foreground">
                  Valor máximo
                  <MoneyInput
                    value={competency.maxAmount}
                    onChange={(maxAmount) => updateCompetency(competency.id, { maxAmount })}
                    aria-label={`Valor máximo de investimento da competência ${index + 1} (R$)`}
                    className={cn("text-sm text-foreground", !(toCents(competency.maxAmount) > 0) && "border-red-300 dark:border-red-800")}
                  />
                  <span className="block text-right">
                    {investmentLimit > 0 ? `${((competency.maxAmount / investmentLimit) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do teto` : "—"}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setCompetencies((list) => list.filter((item) => item.id !== competency.id))}
                  aria-label={`Remover ${competency.name || `competência ${index + 1}`}`}
                  title="Remover competência"
                  className="justify-self-end rounded-lg p-2 text-muted-foreground transition hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={addCompetency}
          className="flex items-center gap-1.5 rounded-lg border border-dashed px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:border-primary hover:text-primary"
        >
          <Plus className="h-4 w-4" /> Adicionar competência
        </button>
      </section>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      <button
        type="submit"
        aria-disabled={Boolean(error) || !balanced}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-lg py-2.5 font-semibold transition",
          error ? "cursor-not-allowed border bg-muted text-muted-foreground" : "bg-brand text-primary-foreground shadow-soft",
        )}
      >
        <Save className="h-4 w-4" /> {submitLabel}
      </button>
    </form>
  );
}

function BudgetIndicator({ total, investmentLimit, differenceCents, progress }: { total: number; investmentLimit: number; differenceCents: number; progress: number }) {
  const state = differenceCents === 0 ? "ok" : differenceCents > 0 ? "remaining" : "exceeded";
  const tone = {
    ok: "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300",
    remaining: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    exceeded: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  }[state];
  const bar = { ok: "bg-green-600", remaining: "bg-amber-500", exceeded: "bg-red-600" }[state];

  return (
    <div className={cn("space-y-2 rounded-xl border px-4 py-3", tone)} aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
        <span>
          Total Distribuído: <strong className="tabular-nums">{formatBRL(total)}</strong> / Teto do Projeto:{" "}
          <strong className="tabular-nums">{formatBRL(investmentLimit)}</strong>
        </span>
        <span className="flex items-center gap-1.5 font-semibold">
          {state === "ok" ? (
            <><CheckCircle2 className="h-4 w-4" /> Distribuição fechada</>
          ) : state === "remaining" ? (
            <>Restante: <span className="tabular-nums">{formatBRL(fromCents(differenceCents))}</span></>
          ) : (
            <><AlertTriangle className="h-4 w-4" /> Excedente: <span className="tabular-nums">{formatBRL(fromCents(-differenceCents))}</span></>
          )}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-background/70">
        <div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
