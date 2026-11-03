import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, LogOut, Moon, Pencil, Plus, Sun, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { formatBRL, getEventStatus, MAX_PER_PROJECT, parseInvestmentLimit, store, useStore, type Event, type EventStatus } from "@/lib/store";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Gerenciamento de Eventos | AvaliaSAM" },
      { name: "description", content: "Selecione um evento ou crie um novo no AvaliaSAM." },
    ],
  }),
  component: EventManagement,
});

type EventForm = { name: string; description: string; startDate: string; endDate: string; investmentLimit: string };
const initialForm: EventForm = { name: "", description: "", startDate: "", endDate: "", investmentLimit: String(MAX_PER_PROJECT) };

function formatDate(value: string) {
  if (!value) return "Não definida";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR").format(new Date(year!, month! - 1, day!));
}

function StatusBadge({ status }: { status: EventStatus }) {
  const labels: Record<EventStatus, string> = {
    active: "Em andamento",
    upcoming: "Agendado",
    expired: "Expirado",
    unconfigured: "Datas pendentes",
  };
  const styles: Record<EventStatus, string> = {
    active: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    upcoming: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    expired: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    unconfigured: "bg-muted text-muted-foreground",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>{labels[status]}</span>;
}

function EventManagement() {
  const nav = useNavigate();
  const { ready, isAdmin, events } = useStore();
  const [form, setForm] = useState<EventForm>(initialForm);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState<Event | null>(null);
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
    if (ready && !isAdmin) nav({ to: "/admin/login" });
  }, [ready, isAdmin, nav]);

  if (!ready || !isAdmin) return null;

  const openNewEvent = () => {
    setEditingEventId(null);
    setForm(initialForm);
    setShowForm(true);
  };

  const openEditEvent = (event: Event) => {
    setEditingEventId(event.id);
    setForm({
      name: event.name,
      description: event.description,
      startDate: event.startDate,
      endDate: event.endDate,
      investmentLimit: String(event.investmentLimit),
    });
    setShowForm(true);
  };

  const saveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    const investmentLimit = parseInvestmentLimit(form.investmentLimit);
    if (!name || !form.description.trim() || !form.startDate || !form.endDate) {
      toast.error("Preencha todos os campos obrigatórios do evento.");
      return;
    }
    if (form.startDate > form.endDate) {
      toast.error("A data de término deve ser igual ou posterior à data de início.");
      return;
    }
    if (investmentLimit === null) {
      toast.error("Informe um teto válido, usando até duas casas decimais.");
      return;
    }

    if (editingEventId) {
      const event = events.find((item) => item.id === editingEventId);
      if (!event) {
        toast.error("O evento selecionado não foi encontrado.");
        return;
      }
      store.saveEvent({
        ...event,
        name,
        description: form.description.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
        investmentLimit,
      });
      toast.success("Evento atualizado");
    } else {
      const event = store.createEvent(name, form.description, form.startDate, form.endDate, investmentLimit);
      toast.success("Evento criado");
      setShowForm(false);
      setForm(initialForm);
      nav({ to: "/admin/evento/$eventId", params: { eventId: event.id } });
      return;
    }

    setShowForm(false);
    setEditingEventId(null);
    setForm(initialForm);
  };

  const deleteEvent = () => {
    if (!deletingEvent) return;
    store.deleteEvent(deletingEvent.id);
    toast.success(`Evento "${deletingEvent.name}" e seus dados foram excluídos.`);
    setDeletingEvent(null);
  };

  return (
    <div className={`${darkMode ? "dark" : ""} min-h-screen bg-background text-foreground`}>
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Logo />
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setDarkMode((enabled) => !enabled)} aria-label={darkMode ? "Ativar tema claro" : "Ativar tema escuro"} aria-pressed={darkMode} className="grid h-9 w-9 place-items-center rounded-lg border text-muted-foreground transition hover:text-foreground">
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button onClick={() => { store.setAdmin(false); nav({ to: "/admin/login", replace: true }); }} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-7 px-4 py-8">
        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-orange-600 dark:text-[#f97316]"><CalendarDays className="h-4 w-4" /> Administração</p>
              <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">Gerenciamento de Eventos</h1>
              <p className="mt-2 text-muted-foreground">Crie eventos, acompanhe os prazos e gerencie suas avaliações.</p>
            </div>
            <button onClick={openNewEvent} className="bg-brand flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-semibold text-primary-foreground shadow-soft sm:w-auto">
              <Plus className="h-4 w-4" /> Novo Evento
            </button>
          </div>

          {events.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
              <CalendarDays className="mx-auto h-10 w-10 text-orange-500" />
              <h2 className="mt-4 font-display text-xl font-bold">Nenhum evento cadastrado</h2>
              <p className="mt-2 text-sm text-muted-foreground">Crie um evento para começar a cadastrar startups e avaliadores.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => {
                const status = getEventStatus(event);
                return (
                  <article key={event.id} className="rounded-2xl border bg-card p-5 shadow-soft transition hover:border-primary/50 hover:shadow-lg">
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid h-11 w-11 place-items-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-[#f97316]"><CalendarDays className="h-5 w-5" /></span>
                      <StatusBadge status={status} />
                    </div>
                    <h2 className="mt-4 font-display text-xl font-bold">{event.name}</h2>
                    <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted-foreground">{event.description || "Sem descrição"}</p>
                    <div className="mt-4 space-y-1.5 border-t pt-3 text-xs text-muted-foreground">
                      <p>Início: <span className="font-medium text-foreground">{formatDate(event.startDate)}</span></p>
                      <p>Término: <span className="font-medium text-foreground">{formatDate(event.endDate)}</span></p>
                      <p className="pt-1">{event.projects.length} {event.projects.length === 1 ? "projeto" : "projetos"} · {formatBRL(event.investmentLimit)} / projeto</p>
                    </div>
                    <div className="mt-4 flex items-center gap-2 border-t pt-4">
                      <button type="button" onClick={() => nav({ to: "/admin/evento/$eventId", params: { eventId: event.id } })} className="bg-brand flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-primary-foreground">
                        Gerenciar <ArrowRight className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => openEditEvent(event)} aria-label={`Editar ${event.name}`} title="Editar evento" className="grid h-9 w-9 place-items-center rounded-lg border text-muted-foreground transition hover:border-primary hover:text-primary">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => setDeletingEvent(event)} aria-label={`Excluir ${event.name}`} title="Excluir evento" className="grid h-9 w-9 place-items-center rounded-lg border text-muted-foreground transition hover:border-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {showForm && (
        <div className="fixed inset-0 z-20 grid place-items-center overflow-y-auto bg-foreground/40 px-4 py-8">
          <form onSubmit={saveEvent} className="w-full max-w-lg space-y-4 rounded-2xl bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">{editingEventId ? "Editar Evento" : "Novo Evento"}</h2>
              <button type="button" onClick={() => setShowForm(false)} aria-label="Fechar"><X className="h-5 w-5" /></button>
            </div>
            <label className="block space-y-1.5 text-sm font-medium">Nome do Evento
              <input required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Expotec" className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring" />
            </label>
            <label className="block space-y-1.5 text-sm font-medium">Descrição do Evento
              <textarea required rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5 text-sm font-medium">Data de Início
                <input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring" />
              </label>
              <label className="block space-y-1.5 text-sm font-medium">Data de Término
                <input required type="date" min={form.startDate || undefined} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring" />
              </label>
            </div>
            <label className="block space-y-1.5 text-sm font-medium">Teto de Investimento por Projeto (R$)
              <input
                required
                type="text"
                inputMode="decimal"
                value={form.investmentLimit}
                onChange={(e) => setForm({ ...form, investmentLimit: e.target.value })}
                onFocus={() => {
                  const value = parseInvestmentLimit(form.investmentLimit);
                  if (value !== null) setForm((current) => ({ ...current, investmentLimit: String(value) }));
                }}
                onBlur={() => {
                  const value = parseInvestmentLimit(form.investmentLimit);
                  if (value !== null) setForm((current) => ({ ...current, investmentLimit: formatBRL(value) }));
                }}
                className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <button className="bg-brand w-full rounded-lg py-2.5 font-semibold text-primary-foreground">{editingEventId ? "Salvar alterações" : "Criar Evento"}</button>
          </form>
        </div>
      )}

      {deletingEvent && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-foreground/50 px-4">
          <section role="alertdialog" aria-modal="true" aria-labelledby="delete-event-title" className="w-full max-w-md space-y-4 rounded-2xl bg-card p-6 shadow-2xl">
            <div>
              <h2 id="delete-event-title" className="font-display text-xl font-bold">Excluir evento?</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Excluir <strong className="text-foreground">{deletingEvent.name}</strong> também removerá seus projetos, convites e votos. Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setDeletingEvent(null)} className="rounded-lg border px-4 py-2 text-sm font-semibold">Cancelar</button>
              <button type="button" onClick={deleteEvent} className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground">Excluir evento</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
