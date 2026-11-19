import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Link2, LogOut, Moon, Pencil, Plus, Sun, Trash2, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { EventForm, type EventFormValues } from "@/components/EventForm";
import { Logo } from "@/components/Logo";
import { ProjectFileField } from "@/components/ProjectFileField";
import { deleteFile, migrateLocalFilesToCloud, type StoredFile } from "@/lib/files";
import { computeRanking, evaluateProject, formatBRL, fromCents, store, toCents, useStore, type Evaluator, type Project, type Votes } from "@/lib/store";

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

type ProjectForm = { id?: string; name: string; members: string; description: string; prototypeUrl: string; presentationUrl: string; prototypeFile?: StoredFile | undefined; presentationFile?: StoredFile | undefined };
const emptyProject: ProjectForm = { name: "", members: "", description: "", prototypeUrl: "", presentationUrl: "" };
function Admin() {
  const nav = useNavigate();
  const { eventId } = Route.useParams();
  const { ready, isAdmin, events, votes, evaluators, scoreSheets } = useStore();
  const [projectForm, setProjectForm] = useState<ProjectForm | null>(null);
  const [evaluatorName, setEvaluatorName] = useState("");
  const [deletingEvaluator, setDeletingEvaluator] = useState<Evaluator | null>(null);
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
  useEffect(() => {
    if (ready && isAdmin) void migrateLocalFilesToCloud();
  }, [ready, isAdmin]);
  const selectedEvent = events.find((event) => event.id === eventId);
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
  const scoreDetails = (projectId: string) => {
    const sheets = eventEvaluators
      .map((evaluator) => ({ evaluator, sheet: scoreSheets[evaluator.token]?.[projectId] }))
      .filter((item): item is { evaluator: Evaluator; sheet: NonNullable<typeof item.sheet> } => Boolean(item.sheet))
      .map((item) => ({ ...item, result: evaluateProject(selectedEvent.competencies, item.sheet) }));
    if (sheets.length === 0) return null;
    const average = (values: number[]) => fromCents(Math.round(values.reduce((sum, value) => sum + toCents(value), 0) / values.length));
    return {
      sheets,
      averageAmount: average(sheets.map((item) => item.result.amount)),
      byCompetency: selectedEvent.competencies.map((competency, index) => ({
        competency,
        average: average(sheets.map((item) => item.result.items[index]!.amount)),
      })),
    };
  };
  // Remonta o formulário quando o evento salvo muda, para refletir os dados persistidos.
  const settingsKey = JSON.stringify([selectedEvent.name, selectedEvent.description, selectedEvent.investmentLimit, selectedEvent.competencies]);
  const saveEventSettings = (values: EventFormValues) => {
    try {
      store.saveEvent({ ...selectedEvent, ...values });
      toast.success("Configurações do evento salvas. Os valores investidos foram recalculados.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar as configurações.");
    }
  };

  const saveProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !projectForm || !projectForm.name.trim()) return;
    const projectDetails = {
      name: projectForm.name.trim(),
      members: projectForm.members.trim(),
      description: projectForm.description.trim(),
      prototypeUrl: projectForm.prototypeUrl.trim(),
      presentationUrl: projectForm.presentationUrl.trim(),
      prototypeFile: projectForm.prototypeFile,
      presentationFile: projectForm.presentationFile,
    };
    const previous = selectedEvent.projects.find((project) => project.id === projectForm.id);
    const projects: Project[] = previous
      ? selectedEvent.projects.map((project) => project.id === previous.id ? { ...project, ...projectDetails, id: project.id } : project)
      : [...selectedEvent.projects, { ...projectDetails, id: crypto.randomUUID() }];
    for (const old of [previous?.prototypeFile, previous?.presentationFile]) {
      if (old && old.id !== projectDetails.prototypeFile?.id && old.id !== projectDetails.presentationFile?.id) void deleteFile(old);
    }
    store.saveEventProjects(selectedEvent.id, projects);
    toast.success(projectForm.id ? "Projeto atualizado" : "Projeto cadastrado");
    setProjectForm(null);
  };

  const removeProject = (id: string) => {
    if (!selectedEvent) return;
    if (confirm("Excluir este projeto?")) {
      const removed = selectedEvent.projects.find((project) => project.id === id);
      store.saveEventProjects(selectedEvent.id, selectedEvent.projects.filter((project) => project.id !== id));
      for (const file of [removed?.prototypeFile, removed?.presentationFile]) if (file) void deleteFile(file);
    }
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

  const deleteEvaluator = () => {
    if (!deletingEvaluator) return;
    try {
      store.deleteEvaluator(deletingEvaluator.token);
      toast.success(`Link de ${deletingEvaluator.name} revogado.`);
      setDeletingEvaluator(null);
    } catch (error) {
      console.error("Não foi possível revogar o link do avaliador.", error);
      toast.error("Não foi possível revogar este link. Atualize a página e tente novamente.");
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

      <main className="mx-auto max-w-6xl space-y-7 px-4 py-6 sm:py-8">
          <section className="rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
            <p className="text-sm font-semibold uppercase tracking-wider text-orange-600 dark:text-[#f97316]">Evento</p>
            <h1 className="mt-1 break-words font-display text-2xl font-bold sm:text-3xl">{selectedEvent.name}</h1>
            {selectedEvent.description && <p className="mt-2 text-muted-foreground">{selectedEvent.description}</p>}
            <span className="mt-3 inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800 dark:bg-green-900/40 dark:text-green-300">Ativo</span>
            <p className="mt-3 text-sm text-muted-foreground">Teto individual por projeto: <strong className="text-foreground">{formatBRL(selectedEvent.investmentLimit)}</strong></p>
          </section>
          <section className="rounded-xl border bg-card p-5 shadow-soft sm:p-6">
            <h2 className="mb-4 font-display text-lg font-bold">Configurações do Evento</h2>
            <EventForm key={settingsKey} event={selectedEvent} submitLabel="Salvar Configurações" onSubmit={saveEventSettings} />
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
                      {(() => {
                        const details = scoreDetails(result.project.id);
                        if (!details) return null;
                        return (
                          <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Média investida {formatBRL(details.averageAmount)} · ver por competência</summary>
                            <ul className="mt-2 grid gap-1 sm:grid-cols-2">{details.byCompetency.map(({ competency, average }) => <li key={competency.id} className="flex justify-between gap-2 rounded-md bg-muted px-3 py-1.5"><span className="min-w-0 truncate">{competency.name}</span><span className="shrink-0 font-medium tabular-nums">{formatBRL(average)} / {formatBRL(competency.maxAmount)}</span></li>)}</ul>
                            <ul className="mt-3 space-y-2">{details.sheets.map(({ evaluator, sheet, result: evaluation }) => (
                              <li key={evaluator.token} className="rounded-md border px-3 py-2">
                                <p className="flex flex-wrap justify-between gap-2 font-semibold"><span>{evaluator.name}</span><span className="tabular-nums">{formatBRL(evaluation.amount)} / {formatBRL(evaluation.maxAmount)}</span></p>
                                {evaluation.items.some((item) => sheet.justifications[item.competency.id]) && (
                                  <ul className="mt-1 space-y-0.5 text-muted-foreground">{evaluation.items.filter((item) => sheet.justifications[item.competency.id]).map((item) => <li key={item.competency.id}><strong className="text-foreground">{item.competency.name} ({formatBRL(item.amount)} / {formatBRL(item.competency.maxAmount)}):</strong> {sheet.justifications[item.competency.id]}</li>)}</ul>
                                )}
                                {sheet.opinion && <p className="mt-1 italic text-muted-foreground">Parecer: {sheet.opinion}</p>}
                              </li>
                            ))}</ul>
                          </details>
                        );
                      })()}
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
                <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 [-webkit-overflow-scrolling:touch]">
                  <table className="w-full text-left text-sm">
                    <thead className="text-muted-foreground"><tr><th className="py-2">Projeto</th><th className="hidden sm:table-cell">Equipe</th><th className="hidden md:table-cell">Descrição</th><th /></tr></thead>
                    <tbody>{selectedEvent.projects.map((project) => (
                      <tr key={project.id} className="border-t align-top">
                        <td className="break-words py-3 pr-2 font-semibold">{project.name}<span className="block text-xs font-normal text-muted-foreground sm:hidden">{project.members}</span></td><td className="hidden py-3 sm:table-cell">{project.members}</td><td className="hidden max-w-xs truncate py-3 text-muted-foreground md:table-cell">{project.description}</td>
                        <td className="whitespace-nowrap py-3 text-right">
                          <button onClick={() => setProjectForm({ id: project.id, name: project.name, members: project.members, description: project.description, prototypeUrl: project.prototypeUrl ?? "", presentationUrl: project.presentationUrl ?? "", prototypeFile: project.prototypeFile, presentationFile: project.presentationFile })} aria-label={`Editar ${project.name}`} className="p-1.5 text-muted-foreground hover:text-primary"><Pencil className="h-4 w-4" /></button>
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
                    <li key={evaluator.token} className="flex flex-col gap-3 rounded-lg border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0"><p className="truncate font-semibold">{evaluator.name}</p><p className="break-all text-xs text-muted-foreground sm:truncate">Link: /avaliar?token={evaluator.token}</p></div>
                      <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
                        <button type="button" onClick={() => copyEvaluatorLink(evaluator.token)} className="flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 sm:flex-none text-sm font-semibold transition hover:border-primary hover:text-primary"><Copy className="h-4 w-4" /> Copiar link</button>
                        <button type="button" onClick={() => setDeletingEvaluator(evaluator)} aria-label={`Excluir link de ${evaluator.name}`} className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition hover:border-red-400 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"><Trash2 className="h-4 w-4" /><span className="hidden sm:inline">Excluir</span></button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
      </main>

      {projectForm && selectedEvent && (
        <div className="fixed inset-0 z-20 grid place-items-center overflow-y-auto overscroll-contain bg-foreground/40 px-3 py-6 sm:px-4 sm:py-8">
          <form onSubmit={saveProject} className="w-full max-w-md space-y-4 rounded-2xl bg-card p-5 shadow-soft sm:p-6">
            <div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold">{projectForm.id ? "Editar projeto" : "Novo projeto"}</h2><button type="button" onClick={() => setProjectForm(null)} aria-label="Fechar"><X className="h-5 w-5" /></button></div>
            <p className="text-sm text-muted-foreground">Evento: {selectedEvent.name}</p>
            <label className="block space-y-1 text-sm font-medium">Nome do projeto<input required value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" /></label>
            <label className="block space-y-1 text-sm font-medium">Nomes dos integrantes<input value={projectForm.members} onChange={(e) => setProjectForm({ ...projectForm, members: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" /></label>
            <label className="block space-y-1 text-sm font-medium">Descrição<textarea rows={4} value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" /></label>
            <fieldset className="space-y-2 rounded-lg border p-3">
              <legend className="px-1 text-sm font-semibold">Protótipo (opcional)</legend>
              <ProjectFileField label="Arquivo" value={projectForm.prototypeFile} onChange={(file) => setProjectForm((form) => form && { ...form, prototypeFile: file })} />
              <label className="block space-y-1 text-sm font-medium">Link<input type="url" value={projectForm.prototypeUrl} onChange={(e) => setProjectForm({ ...projectForm, prototypeUrl: e.target.value })} placeholder="https://..." className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" /></label>
            </fieldset>
            <fieldset className="space-y-2 rounded-lg border p-3">
              <legend className="px-1 text-sm font-semibold">Apresentação / Slides (opcional)</legend>
              <ProjectFileField label="Arquivo" value={projectForm.presentationFile} onChange={(file) => setProjectForm((form) => form && { ...form, presentationFile: file })} />
              <label className="block space-y-1 text-sm font-medium">Link<input type="url" value={projectForm.presentationUrl} onChange={(e) => setProjectForm({ ...projectForm, presentationUrl: e.target.value })} placeholder="https://..." className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" /></label>
            </fieldset>
            <button className="bg-brand w-full rounded-lg py-2.5 font-semibold text-primary-foreground">Salvar projeto</button>
          </form>
        </div>
      )}
      {deletingEvaluator && (
        <div className="fixed inset-0 z-30 grid place-items-center overflow-y-auto overscroll-contain bg-foreground/50 px-4 py-6">
          <section role="alertdialog" aria-modal="true" aria-labelledby="delete-evaluator-title" className="w-full max-w-md space-y-4 rounded-xl bg-card p-6 shadow-soft">
            <h2 id="delete-evaluator-title" className="font-display text-lg font-bold">Revogar link do avaliador</h2>
            <p className="text-sm text-muted-foreground">Deseja realmente remover este avaliador e invalidar o seu link?</p>
            <p className="text-sm font-semibold">{deletingEvaluator.name}</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button type="button" onClick={() => setDeletingEvaluator(null)} className="rounded-lg border px-4 py-2 text-sm font-semibold">Cancelar</button>
              <button type="button" onClick={deleteEvaluator} className="flex items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground"><Trash2 className="h-4 w-4" /> Revogar link</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border bg-card p-5 shadow-soft"><p className="text-sm text-muted-foreground">{label}</p><p className="font-display text-3xl font-bold text-primary">{value}</p></div>;
}
