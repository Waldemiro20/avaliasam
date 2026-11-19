import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, LogOut, Moon, Pencil, Plus, Sun, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { EventForm, type EventFormValues } from "@/components/EventForm";
import { Logo } from "@/components/Logo";
import { formatBRL, store, useStore, type Event } from "@/lib/store";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Gerenciamento de Eventos | AvaliaSAM" },
      { name: "description", content: "Selecione um evento ou crie um novo no AvaliaSAM." },
    ],
  }),
  component: EventManagement,
});

function EventManagement() {
  const nav = useNavigate();
  const { ready, isAdmin, events } = useStore();
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
    setShowForm(true);
  };

  const openEditEvent = (event: Event) => {
    setEditingEventId(event.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingEventId(null);
  };

  const editingEvent = editingEventId ? events.find((item) => item.id === editingEventId) : undefined;

  const saveEvent = ({ name, description, investmentLimit, competencies }: EventFormValues) => {
    try {
      if (editingEventId) {
        if (!editingEvent) {
          toast.error("O evento selecionado não foi encontrado.");
          return;
        }
        store.saveEvent({ ...editingEvent, name, description, investmentLimit, competencies });
        toast.success("Evento atualizado");
        closeForm();
        return;
      }
      const event = store.createEvent(name, description, investmentLimit, competencies);
      toast.success("Evento criado");
      closeForm();
      nav({ to: "/admin/evento/$eventId", params: { eventId: event.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o evento.");
    }
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
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
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
              <p className="mt-2 text-muted-foreground">Crie eventos e gerencie suas avaliações e projetos.</p>
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
                return (
                  <article key={event.id} className="rounded-2xl border bg-card p-5 shadow-soft transition hover:border-primary/50 hover:shadow-lg">
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid h-11 w-11 place-items-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-[#f97316]"><CalendarDays className="h-5 w-5" /></span>
                      <span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800 dark:bg-green-900/40 dark:text-green-300">Ativo</span>
                    </div>
                    <h2 className="mt-4 font-display text-xl font-bold">{event.name}</h2>
                    <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted-foreground">{event.description || "Sem descrição"}</p>
                    <div className="mt-4 space-y-1.5 border-t pt-3 text-xs text-muted-foreground">
                      <p className="pt-1">{event.projects.length} {event.projects.length === 1 ? "projeto" : "projetos"} · {formatBRL(event.investmentLimit)} / projeto · {event.competencies.length} {event.competencies.length === 1 ? "competência" : "competências"}</p>
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
        <div className="fixed inset-0 z-20 grid place-items-center overflow-y-auto overscroll-contain bg-foreground/40 px-3 py-6 sm:px-4 sm:py-8">
          <div className="w-full max-w-3xl space-y-4 rounded-2xl bg-card p-5 shadow-soft sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">{editingEventId ? "Editar Evento" : "Novo Evento"}</h2>
              <button type="button" onClick={closeForm} aria-label="Fechar"><X className="h-5 w-5" /></button>
            </div>
            <EventForm
              key={editingEventId ?? "new"}
              event={editingEvent}
              autoFocus
              submitLabel={editingEventId ? "Salvar Configurações" : "Criar Evento"}
              onSubmit={saveEvent}
            />
          </div>
        </div>
      )}

      {deletingEvent && (
        <div className="fixed inset-0 z-30 grid place-items-center overflow-y-auto overscroll-contain bg-foreground/50 px-4 py-6">
          <section role="alertdialog" aria-modal="true" aria-labelledby="delete-event-title" className="w-full max-w-md space-y-4 rounded-2xl bg-card p-6 shadow-2xl">
            <div>
              <h2 id="delete-event-title" className="font-display text-xl font-bold">Excluir evento?</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Excluir <strong className="text-foreground">{deletingEvent.name}</strong> também removerá seus projetos, convites e votos. Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button type="button" onClick={() => setDeletingEvent(null)} className="rounded-lg border px-4 py-2 text-sm font-semibold">Cancelar</button>
              <button type="button" onClick={deleteEvent} className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground">Excluir evento</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
