import type { ReactNode } from "react";

/** Modal de confirmação no mesmo estilo dos demais modais do painel. */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  pending = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-foreground/50 px-4">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-md space-y-4 rounded-2xl bg-card p-6 shadow-2xl"
      >
        <div>
          <h2 id="confirm-dialog-title" className="font-display text-xl font-bold">
            {title}
          </h2>
          <div className="mt-2 text-sm leading-6 text-muted-foreground">{children}</div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
          >
            {pending ? "Processando..." : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
