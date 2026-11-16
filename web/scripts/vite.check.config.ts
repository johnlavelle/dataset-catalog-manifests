import { defineConfig } from "vite";

// Builds scripts/check-manifests.ts for Node. Dependencies are bundled in, because some
// (@rjsf/utils) are CommonJS packages that Node cannot import by name.
export default defineConfig({
  logLevel: "warn",
  build: {
    ssr: "scripts/check-manifests.ts",
    outDir: "node_modules/.check-manifests",
    emptyOutDir: true,
  },
  ssr: { noExternal: true },
});
