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

  it("atualiza o indicador ao mudar o teto e bloqueia o envio quando a soma não fecha", () => {
    const onSubmit = vi.fn();
    render(<EventForm submitLabel="Criar Evento" onSubmit={onSubmit} />);
    fill();
    fireEvent.change(teto(), { target: { value: "50000" } }); // R$ 500,00
    expect(indicator()).toHaveTextContent(/Teto do Projeto:\s*R\$\s*500,00/);
    expect(indicator()).toHaveTextContent(/Excedente:\s*R\$\s*99\.500,00/);
    expect(screen.getByRole("alert")).toHaveTextContent(/não bate com o Teto de Investimento do Projeto/);
    expect(screen.getByRole("button", { name: /Criar Evento/ })).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByRole("button", { name: /Criar Evento/ }));
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Distribuir igualmente/ }));
    expect(indicator()).toHaveTextContent("Distribuição fechada");
    fireEvent.change(screen.getByLabelText("Valor máximo de investimento da competência 1 (R$)"), { target: { value: "5000" } });
    expect(indicator()).toHaveTextContent(/Restante:\s*R\$\s*50,00/);
    fireEvent.click(screen.getByRole("button", { name: /Criar Evento/ }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
