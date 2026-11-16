import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Builds scripts/check-robustness.tsx for Node, with dependencies bundled in (see vite.check.config.ts).
export default defineConfig({
  plugins: [react()],
  logLevel: "warn",
  build: {
    ssr: "scripts/check-robustness.tsx",
    outDir: "node_modules/.check-robustness",
    emptyOutDir: true,
  },
  ssr: { noExternal: true },
});
