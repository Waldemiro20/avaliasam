import { createFileRoute } from "@tanstack/react-router";
import { AdminLoginScreen } from "@/components/AdminLoginScreen";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Acesso do Administrador | AvaliaSAM" },
      { name: "description", content: "Acesse o painel administrativo do AvaliaSAM." },
    ],
  }),
  component: AdminLoginScreen,
});
