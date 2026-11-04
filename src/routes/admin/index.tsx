import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, CalendarDays, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { createEvent, deleteEvent, listEvents, updateEvent } from "@/api/admin";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { InvestmentLimitInput } from "@/components/admin/InvestmentLimitInput";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { errorMessage } from "@/lib/api-errors";
import { DEFAULT_INVESTMENT_LIMIT, formatBRL, parseInvestmentLimit } from "@/lib/investment";
import { requireAdminRoute } from "@/lib/route-guards";
import { eventInput } from "@/lib/schemas";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Gerenciamento de Eventos | AvaliaSAM" },
      { name: "description", content: "Selecione um evento ou crie um novo no AvaliaSAM." },
    ],
  }),
  beforeLoad: requireAdminRoute,
  component: EventManagement,
});

type EventSummary = Awaited<ReturnType<typeof listEvents>>[number];
type EventForm = { name: string; description: string; investmentLimit: string };
const initialForm: EventForm = {
  name: "",
  description: "",
  investmentLimit: String(DEFAULT_INVESTMENT_LIMIT),
};

function EventManagement() {
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const [darkMode, setDarkMode] = useDarkMode();
  const [form, setForm] = useState<EventForm>(initialForm);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState<EventSummary | null>(null);

  const eventsQuery = useQuery({ queryKey: ["events"], queryFn: () => listEvents() });
  const events = eventsQuery.data ?? [];

  const closeForm = () => {
    setShowForm(false);
    setEditingEventId(null);
    setForm(initialForm);
  };

  const saveMutation = useMutation({
    mutationFn: async (input: {
      id: string | null;
      data: { name: string; description: string; investmentLimit: number };
    }) =>
      input.id
        ? {
            ...(await updateEvent({ data: { id: input.id, ...input.data } })),
            id: input.id,
            created: false,
          }
        : { ...(await createEvent({ data: input.data })), created: true },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      closeForm();
      if (result.created) {
        toast.success("Evento criado");
        await nav({ to: "/admin/evento/$eventId", params: { eventId: result.id } });
      } else {
        await queryClient.invalidateQueries({ queryKey: ["event", result.id] });
        toast.success("Evento atualizado");
      }
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (event: EventSummary) => deleteEvent({ data: { id: event.id } }),
    onSuccess: async (_, event) => {
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success(`Evento "${event.name}" e seus dados foram excluídos.`);
      setDeletingEvent(null);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const openNewEvent = () => {
    setEditingEventId(null);
    setForm(initialForm);
    setShowForm(true);
  };

  const openEditEvent = (event: EventSummary) => {
    setEditingEventId(event.id);
    setForm({
      name: event.name,
      description: event.description,
      investmentLimit: String(event.investmentLimit),
    });
    setShowForm(true);
  };

  const saveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (saveMutation.isPending) return;
    const investmentLimit = parseInvestmentLimit(form.investmentLimit);
    if (investmentLimit === null) {
      toast.error("Informe um teto válido: número inteiro em reais, sem valores negativos.");
      return;
    }
    const parsed = eventInput.safeParse({
      name: form.name,
      description: form.description,
      investmentLimit,
    });
    if (!parsed.success) {
      toast.error(
        parsed.error.issues[0]?.message ?? "Preencha todos os campos obrigatórios do evento.",
      );
      return;
    }
    saveMutation.mutate({ id: editingEventId, data: parsed.data });
  };

  return (
    <div className={`${darkMode ? "dark" : ""} min-h-screen bg-background text-foreground`}>
      <AdminHeader
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((enabled) => !enabled)}
      />

      <main className="mx-auto max-w-6xl space-y-7 px-4 py-8">
        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-orange-600 dark:text-[#f97316]">
                <CalendarDays className="h-4 w-4" /> Administração
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Gerenciamento de Eventos
              </h1>
              <p className="mt-2 text-muted-foreground">
                Crie eventos, cadastre projetos e gerencie suas avaliações.
              </p>
            </div>
            <button
              onClick={openNewEvent}
              className="bg-brand flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-semibold text-primary-foreground shadow-soft sm:w-auto"
            >
              <Plus className="h-4 w-4" /> Novo Evento
            </button>
          </div>

          {eventsQuery.isPending ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Carregando eventos...</p>
          ) : eventsQuery.isError ? (
            <div
              role="alert"
              className="rounded-2xl border border-destructive/40 bg-card px-6 py-10 text-center"
            >
              <p className="text-sm text-destructive">{errorMessage(eventsQuery.error)}</p>
              <button
                type="button"
                onClick={() => eventsQuery.refetch()}
                className="mt-4 rounded-lg border px-4 py-2 text-sm font-semibold"
              >
                Tentar novamente
              </button>
            </div>
          ) : events.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
              <CalendarDays className="mx-auto h-10 w-10 text-orange-500" />
              <h2 className="mt-4 font-display text-xl font-bold">Nenhum evento cadastrado</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Crie um evento para começar a cadastrar startups e avaliadores.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <article
                  key={event.id}
                  className="rounded-2xl border bg-card p-5 shadow-soft transition hover:border-primary/50 hover:shadow-lg"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-[#f97316]">
                    <CalendarDays className="h-5 w-5" />
                  </span>
                  <h2 className="mt-4 break-words font-display text-xl font-bold">{event.name}</h2>
                  <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted-foreground">
                    {event.description || "Sem descrição"}
                  </p>
                  <div className="mt-4 border-t pt-3 text-xs text-muted-foreground">
                    <p>
                      {event.projectCount} {event.projectCount === 1 ? "projeto" : "projetos"} ·{" "}
                      {formatBRL(event.investmentLimit)} / projeto
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-2 border-t pt-4">
                    <button
                      type="button"
                      onClick={() =>
                        nav({ to: "/admin/evento/$eventId", params: { eventId: event.id } })
                      }
                      className="bg-brand flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-primary-foreground"
                    >
                      Gerenciar <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditEvent(event)}
                      aria-label={`Editar ${event.name}`}
                      title="Editar evento"
                      className="grid h-9 w-9 place-items-center rounded-lg border text-muted-foreground transition hover:border-primary hover:text-primary"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingEvent(event)}
                      aria-label={`Excluir ${event.name}`}
                      title="Excluir evento"
                      className="grid h-9 w-9 place-items-center rounded-lg border text-muted-foreground transition hover:border-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {showForm && (
        <div className="fixed inset-0 z-20 grid place-items-center overflow-y-auto bg-foreground/40 px-4 py-8">
          <form
            onSubmit={saveEvent}
            noValidate
            className="w-full max-w-lg space-y-4 rounded-2xl bg-card p-6 shadow-soft"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">
                {editingEventId ? "Editar Evento" : "Novo Evento"}
              </h2>
              <button type="button" onClick={closeForm} aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="block space-y-1.5 text-sm font-medium">
              Nome do Evento
              <input
                required
                autoFocus
                maxLength={120}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Expotec"
                className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block space-y-1.5 text-sm font-medium">
              Descrição do Evento
              <textarea
                required
                rows={3}
                maxLength={2000}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <InvestmentLimitInput
              id="event-form-limit"
              label="Teto de Investimento por Projeto (R$)"
              value={form.investmentLimit}
              onChange={(investmentLimit) => setForm({ ...form, investmentLimit })}
            />
            <button
              disabled={saveMutation.isPending}
              className="bg-brand w-full rounded-lg py-2.5 font-semibold text-primary-foreground disabled:opacity-60"
            >
              {saveMutation.isPending
                ? "Salvando..."
                : editingEventId
                  ? "Salvar alterações"
                  : "Criar Evento"}
            </button>
          </form>
        </div>
      )}

      {deletingEvent && (
        <ConfirmDialog
          title="Excluir evento?"
          confirmLabel="Excluir evento"
          pending={deleteMutation.isPending}
          onCancel={() => setDeletingEvent(null)}
          onConfirm={() => deleteMutation.mutate(deletingEvent)}
        >
          Excluir <strong className="text-foreground">{deletingEvent.name}</strong> também removerá
          seus projetos, convites e votos. Esta ação não pode ser desfeita.
        </ConfirmDialog>
      )}
    </div>
  );
}
