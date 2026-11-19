import { createFileUpload, deleteCloudFile } from "./cloud-api";
import { store } from "./store";

/**
 * Arquivos dos projetos (protótipo, apresentação).
 * Com a nuvem configurada vão para o Supabase Storage (`url` pública, abre em qualquer aparelho);
 * sem ela ficam no IndexedDB deste navegador.
 */
export type StoredFile = { id: string; name: string; type: string; size: number; url?: string | undefined; path?: string | undefined };

const DB_NAME = "avaliasam.files";
const STORE = "files";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function uploadToCloud(file: Blob, name: string, type: string): Promise<StoredFile> {
  const { path, uploadUrl, publicUrl } = await createFileUpload({ data: { password: store.getAdminKey(), name } });
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": type || "application/octet-stream", "x-upsert": "false" },
    body: file,
  });
  if (!response.ok) throw new Error(`Falha no envio do arquivo (${response.status}).`);
  return { id: path, path, url: publicUrl, name, type, size: file.size };
}

export async function saveFile(file: File): Promise<StoredFile> {
  if (store.isCloudEnabled()) return uploadToCloud(file, file.name, file.type);
  const meta: StoredFile = { id: crypto.randomUUID(), name: file.name, type: file.type, size: file.size };
  await run("readwrite", (s) => s.put(file, meta.id));
  return meta;
}

export const getFile = (id: string) => run<Blob | undefined>("readonly", (s) => s.get(id));

export async function deleteFile(meta: StoredFile) {
  try {
    if (meta.path) await deleteCloudFile({ data: { password: store.getAdminKey(), path: meta.path } });
    else await run("readwrite", (s) => s.delete(meta.id));
  } catch (error) {
    console.error("Não foi possível remover o arquivo.", error);
  }
}

export const formatFileSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** PDFs e imagens abrem em nova aba; outros formatos (ex.: .pptx) são baixados. */
export async function openStoredFile(meta: StoredFile) {
  if (meta.url) {
    window.open(meta.url, "_blank", "noopener,noreferrer");
    return;
  }
  const viewable = meta.type === "application/pdf" || meta.type.startsWith("image/");
  // Abre a aba já no clique para não ser bloqueada como pop-up.
  const tab = viewable ? window.open("", "_blank") : null;
  const blob = await getFile(meta.id);
  if (!blob) {
    tab?.close();
    throw new Error("Arquivo não encontrado neste aparelho. Peça ao administrador para reenviá-lo.");
  }
  const url = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: meta.type }));
  if (tab) {
    tab.location.href = url;
  } else {
    const a = document.createElement("a");
    a.href = url;
    a.download = meta.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Envia para a nuvem os arquivos que ainda estão só no IndexedDB deste navegador (admin). */
let migrating = false;
export async function migrateLocalFilesToCloud() {
  if (migrating || !store.isCloudEnabled() || !store.isAdmin()) return;
  migrating = true;
  try {
    for (const event of store.getEvents()) {
      for (const project of event.projects) {
        for (const field of ["prototypeFile", "presentationFile"] as const) {
          const meta = project[field];
          if (!meta || meta.url) continue;
          const blob = await getFile(meta.id).catch(() => undefined);
          if (!blob) continue;
          const uploaded = await uploadToCloud(blob, meta.name, meta.type);
          // Relê o evento: o admin pode ter editado projetos durante o envio.
          const current = store.getEvent(event.id);
          if (!current) continue;
          store.saveEventProjects(event.id, current.projects.map((item) => item[field]?.id === meta.id ? { ...item, [field]: uploaded } : item));
          await run("readwrite", (s) => s.delete(meta.id)).catch(() => undefined);
        }
      }
    }
  } catch (error) {
    console.error("Não foi possível enviar os arquivos locais para a nuvem.", error);
  } finally {
    migrating = false;
  }
}
