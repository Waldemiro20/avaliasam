import { createFileRoute } from "@tanstack/react-router";
import { AdminLoginScreen } from "@/components/AdminLoginScreen";
import { redirectIfAdmin } from "@/lib/route-guards";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Acesso do Administrador | AvaliaSAM" },
      { name: "description", content: "Acesse o painel administrativo do AvaliaSAM." },
    ],
  }),
  beforeLoad: redirectIfAdmin,
  component: AdminLoginScreen,
});
