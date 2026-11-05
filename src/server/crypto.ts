/**
 * Primitivas criptográficas baseadas em Web Crypto (funciona em Node e Workers).
 * Este arquivo não importa nada do projeto para poder ser usado pelo script
 * `scripts/create-admin.ts`.
 */

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparação em tempo constante. */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/** Token aleatório de 256 bits em base64url (43 caracteres). */
export function generateToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

/** SHA-256 em hex — usado para armazenar tokens de avaliador sem texto puro. */
export async function sha256Hex(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

// Cloudflare Workers limita PBKDF2 a 100.000 iterações.
const PBKDF2_ITERATIONS = 100_000;

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/** Formato: pbkdf2$sha256$<iterações>$<salt>$<hash> */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$sha256$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, algorithm, iterations, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2" || algorithm !== "sha256" || !iterations || !salt || !hash) return false;
  const rounds = Number(iterations);
  if (!Number.isSafeInteger(rounds) || rounds < 1 || rounds > PBKDF2_ITERATIONS) return false;
  const computed = await pbkdf2(password, fromBase64Url(salt), rounds);
  return timingSafeEqual(computed, fromBase64Url(hash));
}

/** Hash fictício para igualar o tempo de resposta quando o e-mail não existe. */
export const DUMMY_PASSWORD_HASH =
  "pbkdf2$sha256$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

// ---------------------------------------------------------------- links dos avaliadores

/** Deriva a chave AES-256-GCM dos links a partir do segredo do servidor (HKDF-SHA256). */
async function linkKey(secret: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", encoder.encode(secret), "HKDF", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder.encode("avaliasam"),
      info: encoder.encode("evaluator-link-v1"),
    },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Criptografa o token do link. Formato: v1.<iv>.<ciphertext+tag> (base64url). */
export async function encryptToken(token: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await linkKey(secret),
    encoder.encode(token),
  );
  return `v1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`;
}

/** Decifra o token; retorna null se o formato for inválido ou a chave tiver mudado. */
export async function decryptToken(payload: string, secret: string): Promise<string | null> {
  const [version, iv, data] = payload.split(".");
  if (version !== "v1" || !iv || !data) return null;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(iv) as BufferSource },
      await linkKey(secret),
      fromBase64Url(data) as BufferSource,
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}
