import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Link2, LogOut, Moon, Pencil, Plus, Save, Sun, Trash2, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { computeRanking, formatBRL, getEventStatus, parseInvestmentLimit, store, useStore, type Project, type Votes } from "@/lib/store";

export const Route = createFileRoute("/admin/evento/$eventId")({
  head: () => ({
    meta: [
      { title: "Painel do Administrador | AvaliaSAM" },
      { name: "description", content: "Gerencie eventos, projetos, avaliadores e ranking." },
      { property: "og:title", content: "Painel do Administrador | AvaliaSAM" },
      { property: "og:description", content: "Gestão de eventos, projetos e ranking consolidado." },
    ],
  }),
  component: Admin,
});

const emptyProject = { name: "", members: "", description: "" };
function Admin() {
  const nav = useNavigate();
  const { eventId } = Route.useParams();
  const { ready, isAdmin, events, votes, evaluators } = useStore();
  const [projectForm, setProjectForm] = useState<(typeof emptyProject & { id?: string }) | null>(null);
  const [evaluatorName, setEvaluatorName] = useState("");
  const [eventSettings, setEventSettings] = useState({ name: "", description: "", startDate: "", endDate: "", investmentLimit: "" });
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
  const selectedEvent = events.find((event) => event.id === eventId);
  useEffect(() => {
    if (selectedEvent) {
      setEventSettings({
        name: selectedEvent.name,
        description: selectedEvent.description,
        startDate: selectedEvent.startDate,
        endDate: selectedEvent.endDate,
        investmentLimit: String(selectedEvent.investmentLimit),
      });
    }
  }, [selectedEvent?.id, selectedEvent?.name, selectedEvent?.description, selectedEvent?.startDate, selectedEvent?.endDate, selectedEvent?.investmentLimit]);
  useEffect(() => {
    if (ready && isAdmin && !selectedEvent) nav({ to: "/admin", replace: true });
  }, [ready, isAdmin, selectedEvent, nav]);

  if (!ready || !isAdmin || !selectedEvent) return null;

  const eventEvaluators = evaluators.filter((evaluator) => evaluator.eventId === selectedEvent.id);
  const eventVotes: Votes = Object.fromEntries(eventEvaluators.map((evaluator) => [evaluator.token, votes[evaluator.token] ?? {}]));
  const evaluatorNames = Object.fromEntries(eventEvaluators.map((evaluator) => [evaluator.token, evaluator.name]));
  const ranking = computeRanking(selectedEvent.projects, eventVotes, evaluatorNames);
  const highestTotal = ranking[0]?.total || 1;
  const votedEvaluatorCount = eventEvaluators.filter((evaluator) => votes[evaluator.token]).length;

  const saveProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !projectForm || !projectForm.name.trim()) return;
    const projects: Project[] = projectForm.id
      ? selectedEvent.projects.map((project) => project.id === projectForm.id ? { ...project, ...projectForm, id: project.id } : project)
      : [...selectedEvent.projects, { ...projectForm, id: crypto.randomUUID() }];
    store.saveEventProjects(selectedEvent.id, projects);
    toast.success(projectForm.id ? "Projeto atualizado" : "Projeto cadastrado");
    setProjectForm(null);
  };

  const removeProject = (id: string) => {
    if (!selectedEvent) return;
    if (confirm("Excluir este projeto?")) {
      store.saveEventProjects(selectedEvent.id, selectedEvent.projects.filter((project) => project.id !== id));
    }
  };

  const saveEventSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const investmentLimit = parseInvestmentLimit(eventSettings.investmentLimit);
    if (!selectedEvent || !eventSettings.name.trim()) return;
    if (investmentLimit === null) {
      toast.error("Informe um teto válido, usando até duas casas decimais.");
      return;
    }
    if (!eventSettings.startDate || !eventSettings.endDate || eventSettings.startDate > eventSettings.endDate) {
      toast.error("Informe datas válidas para o evento.");
      return;
    }
    store.saveEvent({
      ...selectedEvent,
      name: eventSettings.name.trim(),
      description: eventSettings.description.trim(),
      startDate: eventSettings.startDate,
      endDate: eventSettings.endDate,
      investmentLimit,
    });
    toast.success("Configurações do evento salvas");
  };

  const createEvaluatorLink = (e: React.FormEvent) => {
    e.preventDefault();
    const name = evaluatorName.trim();
    if (!selectedEvent || !name) return;
    store.createEvaluator(name, selectedEvent.id);
    setEvaluatorName("");
    toast.success(`Convite criado para ${name}`);
  };

  const copyEvaluatorLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/avaliar?token=${encodeURIComponent(token)}`);
      toast.success("Link individual copiado!");
    } catch (error) {
      console.error("Não foi possível copiar o link do avaliador.", error);
      toast.error("Não foi possível copiar o link. Verifique a permissão da área de transferência.");
    }
  };

  return (
    <div className={`${darkMode ? "dark" : ""} min-h-screen bg-background text-foreground`}>
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <button type="button" onClick={() => nav({ to: "/admin" })} className="rounded-lg border px-2.5 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground sm:px-3 sm:text-sm">
              Voltar aos eventos
            </button>
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
          <section className="rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
            <p className="text-sm font-semibold uppercase tracking-wider text-orange-600 dark:text-[#f97316]">Evento</p>
            <h1 className="mt-1 break-words font-display text-2xl font-bold sm:text-3xl">{selectedEvent.name}</h1>
            {selectedEvent.description && <p className="mt-2 text-muted-foreground">{selectedEvent.description}</p>}
            <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${
              getEventStatus(selectedEvent) === "active" ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" :
              getEventStatus(selectedEvent) === "expired" ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" :
              "bg-muted text-muted-foreground"
            }`}>
              {getEventStatus(selectedEvent) === "active" ? "Em andamento" :
                getEventStatus(selectedEvent) === "expired" ? "Expirado" :
                  getEventStatus(selectedEvent) === "upcoming" ? "Agendado" : "Datas pendentes"}
            </span>
            <p className="mt-2 text-sm text-muted-foreground">Período: {selectedEvent.startDate || "—"} a {selectedEvent.endDate || "—"}</p>
            <p className="mt-3 text-sm text-muted-foreground">Teto individual por projeto: <strong className="text-foreground">{formatBRL(selectedEvent.investmentLimit)}</strong></p>
          </section>
          <section className="rounded-xl border bg-card p-5 shadow-soft sm:p-6">
            <h2 className="mb-4 font-display text-lg font-bold">Configurações do evento</h2>
            <form onSubmit={saveEventSettings} className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium">Nome do evento
                <input required value={eventSettings.name} onChange={(e) => setEventSettings({ ...eventSettings, name: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring" />
              </label>
              <label className="space-y-1.5 text-sm font-medium">Teto por projeto (R$)
                <input
                  required
                  type="text"
                  inputMode="decimal"
                  value={eventSettings.investmentLimit}
                  onChange={(e) => setEventSettings({ ...eventSettings, investmentLimit: e.target.value })}
                  onFocus={() => {
                    const value = parseInvestmentLimit(eventSettings.investmentLimit);
                    if (value !== null) setEventSettings((current) => ({ ...current, investmentLimit: String(value) }));
                  }}
                  onBlur={() => {
                    const value = parseInvestmentLimit(eventSettings.investmentLimit);
                    if (value !== null) setEventSettings((current) => ({ ...current, investmentLimit: formatBRL(value) }));
                  }}
                  className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium">Data de início
                <input required type="date" value={eventSettings.startDate} onChange={(e) => setEventSettings({ ...eventSettings, startDate: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring" />
              </label>
              <label className="space-y-1.5 text-sm font-medium">Data de término
                <input required type="date" min={eventSettings.startDate || undefined} value={eventSettings.endDate} onChange={(e) => setEventSettings({ ...eventSettings, endDate: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring" />
              </label>
              <label className="space-y-1.5 text-sm font-medium md:col-span-2">Descrição
                <textarea rows={2} value={eventSettings.description} onChange={(e) => setEventSettings({ ...eventSettings, description: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring" />
              </label>
              <button className="bg-brand flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-semibold text-primary-foreground md:col-span-2 sm:justify-self-end">
                <Save className="h-4 w-4" /> Salvar configurações
              </button>
            </form>
          </section>
            <section className="grid gap-4 sm:grid-cols-3">
              <Stat label="Projetos no evento" value={selectedEvent.projects.length} />
              <Stat label="Avaliadores convidados" value={eventEvaluators.length} />
              <Stat label="Avaliações recebidas" value={votedEvaluatorCount} />
            </section>

            <section className="rounded-xl border bg-card p-5 shadow-soft sm:p-6">
              <h2 className="mb-4 flex items-start gap-2 font-display text-lg font-bold sm:text-xl"><Trophy className="mt-1 h-5 w-5 shrink-0 text-orange-500" /> <span className="break-words">Ranking Geral · {selectedEvent.name}</span></h2>
              {ranking.length === 0 ? <p className="text-muted-foreground">Cadastre projetos para ver o ranking deste evento.</p> : (
                <ol className="space-y-5">
                  {ranking.map((result, index) => (
                    <li key={result.project.id} className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0 break-words font-semibold"><span className={`mr-2 inline-grid h-7 w-7 place-items-center rounded-full text-sm ${index === 0 ? "bg-accent-grad text-accent-foreground" : "bg-secondary text-secondary-foreground"}`}>{index + 1}</span>{result.project.name}</span>
                        <span className="shrink-0 font-display font-bold text-primary">{formatBRL(result.total)}</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="bg-brand h-full rounded-full transition-all" style={{ width: `${(result.total / highestTotal) * 100}%` }} /></div>
                      {result.breakdown.length > 0 && (
                        <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Ver aportes por avaliador ({result.breakdown.length})</summary>
                          <ul className="mt-2 grid gap-1 sm:grid-cols-2">{result.breakdown.map((item, index) => <li key={`${item.evaluator}-${index}`} className="flex justify-between rounded-md bg-muted px-3 py-1.5"><span>{item.evaluator}</span><span className="font-medium">{formatBRL(item.amount)}</span></li>)}</ul>
                        </details>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="rounded-xl border bg-card p-5 shadow-soft sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="font-display text-xl font-bold">Projetos · {selectedEvent.name}</h2><p className="mt-1 text-sm text-muted-foreground">Orçamento individual: {formatBRL(selectedEvent.investmentLimit)} por projeto.</p></div>
                <button onClick={() => setProjectForm(emptyProject)} className="bg-brand flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> Novo projeto</button>
              </div>
              {selectedEvent.projects.length === 0 ? <p className="py-5 text-center text-sm text-muted-foreground">Ainda não há projetos neste evento.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-muted-foreground"><tr><th className="py-2">Projeto</th><th>Equipe</th><th className="hidden md:table-cell">Descrição</th><th /></tr></thead>
                    <tbody>{selectedEvent.projects.map((project) => (
                      <tr key={project.id} className="border-t align-top">
                        <td className="py-3 font-semibold">{project.name}</td><td className="py-3">{project.members}</td><td className="hidden max-w-xs truncate py-3 text-muted-foreground md:table-cell">{project.description}</td>
                        <td className="whitespace-nowrap py-3 text-right">
                          <button onClick={() => setProjectForm(project)} aria-label={`Editar ${project.name}`} className="p-1.5 text-muted-foreground hover:text-primary"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => removeProject(project.id)} aria-label={`Excluir ${project.name}`} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-xl border bg-card p-5 shadow-soft sm:p-6">
              <div className="mb-4">
                <h2 className="font-display text-xl font-bold">Links individuais dos avaliadores</h2>
                <p className="mt-1 text-sm text-muted-foreground">Cada convite só acessa os projetos de {selectedEvent.name}.</p>
              </div>
              <form onSubmit={createEvaluatorLink} className="mb-5 flex flex-col gap-2 sm:flex-row">
                <input required value={evaluatorName} onChange={(e) => setEvaluatorName(e.target.value)} placeholder="Nome do avaliador" aria-label="Nome do novo avaliador" className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring" />
                <button className="bg-brand flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-semibold text-primary-foreground"><Link2 className="h-4 w-4" /> Gerar link para novo avaliador</button>
              </form>
              {eventEvaluators.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum avaliador convidado neste evento.</p> : (
                <ul className="space-y-2">
                  {eventEvaluators.map((evaluator) => (
                    <li key={evaluator.token} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background px-4 py-3">
                      <div className="min-w-0"><p className="truncate font-semibold">{evaluator.name}</p><p className="truncate text-xs text-muted-foreground">/avaliar?token={evaluator.token}</p></div>
                      <button type="button" onClick={() => copyEvaluatorLink(evaluator.token)} className="flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition hover:border-primary hover:text-primary"><Copy className="h-4 w-4" /> Copiar link</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
      </main>

      {projectForm && selectedEvent && (
        <div className="fixed inset-0 z-20 grid place-items-center overflow-y-auto bg-foreground/40 px-4 py-8">
          <form onSubmit={saveProject} className="w-full max-w-md space-y-4 rounded-2xl bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold">{projectForm.id ? "Editar projeto" : "Novo projeto"}</h2><button type="button" onClick={() => setProjectForm(null)} aria-label="Fechar"><X className="h-5 w-5" /></button></div>
            <p className="text-sm text-muted-foreground">Evento: {selectedEvent.name}</p>
            <label className="block space-y-1 text-sm font-medium">Nome do projeto<input required value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" /></label>
            <label className="block space-y-1 text-sm font-medium">Nomes dos integrantes<input value={projectForm.members} onChange={(e) => setProjectForm({ ...projectForm, members: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" /></label>
            <label className="block space-y-1 text-sm font-medium">Descrição<textarea rows={4} value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" /></label>
            <button className="bg-brand w-full rounded-lg py-2.5 font-semibold text-primary-foreground">Salvar projeto</button>
          </form>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border bg-card p-5 shadow-soft"><p className="text-sm text-muted-foreground">{label}</p><p className="font-display text-3xl font-bold text-primary">{value}</p></div>;
}
