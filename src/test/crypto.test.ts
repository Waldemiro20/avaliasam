import { describe, expect, it } from "vitest";
import {
  DUMMY_PASSWORD_HASH,
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
