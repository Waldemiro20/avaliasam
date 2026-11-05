import { describe, expect, it } from "vitest";
import {
  clampAmount,
  computeRanking,
  formatCompact,
  parseInvestmentLimit,
  quickIncrements,
  sliderStep,
} from "@/lib/investment";

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

describe("controles da avaliação (slider e atalhos)", () => {
  it("rótulos compactos", () => {
    expect(formatCompact(100_000)).toBe("100k");
    expect(formatCompact(2_500)).toBe("2,5k");
    expect(formatCompact(500)).toBe("500");
    expect(formatCompact(1_500_000)).toBe("1,5M");
  });

  it.each([
    [100_000, 1_000],
    [1_000_000, 10_000],
    [500, 10],
    [12_345, 5],
    [7, 1],
    [0, 1],
  ])("passo do slider para teto %d é %d e alcança o máximo", (limit, step) => {
    expect(sliderStep(limit)).toBe(step);
    if (limit > 0) expect(limit % sliderStep(limit)).toBe(0);
  });

  it("mantém +10k/+20k/+50k para tetos altos", () => {
    expect(quickIncrements(100_000)).toEqual([10_000, 20_000, 50_000]);
    expect(quickIncrements(1_000_000)).toEqual([10_000, 20_000, 50_000]);
  });

  it("adapta os atalhos proporcionalmente para tetos baixos", () => {
    expect(quickIncrements(500)).toEqual([50, 100, 250]);
    expect(quickIncrements(20_000)).toEqual([2_000, 4_000, 10_000]);
    expect(quickIncrements(0)).toEqual([]);
    for (const limit of [1, 3, 7, 500, 12_345, 50_000]) {
      for (const inc of quickIncrements(limit)) {
        expect(inc).toBeGreaterThan(0);
        expect(inc).toBeLessThan(limit);
      }
    }
  });

  it("incrementos nunca ultrapassam o teto", () => {
    const limit = 500;
    let value = 0;
    for (let i = 0; i < 20; i++) value = clampAmount(value + quickIncrements(limit)[2]!, limit);
    expect(value).toBe(500);
  });
});
