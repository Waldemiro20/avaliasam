import { useEffect, useState } from "react";

const KEY = "avaliasam.darkMode";

/** Preferência visual do tema (por navegador). Não guarda dados sensíveis. */
export function useDarkMode() {
  const [darkMode, setDarkMode] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      setDarkMode(localStorage.getItem(KEY) === "true");
    } catch {
      /* armazenamento indisponível: mantém o tema claro */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, String(darkMode));
    } catch {
      /* ignora */
    }
  }, [darkMode, loaded]);

  return [darkMode, setDarkMode] as const;
}
