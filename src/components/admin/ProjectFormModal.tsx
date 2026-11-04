import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { createProject, updateProject } from "@/api/admin";
import { errorMessage } from "@/lib/api-errors";
import { projectInput } from "@/lib/schemas";
import type { ProjectFormValue } from "@/components/admin/project-form";

const inputClass =
  "w-full rounded-lg border bg-background px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-ring";

export function ProjectFormModal({
  eventId,
  eventName,
  initial,
  onClose,
}: {
  eventId: string;
  eventName: string;
  initial: ProjectFormValue;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProjectFormValue>(initial);

  const mutation = useMutation({
    mutationFn: async (data: ReturnType<typeof projectInput.parse>) =>
      form.id
        ? updateProject({ data: { ...data, id: form.id } })
        : createProject({ data: { ...data, eventId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success(form.id ? "Projeto atualizado" : "Projeto cadastrado");
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mutation.isPending) return;
    const parsed = projectInput.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifique os campos do projeto.");
      return;
    }
    mutation.mutate(parsed.data);
  };

  const field = (key: keyof Omit<ProjectFormValue, "id">) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: e.target.value }),
  });

  return (
    <div className="fixed inset-0 z-20 grid place-items-center overflow-y-auto bg-foreground/40 px-4 py-8">
      <form
        onSubmit={submit}
        noValidate
        className="w-full max-w-md space-y-4 rounded-2xl bg-card p-6 shadow-soft"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">
            {form.id ? "Editar projeto" : "Novo projeto"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">Evento: {eventName}</p>
        <label className="block space-y-1 text-sm font-medium">
          Nome do Projeto / Startup *
          <input required maxLength={160} {...field("name")} className={inputClass} />
        </label>
        <label className="block space-y-1 text-sm font-medium">
          Integrantes da Equipe *
          <input required maxLength={1000} {...field("members")} className={inputClass} />
        </label>
        <label className="block space-y-1 text-sm font-medium">
          Descrição do Projeto *
          <textarea
            required
            rows={4}
            maxLength={4000}
            {...field("description")}
            className={inputClass}
          />
        </label>
        <label className="block space-y-1 text-sm font-medium">
          Link do Protótipo <span className="font-normal text-muted-foreground">(opcional)</span>
          <input
            type="url"
            inputMode="url"
            maxLength={2048}
            placeholder="https://figma.com/..., site, demo ou repositório"
            {...field("prototypeUrl")}
            className={inputClass}
          />
        </label>
        <label className="block space-y-1 text-sm font-medium">
          Link da Apresentação <span className="font-normal text-muted-foreground">(opcional)</span>
          <input
            type="url"
            inputMode="url"
            maxLength={2048}
            placeholder="https://canva.com/..., slides ou PDF"
            {...field("presentationUrl")}
            className={inputClass}
          />
        </label>
        <button
          disabled={mutation.isPending}
          className="bg-brand w-full rounded-lg py-2.5 font-semibold text-primary-foreground disabled:opacity-60"
        >
          {mutation.isPending ? "Salvando..." : "Salvar projeto"}
        </button>
      </form>
    </div>
  );
}
