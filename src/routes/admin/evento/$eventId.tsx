import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pencil, Plus, Save, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { deleteProject, getEventDetail, updateEvent } from "@/api/admin";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { EvaluatorsSection } from "@/components/admin/EvaluatorsSection";
import { InvestmentLimitInput } from "@/components/admin/InvestmentLimitInput";
import { ProjectFormModal } from "@/components/admin/ProjectFormModal";
import { emptyProject, type ProjectFormValue } from "@/components/admin/project-form";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ProjectLinks } from "@/components/ProjectLinks";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { errorMessage } from "@/lib/api-errors";
import { formatBRL, parseInvestmentLimit } from "@/lib/investment";
import { requireAdminRoute } from "@/lib/route-guards";
import { eventInput } from "@/lib/schemas";

export const Route = createFileRoute("/admin/evento/$eventId")({
  head: () => ({
    meta: [
      { title: "Painel do Administrador | AvaliaSAM" },
      { name: "description", content: "Gerencie eventos, projetos, avaliadores e ranking." },
      { property: "og:title", content: "Painel do Administrador | AvaliaSAM" },
      { property: "og:description", content: "Gestão de eventos, projetos e ranking consolidado." },
    ],
  }),
  beforeLoad: requireAdminRoute,
  component: Admin,
});

type Detail = NonNullable<Awaited<ReturnType<typeof getEventDetail>>>;
type ProjectRow = Detail["projects"][number];

