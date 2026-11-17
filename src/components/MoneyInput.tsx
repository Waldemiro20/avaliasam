import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type MoneyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number;
  onChange: (value: number) => void;
  /** Classes extras do contêiner (bordas, largura). */
  className?: string;
  inputClassName?: string;
};

const formatInput = (value: number) =>
  (Number.isFinite(value) ? value : 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Campo de valor em reais com máscara de centavos: os dígitos digitados preenchem
 * da direita para a esquerda (1 → 0,01 · 150 → 1,50 · 50000 → 500,00).
 */
export function MoneyInput({ value, onChange, className, inputClassName, disabled, ...rest }: MoneyInputProps) {
  return (
    <div
      className={cn(
        "flex items-center rounded-lg border bg-background focus-within:ring-2 focus-within:ring-ring",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <span className="pl-3 text-sm text-muted-foreground">R$</span>
      <input
        {...rest}
        disabled={disabled}
        type="text"
        inputMode="numeric"
        value={formatInput(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 13);
          onChange(Number(digits || "0") / 100);
        }}
        className={cn("w-full min-w-0 bg-transparent px-2 py-2.5 text-right tabular-nums outline-none disabled:cursor-not-allowed", inputClassName)}
      />
    </div>
  );
}
