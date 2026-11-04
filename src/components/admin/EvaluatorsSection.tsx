import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, KeyRound, Link2, RefreshCw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { createEvaluator, regenerateEvaluatorLink, revokeEvaluator } from "@/api/admin";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { errorMessage } from "@/lib/api-errors";
import { evaluatorCreateInput } from "@/lib/schemas";

export type EvaluatorRow = {
  id: string;
  name: string;
  tokenPrefix: string;
  revoked: boolean;
  submittedAt: string | null;
};

const evaluatorLink = (token: string) =>
  `${window.location.origin}/avaliar?token=${encodeURIComponent(token)}`;

export function EvaluatorsSection({
  eventId,
  eventName,
  evaluators,
}: {
  eventId: string;
  eventName: string;
  evaluators: EvaluatorRow[];
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  /** Link recém-gerado: o token só existe em texto puro neste momento. */
  const [generated, setGenerated] = useState<{ name: string; link: string } | null>(null);
  const [removing, setRemoving] = useState<EvaluatorRow | null>(null);
  const [regenerating, setRegenerating] = useState<EvaluatorRow | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["event", eventId] });

  const createMutation = useMutation({
    mutationFn: (input: { eventId: string; name: string }) => createEvaluator({ data: input }),
    onSuccess: async (result) => {
      setName("");
      setGenerated({ name: result.name, link: evaluatorLink(result.token) });
      await refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const regenerateMutation = useMutation({
    mutationFn: (evaluator: EvaluatorRow) =>
      regenerateEvaluatorLink({ data: { id: evaluator.id } }),
    onSuccess: async (result) => {
      setRegenerating(null);
      setGenerated({ name: result.name, link: evaluatorLink(result.token) });
      await refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const revokeMutation = useMutation({
    mutationFn: (evaluator: EvaluatorRow) => revokeEvaluator({ data: { id: evaluator.id } }),
    onSuccess: async (_, evaluator) => {
      setRemoving(null);
      toast.success(`Acesso de ${evaluator.name} revogado.`);
      await refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (createMutation.isPending) return;
    const parsed = evaluatorCreateInput.safeParse({ eventId, name });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Informe o nome do avaliador.");
      return;
    }
    createMutation.mutate(parsed.data);
  };

  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link individual copiado!");
    } catch (error) {
      console.error("Não foi possível copiar o link do avaliador.", error);
      toast.error("Não foi possível copiar o link. Selecione o texto e copie manualmente.");
    }
  };

  return (
    <section className="rounded-xl border bg-card p-5 shadow-soft sm:p-6">
      <div className="mb-4">
        <h2 className="font-display text-xl font-bold">Links individuais dos avaliadores</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada convite só acessa os projetos de {eventName}. Por segurança, o link completo é
          exibido apenas no momento em que é gerado.
        </p>
      </div>
      <form onSubmit={submit} noValidate className="mb-5 flex flex-col gap-2 sm:flex-row">
        <input
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do avaliador"
          aria-label="Nome do novo avaliador"
          className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          disabled={createMutation.isPending}
          className="bg-brand flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-semibold text-primary-foreground disabled:opacity-60"
        >
          <Link2 className="h-4 w-4" />{" "}
          {createMutation.isPending ? "Gerando..." : "Gerar link para novo avaliador"}
        </button>
      </form>

      {evaluators.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum avaliador convidado neste evento.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Avaliador</th>
                <th className="py-2 pr-3">Link</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {evaluators.map((evaluator) => (
                <tr key={evaluator.id} className="border-t align-middle">
                  <td className="py-3 pr-3 font-semibold">
                    <span className="break-words">{evaluator.name}</span>
                    {evaluator.submittedAt && (
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        Avaliação enviada
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    <code className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                      <KeyRound className="h-3.5 w-3.5" /> {evaluator.tokenPrefix}…
                    </code>
                  </td>
                  <td className="py-3 pr-3">
                    {evaluator.revoked ? (
                      <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800 dark:bg-red-900/40 dark:text-red-300">
                        Revogado
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800 dark:bg-green-900/40 dark:text-green-300">
                        Ativo
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-3 text-right">
                    {!evaluator.revoked && (
                      <div className="inline-flex gap-2">
                        <button
                          type="button"
                          onClick={() => setRegenerating(evaluator)}
                          title="Gerar novo link"
                          aria-label={`Gerar novo link para ${evaluator.name}`}
                          className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary hover:text-primary"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />{" "}
                          <span className="hidden sm:inline">Novo link</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemoving(evaluator)}
                          aria-label={`Excluir ${evaluator.name}`}
                          className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Excluir
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {generated && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-foreground/50 px-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="generated-link-title"
            className="w-full max-w-lg space-y-4 rounded-2xl bg-card p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="generated-link-title" className="font-display text-xl font-bold">
                Link de {generated.name}
              </h2>
              <button type="button" onClick={() => setGenerated(null)} aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              Copie e envie este link ao avaliador agora. Ele não poderá ser exibido novamente; se
              perdê-lo, gere um novo link.
            </p>
            <input
              readOnly
              value={generated.link}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Link do avaliador"
              className="w-full rounded-lg border bg-background px-3 py-2.5 font-mono text-xs"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setGenerated(null)}
                className="rounded-lg border px-4 py-2 text-sm font-semibold"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => copy(generated.link)}
                className="bg-brand flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                <Copy className="h-4 w-4" /> Copiar link
              </button>
            </div>
          </section>
        </div>
      )}

      {removing && (
        <ConfirmDialog
          title="Excluir avaliador?"
          confirmLabel="Excluir e revogar acesso"
          pending={revokeMutation.isPending}
          onCancel={() => setRemoving(null)}
          onConfirm={() => revokeMutation.mutate(removing)}
        >
          O link de <strong className="text-foreground">{removing.name}</strong> (
          <code>{removing.tokenPrefix}…</code>) será revogado imediatamente e qualquer sessão aberta
          perderá o acesso. As avaliações já enviadas por este avaliador continuam registradas no
          ranking.
        </ConfirmDialog>
      )}

      {regenerating && (
        <ConfirmDialog
          title="Gerar novo link?"
          confirmLabel="Gerar novo link"
          pending={regenerateMutation.isPending}
          onCancel={() => setRegenerating(null)}
          onConfirm={() => regenerateMutation.mutate(regenerating)}
        >
          O link atual de <strong className="text-foreground">{regenerating.name}</strong> deixará
          de funcionar e um novo link será exibido para você enviar.
        </ConfirmDialog>
      )}
    </section>
  );
}
