import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EventForm } from "@/components/EventForm";

const fill = () => {
  fireEvent.change(screen.getByPlaceholderText("Ex.: Expotec"), { target: { value: "Feira" } });
  fireEvent.change(screen.getByRole("textbox", { name: /Descrição do Evento/ }), { target: { value: "Desc" } });
};
const teto = () => screen.getByLabelText("Teto de Investimento por Projeto (R$)");
const indicator = () => screen.getByText(/Total Distribuído/).closest("div")!.parentElement!;

describe("EventForm", () => {
  it("começa com 5 competências fechando no teto e envia os dados", () => {
    const onSubmit = vi.fn();
    render(<EventForm submitLabel="Criar Evento" onSubmit={onSubmit} />);
    expect(screen.getAllByLabelText(/^Valor máximo de investimento da competência/)).toHaveLength(5);
    expect(indicator()).toHaveTextContent("Distribuição fechada");
    fill();
    fireEvent.click(screen.getByRole("button", { name: /Criar Evento/ }));
    expect(onSubmit).toHaveBeenCalledOnce();
    const values = onSubmit.mock.calls[0]![0];
    expect(values.investmentLimit).toBe(100_000);
    expect(values.competencies.map((c: { maxAmount: number }) => c.maxAmount)).toEqual([20_000, 20_000, 20_000, 20_000, 20_000]);
  });

  it("redistribui igualmente ao mudar o teto, adicionar ou remover competências", () => {
    const onSubmit = vi.fn();
    render(<EventForm submitLabel="Criar Evento" onSubmit={onSubmit} />);
    fill();
    const maxValues = () => screen.getAllByLabelText(/^Valor máximo de investimento da competência/).map((el) => (el as HTMLInputElement).value);
    fireEvent.change(teto(), { target: { value: "100000" } }); // R$ 1.000,00
    expect(indicator()).toHaveTextContent(/Teto do Projeto:\s*R\$\s*1\.000,00/);
    expect(indicator()).toHaveTextContent("Distribuição fechada");
    expect(maxValues()).toEqual(["200,00", "200,00", "200,00", "200,00", "200,00"]);

    fireEvent.click(screen.getByRole("button", { name: /Adicionar competência/ }));
    expect(maxValues()).toEqual(["166,67", "166,67", "166,67", "166,67", "166,66", "166,66"]);
    expect(indicator()).toHaveTextContent("Distribuição fechada");

    fireEvent.click(screen.getByRole("button", { name: "Remover competência 6" }));
    expect(maxValues()).toEqual(["200,00", "200,00", "200,00", "200,00", "200,00"]);
  });

  it("permite ajuste manual e bloqueia o envio quando a soma não fecha", () => {
    const onSubmit = vi.fn();
    render(<EventForm submitLabel="Criar Evento" onSubmit={onSubmit} />);
    fill();
    fireEvent.change(teto(), { target: { value: "50000" } }); // R$ 500,00 → 100,00 cada
    expect(indicator()).toHaveTextContent("Distribuição fechada");
    fireEvent.change(screen.getByLabelText("Valor máximo de investimento da competência 1 (R$)"), { target: { value: "5000" } });
    expect(indicator()).toHaveTextContent(/Restante:\s*R\$\s*50,00/);
    expect(screen.getByRole("alert")).toHaveTextContent(/não bate com o Teto de Investimento do Projeto/);
    fireEvent.click(screen.getByRole("button", { name: /Criar Evento/ }));
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Distribuir igualmente/ }));
    expect(indicator()).toHaveTextContent("Distribuição fechada");
    fireEvent.click(screen.getByRole("button", { name: /Criar Evento/ }));
    expect(onSubmit.mock.calls[0]![0].competencies.map((c: { maxAmount: number }) => c.maxAmount)).toEqual([100, 100, 100, 100, 100]);
  });
});
