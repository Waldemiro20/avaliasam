import { TrendingUp } from "lucide-react";

export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const big = size === "lg";
  return (
    <div className="flex items-center gap-2.5">
      <div className={`bg-brand shadow-soft grid place-items-center rounded-xl text-primary-foreground ${big ? "h-12 w-12" : "h-9 w-9"}`}>
        <TrendingUp className={big ? "h-6 w-6" : "h-5 w-5"} />
      </div>
      <span className={`font-display font-extrabold tracking-tight ${big ? "text-3xl" : "text-xl"}`}>
        Avalia<span className="text-accent">SAM</span>
      </span>
    </div>
  );
}
