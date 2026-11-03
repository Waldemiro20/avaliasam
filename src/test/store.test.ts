import { describe, expect, it } from "vitest";
import { clampAmount, computeRanking } from "@/lib/store";

describe("regras de investimento", () => {
  it("limita cada investimento a R$ 100.000", () => {
    expect(clampAmount(150_000)).toBe(100_000);
    expect(clampAmount(-5)).toBe(0);
  });
  it("soma os valores de todos os avaliadores por projeto", () => {
    const r = computeRanking(
      [{ id: "a", name: "A", members: "", description: "" }, { id: "b", name: "B", members: "", description: "" }],
      { Ana: { a: 20_000, b: 40_000 }, Bia: { a: 50_000 } },
    );
    expect(r[0].project.id).toBe("a");
    expect(r[0].total).toBe(70_000);
    expect(r[1].total).toBe(40_000);
  });
});
