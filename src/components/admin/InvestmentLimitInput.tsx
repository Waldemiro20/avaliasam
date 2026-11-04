import { formatBRL, parseInvestmentLimit } from "@/lib/investment";

/**
 * Campo do teto de investimento. O texto digitado nunca é reescrito (sem máscara,
 * sem reformatar no foco/blur): a formatação em R$ aparece apenas como prévia abaixo.
 */
export function InvestmentLimitInput({
  label,
  value,
  onChange,
  id,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  id: string;
}) {
  const parsed = parseInvestmentLimit(value);
  const hasValue = value.trim() !== "";
  const hintId = `${id}-hint`;
  return (
    <label htmlFor={id} className="block space-y-1.5 text-sm font-medium">
      {label}
      <input
        id={id}
        required
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={hasValue && parsed === null}
        aria-describedby={hintId}
        placeholder="Ex.: 100000"
        className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring aria-[invalid=true]:border-destructive"
      />
      <span
        id={hintId}
        className={`block text-xs font-normal ${hasValue && parsed === null ? "text-destructive" : "text-muted-foreground"}`}
      >
        {!hasValue
          ? "Informe um valor inteiro em reais (0 ou mais)."
          : parsed === null
            ? "Valor inválido. Use apenas números inteiros, sem valores negativos."
            : `Equivale a ${formatBRL(parsed)} por projeto.`}
      </span>
    </label>
  );
}
