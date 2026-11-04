import { redirect } from "@tanstack/react-router";
import { getAdminMe } from "@/api/auth";

/** beforeLoad das rotas administrativas: valida a sessão no servidor (inclusive no SSR). */
export async function requireAdminRoute() {
  const admin = await getAdminMe();
  if (!admin) throw redirect({ to: "/admin/login", replace: true });
  return { admin };
}

/** beforeLoad das telas de login: quem já tem sessão vai direto ao painel. */
export async function redirectIfAdmin() {
  const admin = await getAdminMe().catch(() => null);
  if (admin) throw redirect({ to: "/admin", replace: true });
}
