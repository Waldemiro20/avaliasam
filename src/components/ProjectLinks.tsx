import { isSafeHttpUrl } from "@/lib/schemas";

/**
 * Botões de acesso rápido do projeto. Cada botão só aparece quando há link
 * http(s) válido (revalidado aqui para nunca renderizar `javascript:` etc.).
 */
export function ProjectLinks({
  prototypeUrl,
  presentationUrl,
  projectName,
}: {
  prototypeUrl: string | null;
  presentationUrl: string | null;
  projectName: string;
}) {
  const links = [
    { url: prototypeUrl, label: "Ver Protótipo", icon: "🎨" },
    { url: presentationUrl, label: "Ver Apresentação", icon: "📊" },
  ].filter((link): link is { url: string; label: string; icon: string } =>
    Boolean(link.url && isSafeHttpUrl(link.url)),
  );

  if (links.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <a
          key={link.label}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${link.label} de ${projectName} (abre em nova aba)`}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition hover:border-primary hover:text-primary sm:flex-none"
        >
          <span aria-hidden="true">{link.icon}</span> {link.label}
        </a>
      ))}
    </div>
  );
}
