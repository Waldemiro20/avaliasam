import { beforeEach, describe, expect, it } from "vitest";
import {
  clampMoney,
  competencyTotal,
  defaultCompetencies,
  distributeAmount,
  evaluateProject,
  store,
  validateCompetencies,
  type Competency,
} from "@/lib/store";

const comp = (id: string, maxAmount: number): Competency => ({ id, name: id, description: "", maxAmount });
const fiveOf100 = ["c1", "c2", "c3", "c4", "c5"].map((id) => comp(id, 100));

describe("competências em R$", () => {
  it("divide o teto em 5 partes iguais por padrão, fechando em centavos", () => {
    expect(defaultCompetencies(500).map((c) => c.maxAmount)).toEqual([100, 100, 100, 100, 100]);
    const odd = defaultCompetencies(100.01);
    expect(competencyTotal(odd)).toBe(100.01);
    expect(distributeAmount(10, [1, 1, 1])).toEqual([3.34, 3.33, 3.33]);
  });

  it("só aceita quando a soma das competências é exatamente o teto", () => {
    expect(validateCompetencies(fiveOf100, 500)).toBeNull();
    expect(validateCompetencies([comp("a", 200), comp("b", 75), comp("c", 75), comp("d", 75), comp("e", 75)], 500)).toBeNull();
    expect(validateCompetencies(fiveOf100, 100_000)).toMatch(/não bate com o Teto de Investimento do Projeto/);
    expect(validateCompetencies([...fiveOf100, comp("x", 1)], 500)).toMatch(/não bate/);
    expect(validateCompetencies([comp("a", 500), comp("b", 0)], 500)).toMatch(/maior que R\$ 0,00/);
    expect(validateCompetencies([comp("a", 600), comp("b", -100)], 500)).toMatch(/maior que R\$ 0,00/);
    expect(validateCompetencies([], 500)).toMatch(/ao menos uma/);
    expect(validateCompetencies(fiveOf100, 0)).toMatch(/Teto/);
  });

  it("compara em centavos, sem erro de ponto flutuante", () => {
    expect(validateCompetencies([comp("a", 0.1), comp("b", 0.2)], 0.3)).toBeNull();
  });

  it("limita o valor investido ao máximo de cada competência", () => {
    expect(clampMoney(150, 100)).toBe(100);
    expect(clampMoney(-5, 100)).toBe(0);
    expect(clampMoney(33.333, 100)).toBe(33.33);
    const r = evaluateProject(fiveOf100, { amounts: { c1: 999, c2: 50.5, c3: 0, c4: 100, c5: -1 } });
    expect(r.items.map((item) => item.amount)).toEqual([100, 50.5, 0, 100, 0]);
    expect(r.amount).toBe(250.5);
    expect(r.maxAmount).toBe(500);
  });
});

describe("fluxo no store", () => {
  beforeEach(() => localStorage.clear());

  it("recusa criar evento cujas competências não fecham no teto", () => {
    expect(() => store.createEvent("Feira", "desc", 1000, fiveOf100)).toThrow(/não bate/);
  });

  it("grava os valores por competência e reflete no ranking", () => {
    const event = store.createEvent("Feira", "desc", 500, fiveOf100);
    store.saveEventProjects(event.id, [{ id: "p1", name: "P1", members: "", description: "" }]);
    const evaluator = store.createEvaluator("Ana", event.id);

    store.saveEvaluatorScores(evaluator.token, event.id, {
      p1: { amounts: { c1: 100, c2: 150, c3: 25.5 }, justifications: { c1: " ótimo " }, opinion: "Bom" },
    });
    expect(store.getVotes()[evaluator.token]).toEqual({ p1: 225.5 });
    expect(store.getScoreSheets()[evaluator.token]!["p1"]!.justifications).toEqual({ c1: "ótimo" });

    // Reduzir o máximo de uma competência limita o valor já investido nela.
    const updated = store.getEvent(event.id)!;
    store.saveEvent({ ...updated, investmentLimit: 400, competencies: [comp("c1", 50), comp("c2", 100), comp("c3", 100), comp("c4", 100), comp("c5", 50)] });
    expect(store.getVotes()[evaluator.token]).toEqual({ p1: 175.5 });

    store.saveEventProjects(event.id, []);
    expect(store.getScoreSheets()[evaluator.token]).toEqual({});
  });

  it("migra eventos antigos (sem competências ou em pontos) para valores em R$", () => {
    localStorage.setItem(
      "avaliasam.events",
      JSON.stringify([
        { id: "e1", name: "E1", description: "", investmentLimit: 1000, projects: [] },
        {
          id: "e2",
          name: "E2",
          description: "",
          investmentLimit: 500,
          projects: [],
          competencies: [
            { id: "a", name: "A", description: "", maxScore: 400 },
            { id: "b", name: "B", description: "", maxScore: 600 },
          ],
        },
      ]),
    );
    localStorage.setItem("avaliasam.scores", JSON.stringify({ t: { p: { scores: { a: 200, b: 600 }, justifications: {}, opinion: "" } } }));

    const [e1, e2] = store.getEvents();
    expect(e1!.competencies).toHaveLength(5);
    expect(validateCompetencies(e1!.competencies, 1000)).toBeNull();
    expect(e2!.competencies.map((c) => c.maxAmount)).toEqual([200, 300]);
    expect(store.getScoreSheets()["t"]!["p"]!.amounts).toEqual({ a: 100, b: 300 });
    expect(store.getEvents()[0]!.competencies.map((c) => c.id)).toEqual(e1!.competencies.map((c) => c.id));
  });
});