function Admin() {
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const { eventId } = Route.useParams();
  const [darkMode, setDarkMode] = useDarkMode();
  const [projectForm, setProjectForm] = useState<ProjectFormValue | null>(null);
  const [deletingProject, setDeletingProject] = useState<ProjectRow | null>(null);
  const [eventSettings, setEventSettings] = useState({
    name: "",
    description: "",
    investmentLimit: "",
  });

  const detailQuery = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => getEventDetail({ data: { eventId } }),
  });
  const detail = detailQuery.data;
  const event = detail?.event;

  useEffect(() => {
    if (event)
      setEventSettings({
        name: event.name,
        description: event.description,
        investmentLimit: String(event.investmentLimit),
      });
    // `event` mantém a mesma referência entre refetches sem mudança (structural sharing do React Query).
  }, [event]);

  useEffect(() => {
    if (detailQuery.isSuccess && detail === null) {
      toast.error("Evento não encontrado.");
      void nav({ to: "/admin", replace: true });
    }
  }, [detailQuery.isSuccess, detail, nav]);

  const settingsMutation = useMutation({
    mutationFn: (data: {
      id: string;
      name: string;
      description: string;
      investmentLimit: number;
    }) => updateEvent({ data }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Configurações do evento salvas");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (project: ProjectRow) => deleteProject({ data: { id: project.id } }),
    onSuccess: async (_, project) => {
      await queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success(`Projeto "${project.name}" excluído.`);
      setDeletingProject(null);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const header = (
    <AdminHeader darkMode={darkMode} onToggleDarkMode={() => setDarkMode((enabled) => !enabled)}>
      <button
        type="button"
        onClick={() => nav({ to: "/admin" })}
        className="rounded-lg border px-2.5 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground sm:px-3 sm:text-sm"
      >
        Voltar aos eventos
      </button>
    </AdminHeader>
  );

  if (!detail || !event) {
    return (
      <div className={`${darkMode ? "dark" : ""} min-h-screen bg-background text-foreground`}>
        {header}
        <main className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-muted-foreground">
          {detailQuery.isError ? (
            <div role="alert" className="space-y-4">
              <p className="text-destructive">{errorMessage(detailQuery.error)}</p>
              <button
                type="button"
                onClick={() => detailQuery.refetch()}
                className="rounded-lg border px-4 py-2 font-semibold text-foreground"
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            "Carregando evento..."
          )}
        </main>
      </div>
    );
  }

  const { projects, evaluators, ranking } = detail;
  const highestTotal = ranking[0]?.total || 1;

  const saveEventSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (settingsMutation.isPending) return;
    const investmentLimit = parseInvestmentLimit(eventSettings.investmentLimit);
    if (investmentLimit === null) {
      toast.error("Informe um teto válido: número inteiro em reais, sem valores negativos.");
      return;
    }
    const parsed = eventInput.safeParse({ ...eventSettings, investmentLimit });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifique as configurações do evento.");
      return;
    }
    settingsMutation.mutate({ id: event.id, ...parsed.data });
  };

  return (
    <div className={`${darkMode ? "dark" : ""} min-h-screen bg-background text-foreground`}>
      {header}

      <main className="mx-auto max-w-6xl space-y-7 px-4 py-8">
        <section className="rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-orange-600 dark:text-[#f97316]">
            Evento
          </p>
          <h1 className="mt-1 break-words font-display text-2xl font-bold sm:text-3xl">
            {event.name}
          </h1>
          {event.description && <p className="mt-2 text-muted-foreground">{event.description}</p>}
          <p className="mt-3 text-sm text-muted-foreground">
            Teto individual por projeto:{" "}
            <strong className="text-foreground">{formatBRL(event.investmentLimit)}</strong>
          </p>
        </section>

        <section className="rounded-xl border bg-card p-5 shadow-soft sm:p-6">
          <h2 className="mb-4 font-display text-lg font-bold">Configurações do evento</h2>
          <form onSubmit={saveEventSettings} noValidate className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium">
              Nome do evento
              <input
                required
                maxLength={120}
                value={eventSettings.name}
                onChange={(e) => setEventSettings({ ...eventSettings, name: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <InvestmentLimitInput
              id="event-settings-limit"
              label="Teto de investimento por Projeto (R$)"
              value={eventSettings.investmentLimit}
              onChange={(investmentLimit) =>
                setEventSettings({ ...eventSettings, investmentLimit })
              }
            />
            <label className="space-y-1.5 text-sm font-medium md:col-span-2">
              Descrição
              <textarea
                required
                rows={2}
                maxLength={2000}
                value={eventSettings.description}
                onChange={(e) =>
                  setEventSettings({ ...eventSettings, description: e.target.value })
                }
                className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <button
              disabled={settingsMutation.isPending}
              className="bg-brand flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-semibold text-primary-foreground disabled:opacity-60 md:col-span-2 sm:justify-self-end"
            >
              <Save className="h-4 w-4" />{" "}
              {settingsMutation.isPending ? "Salvando..." : "Salvar configurações"}
            </button>
          </form>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <Stat label="Projetos no evento" value={projects.length} />
          <Stat label="Avaliadores convidados" value={evaluators.length} />
          <Stat label="Avaliações recebidas" value={detail.submittedCount} />
        </section>

        <section className="rounded-xl border bg-card p-5 shadow-soft sm:p-6">
          <h2 className="mb-4 flex items-start gap-2 font-display text-lg font-bold sm:text-xl">
            <Trophy className="mt-1 h-5 w-5 shrink-0 text-orange-500" />{" "}
            <span className="break-words">Ranking Geral · {event.name}</span>
          </h2>
          {ranking.length === 0 ? (
            <p className="text-muted-foreground">
              Cadastre projetos para ver o ranking deste evento.
            </p>
          ) : (
            <ol className="space-y-5">
              {ranking.map((result, index) => (
                <li key={result.project.id} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 break-words font-semibold">
                      <span
                        className={`mr-2 inline-grid h-7 w-7 place-items-center rounded-full text-sm ${index === 0 ? "bg-accent-grad text-accent-foreground" : "bg-secondary text-secondary-foreground"}`}
                      >
                        {index + 1}
                      </span>
                      {result.project.name}
                    </span>
                    <span className="shrink-0 font-display font-bold text-primary">
                      {formatBRL(result.total)}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="bg-brand h-full rounded-full transition-all"
                      style={{ width: `${(result.total / highestTotal) * 100}%` }}
                    />
                  </div>
                  {result.breakdown.length > 0 && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-muted-foreground">
                        Ver aportes por avaliador ({result.breakdown.length})
                      </summary>
                      <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                        {result.breakdown.map((item, i) => (
                          <li
                            key={`${item.evaluator}-${i}`}
                            className="flex justify-between gap-2 rounded-md bg-muted px-3 py-1.5"
                          >
                            <span className="min-w-0 break-words">
                              {item.evaluator}
                              {item.revoked && (
                                <span className="ml-1 text-xs text-muted-foreground">
                                  (link revogado)
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 font-medium">{formatBRL(item.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-xl border bg-card p-5 shadow-soft sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold">Projetos · {event.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Orçamento individual: {formatBRL(event.investmentLimit)} por projeto.
              </p>
            </div>
            <button
              onClick={() => setProjectForm(emptyProject)}
              className="bg-brand flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              <Plus className="h-4 w-4" /> Novo projeto
            </button>
          </div>
          {projects.length === 0 ? (
            <p className="py-5 text-center text-sm text-muted-foreground">
              Ainda não há projetos neste evento.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-2">Projeto</th>
                    <th>Equipe</th>
                    <th className="hidden md:table-cell">Descrição</th>
                    <th className="hidden lg:table-cell">Links</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr key={project.id} className="border-t align-top">
                      <td className="py-3 pr-2 font-semibold">{project.name}</td>
                      <td className="py-3 pr-2">{project.members}</td>
                      <td className="hidden max-w-xs truncate py-3 pr-2 text-muted-foreground md:table-cell">
                        {project.description}
                      </td>
                      <td className="hidden py-3 pr-2 lg:table-cell">
                        {project.prototypeUrl || project.presentationUrl ? (
                          <ProjectLinks
                            prototypeUrl={project.prototypeUrl}
                            presentationUrl={project.presentationUrl}
                            projectName={project.name}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-3 text-right">
                        <button
                          onClick={() =>
                            setProjectForm({
                              id: project.id,
                              name: project.name,
                              members: project.members,
                              description: project.description,
                              prototypeUrl: project.prototypeUrl ?? "",
                              presentationUrl: project.presentationUrl ?? "",
                            })
                          }
                          aria-label={`Editar ${project.name}`}
                          className="p-1.5 text-muted-foreground hover:text-primary"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeletingProject(project)}
                          aria-label={`Excluir ${project.name}`}
                          className="p-1.5 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <EvaluatorsSection eventId={event.id} eventName={event.name} evaluators={evaluators} />
      </main>

      {projectForm && (
        <ProjectFormModal
          key={projectForm.id ?? "new"}
          eventId={event.id}
          eventName={event.name}
          initial={projectForm}
          onClose={() => setProjectForm(null)}
        />
      )}

      {deletingProject && (
        <ConfirmDialog
          title="Excluir projeto?"
          confirmLabel="Excluir projeto"
          pending={deleteProjectMutation.isPending}
          onCancel={() => setDeletingProject(null)}
          onConfirm={() => deleteProjectMutation.mutate(deletingProject)}
        >
          Excluir <strong className="text-foreground">{deletingProject.name}</strong> também
          removerá os investimentos recebidos por ele. Esta ação não pode ser desfeita.
        </ConfirmDialog>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-soft">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-display text-3xl font-bold text-primary">{value}</p>
    </div>
  );
}
