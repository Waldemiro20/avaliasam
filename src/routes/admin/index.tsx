import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, LogOut, Pencil, Plus, Trash2, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { computeRanking, formatBRL, store, useStore, type Project } from "@/lib/store";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Painel do Administrador | AvaliaSAM" },
      { name: "description", content: "Gerencie projetos, compartilhe o link de avaliação e acompanhe o ranking." },
      { property: "og:title", content: "Painel do Administrador | AvaliaSAM" },
      { property: "og:description", content: "Gestão de projetos e ranking consolidado." },
    ],
  }),
  component: Admin,
});

const empty = { name: "", members: "", description: "" };

function Admin() {
  const nav = useNavigate();
  const { ready, isAdmin, projects, votes } = useStore();
  const [form, setForm] = useState<(typeof empty & { id?: string }) | null>(null);

  useEffect(() => { if (ready && !isAdmin) nav({ to: "/admin/login" }); }, [ready, isAdmin, nav]);
  if (!ready || !isAdmin) return null;

  const ranking = computeRanking(projects, votes);
  const top = ranking[0]?.total || 1;
  const evaluators = Object.keys(votes).length;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !form.name.trim()) return;
    const next: Project[] = form.id
      ? projects.map((p) => (p.id === form.id ? { ...p, ...form, id: p.id } : p))
      : [...projects, { ...form, id: crypto.randomUUID() }];
    store.saveProjects(next);
    toast.success(form.id ? "Projeto atualizado" : "Projeto cadastrado");
    setForm(null);
  };
  const remove = (id: string) => {
    if (confirm("Excluir este projeto?")) store.saveProjects(projects.filter((p) => p.id !== id));
  };
  const copyLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/avaliar`);
    toast.success("Link copiado!");
  };

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Logo />
          <button onClick={() => { store.setAdmin(false); nav({ to: "/admin/login", replace: true }); }} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><LogOut className="h-4 w-4" /> Sair</button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Projetos" value={projects.length} />
          <Stat label="Avaliadores" value={evaluators} />
          <div className="bg-accent-grad flex flex-col justify-between gap-3 rounded-xl p-5 text-accent-foreground shadow-soft">
            <p className="text-sm font-medium opacity-90">Link para jurados</p>
            <button onClick={copyLink} className="flex items-center justify-center gap-2 rounded-lg bg-card py-2 font-semibold text-accent-deep"><Copy className="h-4 w-4" /> Copiar Link de Avaliação</button>
          </div>
        </div>

        <section className="rounded-xl border bg-card p-6 shadow-soft">
          <h2 className="mb-5 flex items-center gap-2 font-display text-xl font-bold"><Trophy className="h-5 w-5 text-accent" /> Ranking Geral</h2>
          {ranking.length === 0 ? <p className="text-muted-foreground">Cadastre projetos para ver o ranking.</p> : (
            <ol className="space-y-4">
              {ranking.map((r, i) => (
                <li key={r.project.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold"><span className={`mr-2 inline-grid h-7 w-7 place-items-center rounded-full text-sm ${i === 0 ? "bg-accent-grad text-accent-foreground" : "bg-secondary text-secondary-foreground"}`}>{i + 1}</span>{r.project.name}</span>
                    <span className="font-display font-bold text-primary">{formatBRL(r.total)}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="bg-brand h-full rounded-full transition-all" style={{ width: `${(r.total / top) * 100}%` }} /></div>
                  {r.breakdown.length > 0 && (
                    <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Ver investimentos por avaliador ({r.breakdown.length})</summary>
                      <ul className="mt-2 grid gap-1 sm:grid-cols-2">{r.breakdown.map((b) => <li key={b.evaluator} className="flex justify-between rounded-md bg-muted px-3 py-1.5"><span>{b.evaluator}</span><span className="font-medium">{formatBRL(b.amount)}</span></li>)}</ul>
                    </details>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-xl border bg-card p-6 shadow-soft">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Projetos / Startups</h2>
            <button onClick={() => setForm(empty)} className="bg-brand flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> Novo Projeto</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground"><tr><th className="py-2">Nome</th><th>Integrantes</th><th className="hidden md:table-cell">Descrição</th><th /></tr></thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-t align-top">
                    <td className="py-3 font-semibold">{p.name}</td>
                    <td className="py-3">{p.members}</td>
                    <td className="hidden max-w-xs truncate py-3 text-muted-foreground md:table-cell">{p.description}</td>
                    <td className="whitespace-nowrap py-3 text-right">
                      <button onClick={() => setForm(p)} aria-label="Editar" className="p-1.5 text-muted-foreground hover:text-primary"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remove(p.id)} aria-label="Excluir" className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
                {projects.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">Nenhum projeto ainda.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {form && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-foreground/40 px-4">
          <form onSubmit={save} className="w-full max-w-md space-y-4 rounded-xl bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between"><h3 className="font-display text-lg font-bold">{form.id ? "Editar Projeto" : "Cadastrar Novo Projeto"}</h3><button type="button" onClick={() => setForm(null)}><X className="h-5 w-5" /></button></div>
            {([["name", "Nome da Startup/Equipe"], ["members", "Nome dos Integrantes"]] as const).map(([k, l]) => (
              <label key={k} className="block space-y-1 text-sm font-medium">{l}<input required={k === "name"} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" /></label>
            ))}
            <label className="block space-y-1 text-sm font-medium">Descrição do Projeto<textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" /></label>
            <button className="bg-brand w-full rounded-lg py-2.5 font-semibold text-primary-foreground">Salvar</button>
          </form>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border bg-card p-5 shadow-soft"><p className="text-sm text-muted-foreground">{label}</p><p className="font-display text-3xl font-bold text-primary">{value}</p></div>;
}
