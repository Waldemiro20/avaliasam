import { useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { formatFileSize, openStoredFile, saveFile, type StoredFile } from "@/lib/files";

const ACCEPT = ".pdf,.ppt,.pptx,.key,.odp,.doc,.docx,.png,.jpg,.jpeg,.zip,application/pdf,image/*";

export function ProjectFileField({ label, value, onChange }: { label: string; value?: StoredFile | undefined; onChange: (file: StoredFile | undefined) => void }) {
  const [uploading, setUploading] = useState(false);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      onChange(await saveFile(file));
    } catch (error) {
      console.error("Não foi possível salvar o arquivo.", error);
      toast.error("Não foi possível salvar o arquivo. Verifique o espaço disponível no navegador.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1 text-sm font-medium">
      <span>{label}</span>
      {value ? (
        <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <button type="button" onClick={() => openStoredFile(value).catch((err) => toast.error(err.message))} className="min-w-0 flex-1 truncate text-left hover:text-primary hover:underline">{value.name}</button>
          <span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(value.size)}</span>
          <button type="button" onClick={() => onChange(undefined)} aria-label={`Remover ${value.name}`} className="shrink-0 text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed bg-background px-3 py-3 text-muted-foreground transition hover:border-primary hover:text-primary">
          <Upload className="h-4 w-4" /> {uploading ? "Enviando..." : "Escolher arquivo (PDF, slides, imagem...)"}
          <input type="file" accept={ACCEPT} onChange={pick} disabled={uploading} className="sr-only" />
        </label>
      )}
    </div>
  );
}
