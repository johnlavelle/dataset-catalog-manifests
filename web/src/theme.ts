import { alpha, createTheme } from "@mui/material";

export type Scheme = "light" | "dark";

declare module "@mui/material/styles" {
  interface PaletteColor {
    /** A pale (light) or deep (dark) background in this colour that body text stays readable on. */
    tint?: string;
  }
  interface SimplePaletteColorOptions {
    tint?: string;
  }
  interface TypeBackground {
    /** The right-hand panel and other recessed areas. */
    panel: string;
  }
  interface Palette {
    /** Not needed now: optional sections, later steps. */
    idle: string;
    surface: Surface;
  }
  interface PaletteOptions {
    idle?: string;
    surface?: Surface;
  }
}

/** Colours of particular surfaces that the standard palette has no slot for. */
interface Surface {
  appBar: string;
  appBarBorder: string;
  nav: string;
  guidance: string;
  guidanceBorder: string;
  code: string;
  codeText: string;
  codeIcon: string;
  codeBorder: string;
  tourScrim: string;
  tourRing: string;
  flashRing: string;
  flashBg: string;
}

/**
 * State colours (both schemes): red invalid, blue required now, amber accepted but unresolved (TBD, SHOULD),
 * green done, grey not needed now. Dark-scheme mains are lighter so they pass as text on dark surfaces, and
 * take dark text on top of them.
 */
const PALETTES = {
  light: {
    primary: { main: "#0b5cad", dark: "#083f78", tint: "#e8f1fb" },
    success: { main: "#2e7d32", tint: "#e8f5e9" },
    warning: { main: "#b45309", tint: "#fff7e6" },
    error: { main: "#c62828", tint: "#fdecea" },
    idle: "#7c8696",
    background: { default: "#f2f5f9", paper: "#ffffff", panel: "#f8fafc" },
    text: { primary: "#1b2430", secondary: "#5b6675" },
    divider: "#e1e6ed",
    surface: {
      appBar: "linear-gradient(90deg, #083f78 0%, #0b5cad 100%)",
      appBarBorder: "transparent",
      nav: alpha("#f2f5f9", 0.92),
      guidance: "#f5f9fe",
      guidanceBorder: "#cfe0f3",
      code: "#0f172a",
      codeText: "#e2e8f0",
      codeIcon: "#cbd5e1",
      codeBorder: "transparent",
      tourScrim: "rgba(15, 23, 42, 0.55)",
      tourRing: "rgba(11, 92, 173, 0.6)",
      flashRing: "rgba(11, 92, 173, 0.35)",
      flashBg: "rgba(11, 92, 173, 0.06)",
    },
  },
  dark: {
    primary: { main: "#6cb0f5", tint: "#253547", contrastText: "#0f141b" },
    success: { main: "#66bb6a", tint: "#243631", contrastText: "#0f141b" },
    warning: { main: "#f5b041", tint: "#3b352a", contrastText: "#0f141b" },
    error: { main: "#f2706b", tint: "#3a2a31", contrastText: "#0f141b" },
    idle: "#7d8898",
    background: { default: "#0f141b", paper: "#171d26", panel: "#131922" },
    text: { primary: "#e6eaf0", secondary: "#a3aebd" },
    divider: "#2a3340",
    surface: {
      appBar: "linear-gradient(90deg, #0a2440 0%, #0d2f52 100%)",
      appBarBorder: "#2a3340",
      nav: alpha("#0f141b", 0.92),
      guidance: "#202c3b",
      guidanceBorder: "#35506e",
      code: "#0a0e14",
      codeText: "#e2e8f0",
      codeIcon: "#cbd5e1",
      codeBorder: "#2a3340",
      tourScrim: "rgba(0, 0, 0, 0.7)",
      tourRing: "rgba(108, 176, 245, 0.8)",
      flashRing: "rgba(108, 176, 245, 0.5)",
      flashBg: "rgba(108, 176, 245, 0.14)",
    },
  },
} as const;

export function buildTheme(scheme: Scheme) {
  const p = PALETTES[scheme];
  return createTheme({
    palette: {
      mode: scheme,
      ...p,
      // One blue: the status explanations use info, which would otherwise be MUI's own, slightly different blue
      info: p.primary,
    },
    shape: { borderRadius: 8 },
    typography: {
      fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      button: { textTransform: "none", fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
    },
    components: {
      // For App.css, which cannot read the palette
      MuiCssBaseline: {
        styleOverrides: {
          ":root": {
            "--description-color": p.text.secondary,
            "--flash-ring": p.surface.flashRing,
            "--flash-bg": p.surface.flashBg,
          },
        },
      },
      MuiTab: { styleOverrides: { root: { textTransform: "none", fontWeight: 600, minHeight: 48 } } },
      MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
      MuiTooltip: { defaultProps: { arrow: true } },
      MuiAccordion: { styleOverrides: { root: { borderRadius: 10, overflow: "hidden" } } },
    },
  });
}
