import { describe, expect, it } from "vitest";
import { clampAmount, computeRanking, parseInvestmentLimit } from "@/lib/investment";

describe("teto de investimento (parseInvestmentLimit)", () => {
  it.each([
    ["0", 0],
    ["1000", 1000],
    ["100000", 100_000],
    ["500000", 500_000],
    ["1000000", 1_000_000],
    ["1.000.000", 1_000_000],
    ["R$ 1.000.000,00", 1_000_000],
    [" 250000 ", 250_000],
  ])("aceita %j como %d", (input, expected) => {
    expect(parseInvestmentLimit(input)).toBe(expected);
  });

  it.each(["", "   ", "-5", "-1000", "abc", "10,50", "1.5", "1e6", "1.00.0", "99999999999"])(
    "rejeita %j",
    (input) => {
      expect(parseInvestmentLimit(input)).toBeNull();
    },
  );
});

describe("regras de investimento", () => {
  it("limita cada investimento ao teto do projeto", () => {
    expect(clampAmount(150_000)).toBe(100_000);
    expect(clampAmount(-5)).toBe(0);
    expect(clampAmount(25_000, 15_000)).toBe(15_000);
    expect(clampAmount(Number.NaN, 15_000)).toBe(0);
  });

  it("soma os valores de todos os avaliadores por projeto, sem saldo compartilhado", () => {
    const r = computeRanking(
      [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
      ],
      [
        { evaluatorName: "Ana", projectId: "a", amount: 100_000 },
        { evaluatorName: "Ana", projectId: "b", amount: 100_000 },
        { evaluatorName: "Bia", projectId: "a", amount: 50_000 },
      ],
    );
    expect(r[0]!.project.id).toBe("a");
    expect(r[0]!.total).toBe(150_000);
    expect(r[1]!.total).toBe(100_000);
  });

  it("exibe os nomes no detalhamento e sinaliza links revogados", () => {
    const r = computeRanking(
      [{ id: "a", name: "Startup A" }],
      [
        { evaluatorName: "Ana", projectId: "a", amount: 15_000 },
        { evaluatorName: "Bia", projectId: "a", amount: 25_000, revoked: true },
        { evaluatorName: "Caio", projectId: "a", amount: 0 },
      ],
    );
    expect(r[0]!.breakdown.map((vote) => vote.evaluator)).toEqual(["Bia", "Ana"]);
    expect(r[0]!.breakdown[0]!.revoked).toBe(true);
    expect(r[0]!.total).toBe(40_000);
  });
});
