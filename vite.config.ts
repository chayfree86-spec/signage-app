import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    legacy({
      targets: ["Android >= 5", "Chrome >= 49"],
      modernPolyfills: true,
      renderLegacyChunks: true,
    }),
  ],
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  publicDir: false,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: ["chrome61", "safari11"],
  },
});
