export function Logo({ size = "md", tone = "default" }: { size?: "md" | "lg"; tone?: "default" | "inverse" }) {
  const big = size === "lg";
  const textColor = tone === "inverse" ? "text-white" : "text-slate-900 dark:text-slate-100";
  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/logo-sam.webp"
        alt="Logo da Escola SAM"
        className={`rounded-xl bg-white object-contain ${big ? "h-12 w-12 p-0.5" : "h-9 w-9 p-0.5"}`}
      />
      <span className={`font-display font-extrabold tracking-tight ${textColor} ${big ? "text-3xl" : "text-xl"}`}>
        Avalia<span className="text-[#f97316] drop-shadow-[0_1px_4px_rgba(249,115,22,0.45)]">SAM</span>
      </span>
    </div>
  );
}
