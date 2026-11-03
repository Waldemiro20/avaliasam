import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertCircle, ArrowRight, Sparkles } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { getEventStatus, store, type Event, type Evaluator, type EventStatus } from "@/lib/store";

const statusLabel: Record<EventStatus, string> = {
  active: "Em andamento",
  upcoming: "Agendado",
  expired: "Expirado",
  unconfigured: "Datas pendentes",
};

export function EvaluatorAccess() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [invitation, setInvitation] = useState<Evaluator | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [checked, setChecked] = useState(false);
  const [nameError, setNameError] = useState("");

  useEffect(() => {
    const invitationToken = new URLSearchParams(window.location.search).get("token") ?? "";
    const evaluatorInvitation = invitationToken ? store.getEvaluatorByToken(invitationToken) ?? null : null;
    setToken(invitationToken);
    setInvitation(evaluatorInvitation);
    setEvent(evaluatorInvitation ? store.getEvent(evaluatorInvitation.eventId) ?? null : null);
    setChecked(true);
    const refreshStatus = window.setInterval(() => {
      if (evaluatorInvitation) setEvent(store.getEvent(evaluatorInvitation.eventId) ?? null);
    }, 60_000);
    return () => window.clearInterval(refreshStatus);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const evaluatorName = name.trim();
    if (!evaluatorName) return;
    if (!invitation) return;
    const currentEvent = store.getEvent(invitation.eventId);
    if (!currentEvent || getEventStatus(currentEvent) !== "active") {
      setEvent(currentEvent ?? null);
      return;
    }
    if (evaluatorName.toLocaleLowerCase("pt-BR") !== invitation.name.trim().toLocaleLowerCase("pt-BR")) {
      setNameError("O nome digitado não corresponde ao convite enviado pelo administrador.");
      return;
    }
    store.setEvaluator(invitation.name, token, invitation.eventId);
    nav({ to: "/avaliar/votacao" });
  };

  return (
    <AuthLayout>
      {!checked ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-9 text-center text-slate-600 shadow-xl">Validando link do avaliador...</div>
      ) : !invitation ? (
        <div role="alert" className="space-y-3 rounded-3xl border border-orange-200 bg-white p-7 text-center shadow-xl shadow-slate-900/5 sm:p-9">
          <AlertCircle className="mx-auto h-8 w-8 text-orange-600" />
          <h2 className="font-display text-xl font-bold text-slate-900">Link de avaliador inválido</h2>
          <p className="text-sm leading-6 text-slate-600">Peça ao administrador um link individual válido para acessar a votação.</p>
        </div>
      ) : !event ? (
        <div role="alert" className="space-y-3 rounded-3xl border border-orange-200 bg-white p-7 text-center shadow-xl shadow-slate-900/5 sm:p-9">
          <AlertCircle className="mx-auto h-8 w-8 text-orange-600" />
          <h2 className="font-display text-xl font-bold text-slate-900">Evento indisponível</h2>
          <p className="text-sm leading-6 text-slate-600">Este evento não está mais disponível para avaliação.</p>
        </div>
      ) : getEventStatus(event) !== "active" ? (
        <div role="status" className="space-y-3 rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-xl shadow-slate-900/5 sm:p-9">
          <span className={`mx-auto inline-flex rounded-full px-3 py-1 text-xs font-bold ${event.status === "expired" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-700"}`}>
            {statusLabel[getEventStatus(event)]}
          </span>
          <h2 className="font-display text-xl font-bold text-slate-900">{event.name}</h2>
          <p className="text-sm leading-6 text-slate-600">
            {event.status === "expired"
              ? "Este evento já foi concluído e as avaliações foram encerradas."
              : event.status === "upcoming"
                ? "As avaliações deste evento ainda não começaram."
                : "As datas deste evento ainda não foram configuradas pelo administrador."}
          </p>
        </div>
      ) : (
      <form onSubmit={submit} className="space-y-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5 sm:p-9">
        <div className="text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-orange-50 text-orange-600"><Sparkles className="h-6 w-6" /></span>
          <h2 className="mt-4 font-display text-2xl font-bold tracking-tight text-slate-900">Área do Avaliador VIP</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Confirme seu nome para iniciar as avaliações</p>
          <p className="mt-2 text-sm font-semibold text-orange-700">{event.name}</p>
          <span className="mt-2 inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">Em andamento</span>
        </div>
        <label className="block text-left text-sm font-semibold text-slate-700">
          Seu Nome Completo
          <input
            autoFocus
            required
            value={name}
            onChange={(e) => { setName(e.target.value); setNameError(""); }}
            placeholder={invitation.name}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10"
          />
          {nameError && <span role="alert" className="mt-1 block text-xs font-medium text-red-600">{nameError}</span>}
        </label>
        <button
          disabled={!name.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 font-semibold text-white shadow-lg shadow-orange-700/15 transition hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-500/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Entrar na Sala de Votação <ArrowRight className="h-4 w-4" />
        </button>
      </form>
      )}
    </AuthLayout>
  );
}
