import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { adminLogout } from "@/api/auth";
import { Logo } from "@/components/Logo";
import { errorMessage } from "@/lib/api-errors";

export function AdminHeader({
  darkMode,
  onToggleDarkMode,
  children,
}: {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  children?: ReactNode;
}) {
  const nav = useNavigate();
  const queryClient = useQueryClient();

  const logout = async () => {
    try {
      await adminLogout();
    } catch (error) {
      toast.error(errorMessage(error));
      return;
    }
    queryClient.clear();
    await nav({ to: "/admin/login", replace: true });
  };

  return (
    <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Logo />
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {children}
          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label={darkMode ? "Ativar tema claro" : "Ativar tema escuro"}
            aria-pressed={darkMode}
            className="grid h-9 w-9 place-items-center rounded-lg border text-muted-foreground transition hover:text-foreground"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </div>
    </header>
  );
}
