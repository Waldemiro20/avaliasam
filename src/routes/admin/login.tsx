import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { ADMIN_EMAIL, ADMIN_PASSWORD, store } from "@/lib/store";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Login do Administrador | AvaliaSAM" },
      { name: "description", content: "Acesse o painel administrativo do AvaliaSAM." },
      { property: "og:title", content: "Login do Administrador | AvaliaSAM" },
      { property: "og:description", content: "Painel administrativo do AvaliaSAM." },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState(ADMIN_PASSWORD);
  const [show, setShow] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim().toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      store.setAdmin(true);
      nav({ to: "/admin" });
    } else toast.error("E-mail ou senha inválidos");
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-xl border bg-card p-8 shadow-soft">
        <div className="flex justify-center"><Logo size="lg" /></div>
        <p className="text-center text-sm text-muted-foreground">Acesso do administrador</p>
        <label className="block space-y-1.5 text-sm font-medium">
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring" />
        </label>
        <label className="block space-y-1.5 text-sm font-medium">
          Senha
          <div className="relative">
            <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2.5 pr-10 outline-none focus:ring-2 focus:ring-ring" />
            <button type="button" onClick={() => setShow(!show)} aria-label="Mostrar senha" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>
        <button className="bg-brand flex w-full items-center justify-center gap-2 rounded-lg py-3 font-semibold text-primary-foreground shadow-soft transition hover:opacity-95">
          <LogIn className="h-4 w-4" /> Entrar no Painel
        </button>
      </form>
    </main>
  );
}
