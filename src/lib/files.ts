/** Arquivos dos projetos (protótipo, apresentação) ficam no IndexedDB: o localStorage não comporta PDFs/slides. */
export type StoredFile = { id: string; name: string; type: string; size: number };

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

export async function saveFile(file: File): Promise<StoredFile> {
  const meta: StoredFile = { id: crypto.randomUUID(), name: file.name, type: file.type, size: file.size };
  await run("readwrite", (s) => s.put(file, meta.id));
  return meta;
}

export const getFile = (id: string) => run<Blob | undefined>("readonly", (s) => s.get(id));

export async function deleteFile(id: string) {
  try {
    await run("readwrite", (s) => s.delete(id));
  } catch (error) {
    console.error("Não foi possível remover o arquivo.", error);
  }
}

export const formatFileSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** PDFs e imagens abrem em nova aba; outros formatos (ex.: .pptx) são baixados. */
export async function openStoredFile(meta: StoredFile) {
  const viewable = meta.type === "application/pdf" || meta.type.startsWith("image/");
  // Abre a aba já no clique para não ser bloqueada como pop-up.
  const tab = viewable ? window.open("", "_blank") : null;
  const blob = await getFile(meta.id);
  if (!blob) {
    tab?.close();
    throw new Error("Arquivo não encontrado neste navegador.");
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
