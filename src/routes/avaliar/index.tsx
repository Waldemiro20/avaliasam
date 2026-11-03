import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { store } from "@/lib/store";

export const Route = createFileRoute("/avaliar/")({
  head: () => ({
    meta: [
      { title: "Sala de Avaliação VIP | AvaliaSAM" },
      { name: "description", content: "Digite seu nome e avalie as startups com até R$ 100 mil por projeto." },
      { property: "og:title", content: "Sala de Avaliação VIP | AvaliaSAM" },
      { property: "og:description", content: "Você foi convidado(a) para avaliar startups." },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    store.setEvaluator(name.trim());
    nav({ to: "/avaliar/votacao" });
  };
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-6 rounded-xl border bg-card p-8 text-center shadow-soft">
        <div className="flex justify-center"><Logo size="lg" /></div>
        <span className="bg-accent-grad inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent-foreground">Avaliador VIP</span>
        <h1 className="font-display text-2xl font-bold">Bem-vindo(a) à sala de avaliação</h1>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Digite o seu nome completo para iniciar" className="w-full rounded-lg border bg-background px-4 py-3 text-center outline-none focus:ring-2 focus:ring-ring" />
        <button disabled={!name.trim()} className="bg-accent-grad flex w-full items-center justify-center gap-2 rounded-lg py-3 font-semibold text-accent-foreground shadow-soft transition disabled:opacity-50">
          Entrar na Sala de Avaliação <ArrowRight className="h-4 w-4" />
        </button>
      </form>
      <button onClick={() => nav({ to: "/" })} className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
    </main>
  );
}
