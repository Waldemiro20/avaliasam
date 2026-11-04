import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertCircle, ArrowRight, Ban, Sparkles } from "lucide-react";
import { getInvitation, getVotingContext, startEvaluatorSession } from "@/api/evaluator";
import { AuthLayout } from "@/components/AuthLayout";
import { ERR, errorMessage } from "@/lib/api-errors";
import { evaluatorTokenSchema } from "@/lib/schemas";

type State =
  | { kind: "checking" }
  | { kind: "invalid" }
  | { kind: "revoked" }
  | { kind: "error"; message: string }
  | { kind: "valid"; token: string; eventName: string; evaluatorName: string };

export function RevokedLinkNotice() {
  return (
    <div
      role="alert"
      className="space-y-3 rounded-3xl border border-orange-200 bg-white p-7 text-center shadow-xl shadow-slate-900/5 sm:p-9"
    >
      <Ban className="mx-auto h-8 w-8 text-orange-600" />
      <h2 className="font-display text-xl font-bold text-slate-900">Link indisponível</h2>
      <p className="text-sm leading-6 text-slate-600">{ERR.revoked}</p>
    </div>
  );
}

export function EvaluatorAccess() {
  const nav = useNavigate();
  const [state, setState] = useState<State>({ kind: "checking" });
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const rawToken = new URLSearchParams(window.location.search).get("token");

    const check = async (): Promise<State> => {
      if (!rawToken) {
        // Sem token na URL: se já houver sessão válida, segue para a votação.
        const context = await getVotingContext();
        if (context.status === "ok") {
          await nav({ to: "/avaliar/votacao", replace: true });
          return { kind: "checking" };
        }
        return context.status === "revoked" ? { kind: "revoked" } : { kind: "invalid" };
      }
      const token = evaluatorTokenSchema.safeParse(rawToken);
      if (!token.success) return { kind: "invalid" };
      // A validade do token é decidida exclusivamente pelo servidor.
      const invitation = await getInvitation({ data: { token: token.data } });
      if (invitation.status === "valid") {
        return {
          kind: "valid",
          token: token.data,
          eventName: invitation.eventName,
          evaluatorName: invitation.evaluatorName,
        };
      }
      return { kind: invitation.status };
    };

    check()
      .then((next) => !cancelled && setState(next))
      .catch((error) => !cancelled && setState({ kind: "error", message: errorMessage(error) }));
    return () => {
      cancelled = true;
    };
  }, [nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state.kind !== "valid" || pending) return;
    const evaluatorName = name.trim();
    if (!evaluatorName) return;
    setPending(true);
    try {
      await startEvaluatorSession({ data: { token: state.token, name: evaluatorName } });
      // Remove o token da barra de endereços/histórico após trocar por sessão.
      window.history.replaceState(null, "", "/avaliar");
      await nav({ to: "/avaliar/votacao" });
    } catch (error) {
      const message = errorMessage(error);
      if (message === ERR.revoked) setState({ kind: "revoked" });
      else setNameError(message);
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout>
      {state.kind === "checking" ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-9 text-center text-slate-600 shadow-xl">
          Validando link do avaliador...
        </div>
      ) : state.kind === "revoked" ? (
        <RevokedLinkNotice />
      ) : state.kind === "invalid" || state.kind === "error" ? (
        <div
          role="alert"
          className="space-y-3 rounded-3xl border border-orange-200 bg-white p-7 text-center shadow-xl shadow-slate-900/5 sm:p-9"
        >
          <AlertCircle className="mx-auto h-8 w-8 text-orange-600" />
          <h2 className="font-display text-xl font-bold text-slate-900">
            {state.kind === "invalid"
              ? "Link de avaliador inválido"
              : "Não foi possível validar o link"}
          </h2>
          <p className="text-sm leading-6 text-slate-600">
            {state.kind === "invalid"
              ? "Peça ao administrador um link individual válido para acessar a votação."
              : state.message}
          </p>
        </div>
      ) : (
        <form
          onSubmit={submit}
          className="space-y-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5 sm:p-9"
        >
          <div className="text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-orange-50 text-orange-600">
              <Sparkles className="h-6 w-6" />
            </span>
            <h2 className="mt-4 font-display text-2xl font-bold tracking-tight text-slate-900">
              Área do Avaliador VIP
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Confirme seu nome para iniciar as avaliações
            </p>
            <p className="mt-2 text-sm font-semibold text-orange-700">{state.eventName}</p>
          </div>
          <label className="block text-left text-sm font-semibold text-slate-700">
            Seu Nome Completo
            <input
              autoFocus
              required
              maxLength={120}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError("");
              }}
              placeholder={state.evaluatorName}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
            />
            {nameError && (
              <span role="alert" className="mt-1 block text-xs font-medium text-red-600">
                {nameError}
              </span>
            )}
          </label>
          <button
            disabled={!name.trim() || pending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 font-semibold text-white shadow-lg shadow-orange-700/15 transition hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Entrando..." : "Entrar na Sala de Votação"}{" "}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
