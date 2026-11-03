import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Star } from "lucide-react";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AvaliaSAM - Sistema de Avaliação de Startups" },
      { name: "description", content: "Escolha sua entrada: painel do administrador ou sala de avaliação VIP." },
      { property: "og:title", content: "AvaliaSAM - Sistema de Avaliação de Startups" },
      { property: "og:description", content: "Avalie startups investindo até R$ 100 mil por projeto." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 px-4">
      <Logo size="lg" />
      <p className="max-w-md text-center text-muted-foreground">Sistema de avaliação de startups. Cada avaliador investe até R$ 100.000 por projeto.</p>
      <div className="grid w-full max-w-xl gap-4 sm:grid-cols-2">
        <Link to="/avaliar" className="rounded-xl border bg-card p-6 shadow-soft transition hover:-translate-y-0.5 hover:border-accent">
          <Star className="h-7 w-7 text-accent" />
          <h2 className="mt-3 font-display text-lg font-bold">Sou avaliador VIP</h2>
          <p className="text-sm text-muted-foreground">Entre só com seu nome.</p>
        </Link>
        <Link to="/admin/login" className="rounded-xl border bg-card p-6 shadow-soft transition hover:-translate-y-0.5 hover:border-primary">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <h2 className="mt-3 font-display text-lg font-bold">Administrador</h2>
          <p className="text-sm text-muted-foreground">Gerencie projetos e ranking.</p>
        </Link>
      </div>
    </main>
  );
}
