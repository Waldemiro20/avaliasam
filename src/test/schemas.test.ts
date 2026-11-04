import { describe, expect, it } from "vitest";
import {
  eventInput,
  evaluatorTokenSchema,
  isSafeHttpUrl,
  loginInput,
  projectInput,
  submitVotesInput,
} from "@/lib/schemas";

const project = { name: "Startup", members: "Ana, Bia", description: "Descrição" };

describe("links do projeto", () => {
  it("aceita links vazios como null", () => {
    const parsed = projectInput.parse({ ...project, prototypeUrl: "", presentationUrl: "   " });
    expect(parsed.prototypeUrl).toBeNull();
    expect(parsed.presentationUrl).toBeNull();
  });

  it("aceita URLs http(s)", () => {
    const parsed = projectInput.parse({
      ...project,
      prototypeUrl: "https://www.figma.com/file/abc",
      presentationUrl: "http://example.com/slides.pdf",
    });
    expect(parsed.prototypeUrl).toBe("https://www.figma.com/file/abc");
  });

  it.each([
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:x",
    "ftp://host/file",
    "figma.com/abc",
    "https://",
    "//evil.com",
  ])("rejeita %j", (url) => {
    expect(isSafeHttpUrl(url)).toBe(false);
    expect(projectInput.safeParse({ ...project, prototypeUrl: url }).success).toBe(false);
    expect(projectInput.safeParse({ ...project, presentationUrl: url }).success).toBe(false);
  });
});

describe("cadastro de projeto", () => {
  it("exige nome, integrantes e descrição", () => {
    expect(projectInput.safeParse({ ...project, members: "  " }).success).toBe(false);
    expect(projectInput.safeParse({ ...project, description: "" }).success).toBe(false);
    expect(projectInput.safeParse({ ...project, name: "" }).success).toBe(false);
    expect(projectInput.safeParse(project).success).toBe(true);
  });
});

describe("evento", () => {
  it("não possui datas e valida o teto", () => {
    expect(
      eventInput.parse({
        name: "Expotec",
        description: "x",
        investmentLimit: 0,
        startDate: "2020-01-01",
      }),
    ).toEqual({
      name: "Expotec",
      description: "x",
      investmentLimit: 0,
    });
    expect(eventInput.safeParse({ name: "E", description: "x", investmentLimit: -1 }).success).toBe(
      false,
    );
    expect(
      eventInput.safeParse({ name: "E", description: "x", investmentLimit: 10.5 }).success,
    ).toBe(false);
    expect(
      eventInput.safeParse({ name: "E", description: "x", investmentLimit: "1000" }).success,
    ).toBe(false);
  });
});

describe("avaliações", () => {
  const projectId = "6f1c1c1e-0000-4000-8000-000000000001";
  it("rejeita valores negativos, fracionados e ids inválidos", () => {
    expect(submitVotesInput.safeParse({ votes: [{ projectId, amount: -1 }] }).success).toBe(false);
    expect(submitVotesInput.safeParse({ votes: [{ projectId, amount: 1.5 }] }).success).toBe(false);
    expect(submitVotesInput.safeParse({ votes: [{ projectId: "x", amount: 1 }] }).success).toBe(
      false,
    );
    expect(submitVotesInput.safeParse({ votes: [{ projectId, amount: 1000 }] }).success).toBe(true);
  });
});

describe("tokens e login", () => {
  it("só aceita tokens no formato gerado pelo servidor", () => {
    expect(evaluatorTokenSchema.safeParse("a".repeat(43)).success).toBe(true);
    expect(evaluatorTokenSchema.safeParse("a".repeat(42)).success).toBe(false);
    expect(evaluatorTokenSchema.safeParse("' OR 1=1 --".padEnd(43, "a")).success).toBe(false);
  });
  it("normaliza o e-mail do login", () => {
    expect(loginInput.parse({ email: " Admin@Escola.COM ", password: "x" }).email).toBe(
      "admin@escola.com",
    );
  });
});
