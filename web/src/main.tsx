import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ColorModeProvider } from "./colorMode";
import ErrorBoundary from "./components/ErrorBoundary";
import { openingDraft, startBlank } from "./draft";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ColorModeProvider>
      {/* Last resort when the editor cannot even start, e.g. on a saved draft it cannot read. Starting
          over opens an empty form after the reload; the draft stays under Recent. */}
      <ErrorBoundary
        formData={openingDraft().data}
        onReset={() => {
          startBlank();
          location.reload();
        }}
      >
        <App />
      </ErrorBoundary>
    </ColorModeProvider>
  </React.StrictMode>
);
