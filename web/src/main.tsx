import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { clearDraft, savedDraft } from "./draft";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#1565c0" },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
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
