import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { clearDraft, savedDraft } from "./draft";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#0b5cad", dark: "#083f78", light: "#e8f1fb" },
    success: { main: "#2e7d32", light: "#e8f5e9" },
    warning: { main: "#d97706", light: "#fff7e6" },
    error: { main: "#c62828", light: "#fdecea" },
    background: { default: "#f2f5f9", paper: "#ffffff" },
    text: { primary: "#1b2430", secondary: "#5b6675" },
    divider: "#e1e6ed",
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    button: { textTransform: "none", fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
  },
  components: {
    MuiTab: { styleOverrides: { root: { textTransform: "none", fontWeight: 600, minHeight: 48 } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
    MuiTooltip: { defaultProps: { arrow: true } },
    MuiAccordion: { styleOverrides: { root: { borderRadius: 10, overflow: "hidden" } } },
    MuiPaper: { styleOverrides: { outlined: { borderColor: "#e1e6ed" } } },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* Last resort when the editor cannot even start, e.g. on a saved draft it cannot read */}
      <ErrorBoundary
        formData={savedDraft()}
        onReset={() => {
          clearDraft();
          location.reload();
        }}
      >
        <App />
      </ErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>
);
