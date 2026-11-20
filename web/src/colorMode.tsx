import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { buildTheme, type Scheme } from "./theme";

/** What the reader chose: a fixed scheme, or whatever the operating system uses. */
export type ColorMode = "light" | "dark" | "system";

/** Also read by the inline script in index.html, which paints the page before React starts. */
const MODE_KEY = "dataset-manifest-editor:color-mode";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function readMode(): ColorMode {
  try {
    const saved = localStorage.getItem(MODE_KEY);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    // Storage unavailable (some private windows)
    return "system";
  }
}

function writeMode(mode: ColorMode) {
  try {
    if (mode === "system") localStorage.removeItem(MODE_KEY);
    else localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Not kept: the choice lasts until the page is reloaded
  }
}

const systemScheme = (): Scheme => (window.matchMedia?.(DARK_QUERY).matches ? "dark" : "light");

interface ColorModeValue {
  mode: ColorMode;
  /** The scheme in use, with "system" resolved. */
  scheme: Scheme;
  setMode: (mode: ColorMode) => void;
}

const ColorModeContext = createContext<ColorModeValue>({ mode: "system", scheme: "light", setMode: () => {} });

export const useColorMode = () => useContext(ColorModeContext);

export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ColorMode>(readMode);
  const [system, setSystem] = useState<Scheme>(systemScheme);

  useEffect(() => {
    const query = window.matchMedia?.(DARK_QUERY);
    if (!query) return;
    const update = () => setSystem(query.matches ? "dark" : "light");
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const scheme = mode === "system" ? system : mode;
  const theme = useMemo(() => buildTheme(scheme), [scheme]);
  const value = useMemo(
    () => ({
      mode,
      scheme,
      setMode: (next: ColorMode) => {
        writeMode(next);
        setModeState(next);
      },
    }),
    [mode, scheme]
  );

  // Replaces what index.html set before React started, which inline would outlast a switch of scheme
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.scheme = scheme;
    root.style.colorScheme = scheme;
    root.style.backgroundColor = theme.palette.background.default;
  }, [scheme, theme]);

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
