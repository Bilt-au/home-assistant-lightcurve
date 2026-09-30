import { defineConfig } from "vite";

// One self-contained file, checked into the integration, so installing from HACS
// needs no build step on the user's machine.
export default defineConfig({
  build: {
    outDir: "../custom_components/lightcurve/frontend",
    emptyOutDir: false,
    lib: {
      entry: "src/lightcurve-panel.ts",
      formats: ["es"],
      fileName: () => "lightcurve-panel.js",
    },
    rollupOptions: {
      // Nothing external: Home Assistant does not expose Lit to custom panels.
      output: { inlineDynamicImports: true },
    },
    target: "es2022",
    minify: "esbuild",
  },
});
