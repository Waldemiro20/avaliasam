import { createFileRoute } from "@tanstack/react-router";
import { EvaluatorAccess } from "@/components/EvaluatorAccess";

export const Route = createFileRoute("/avaliar/")({
  head: () => ({
    meta: [
      { title: "Área do Avaliador VIP | AvaliaSAM" },
      { name: "description", content: "Digite seu nome para iniciar as avaliações das startups." },
    ],
  }),
  component: EvaluatorAccess,
});
