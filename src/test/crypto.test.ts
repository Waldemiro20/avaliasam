import { describe, expect, it } from "vitest";
import {
  decryptToken,
  DUMMY_PASSWORD_HASH,
  encryptToken,
  generateToken,
  hashPassword,
  sha256Hex,
  verifyPassword,
} from "@/server/crypto";

describe("criptografia do servidor", () => {
  it("gera tokens de 256 bits em base64url, únicos", () => {
    const tokens = new Set(Array.from({ length: 200 }, generateToken));
    expect(tokens.size).toBe(200);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("armazena tokens por hash SHA-256 determinístico", async () => {
    const token = generateToken();
    expect(await sha256Hex(token)).toBe(await sha256Hex(token));
    expect(await sha256Hex(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(await sha256Hex(token)).not.toContain(token);
  });

  it("verifica senhas com PBKDF2 e salt aleatório", async () => {
    const hash = await hashPassword("senha-super-secreta");
    expect(hash).not.toContain("senha-super-secreta");
    expect(await hashPassword("senha-super-secreta")).not.toBe(hash);
    expect(await verifyPassword("senha-super-secreta", hash)).toBe(true);
    expect(await verifyPassword("senha-errada", hash)).toBe(false);
  });

  it("rejeita hashes malformados e o hash fictício", async () => {
    expect(await verifyPassword("x", "texto-puro")).toBe(false);
    expect(await verifyPassword("x", "pbkdf2$sha256$999999999$a$b")).toBe(false);
    expect(await verifyPassword("x", DUMMY_PASSWORD_HASH)).toBe(false);
  });
});

describe("links copiáveis dos avaliadores", () => {
  const secret = "segredo-de-teste-com-mais-de-32-caracteres";

  it("criptografa e decifra o token sem guardá-lo em texto puro", async () => {
    const token = generateToken();
    const encrypted = await encryptToken(token, secret);
    expect(encrypted).not.toContain(token);
    expect(await encryptToken(token, secret)).not.toBe(encrypted); // IV aleatório
    expect(await decryptToken(encrypted, secret)).toBe(token);
  });

  it("rejeita chave errada, adulteração e formato inválido", async () => {
    const encrypted = await encryptToken(generateToken(), secret);
    expect(await decryptToken(encrypted, "outro-segredo-com-mais-de-32-caracteres!!")).toBeNull();
    const [v, iv, data] = encrypted.split(".");
    const tampered = `${v}.${iv}.${data!.slice(0, -2)}${data!.endsWith("A") ? "B" : "A"}${data!.slice(-1)}`;
    expect(await decryptToken(tampered, secret)).toBeNull();
    expect(await decryptToken("lixo", secret)).toBeNull();
  });
});
