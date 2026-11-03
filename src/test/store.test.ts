import { describe, expect, it } from "vitest";
import { clampAmount, computeRanking } from "@/lib/store";

describe("regras de investimento", () => {
  it("limita cada investimento a R$ 100.000", () => {
    expect(clampAmount(150_000)).toBe(100_000);
    expect(clampAmount(-5)).toBe(0);
    expect(clampAmount(25_000, 15_000)).toBe(15_000);
  });
  it("soma os valores de todos os avaliadores por projeto", () => {
    const r = computeRanking(
      [{ id: "a", name: "A", members: "", description: "" }, { id: "b", name: "B", members: "", description: "" }],
      { Ana: { a: 20_000, b: 40_000 }, Bia: { a: 50_000 } },
    );
    expect(r[0]!.project.id).toBe("a");
    expect(r[0]!.total).toBe(70_000);
    expect(r[1]!.total).toBe(40_000);
  });
  it("exibe os nomes associados aos tokens individuais no ranking", () => {
    const r = computeRanking(
      [{ id: "a", name: "Startup A", members: "", description: "" }],
      { "token-ana": { a: 15_000 }, "token-bia": { a: 25_000 } },
      { "token-ana": "Ana", "token-bia": "Bia" },
    );
    expect(r[0]!.breakdown.map((vote) => vote.evaluator)).toEqual(["Bia", "Ana"]);
    expect(r[0]!.total).toBe(40_000);
  });
});
