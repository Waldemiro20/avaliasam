import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, KeyRound, LockKeyhole, LogIn, Mail } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/AuthLayout";
import { ADMIN_EMAIL, ADMIN_PASSWORD, store } from "@/lib/store";

export function AdminLoginScreen() {
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
    <AuthLayout>
      <form onSubmit={submit} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5 sm:p-9">
        <div className="text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><KeyRound className="h-6 w-6" /></span>
          <h2 className="mt-4 font-display text-2xl font-bold tracking-tight text-slate-900">Acesso do Administrador</h2>
          <p className="mt-1 text-sm text-slate-500">Entre com suas credenciais</p>
        </div>
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
          E-mail
          <span className="relative block">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 font-normal outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            />
          </span>
        </label>
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
          Senha
          <span className="relative block">
            <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-11 font-normal outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              aria-label={show ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </span>
        </label>
        <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-semibold text-white shadow-lg shadow-emerald-700/15 transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/25">
          <LogIn className="h-4 w-4" /> Entrar no Painel
        </button>
      </form>
    </AuthLayout>
  );
}
