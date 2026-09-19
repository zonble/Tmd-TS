import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  base: "./",
  resolve: {
    alias: {
      "node:fs": path.resolve(__dirname, "src/shims/node-shim.ts"),
      "node:path": path.resolve(__dirname, "src/shims/node-shim.ts"),
      "node:os": path.resolve(__dirname, "src/shims/node-shim.ts"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@spotify/basic-pitch") || id.includes("@tensorflow")) {
            return "basic-pitch-vendor";
          }
          if (id.includes("@codemirror") || id.includes("@lezer")) {
            return "codemirror-vendor";
          }
          if (id.includes("jzz") || id.includes("soundfont-player")) {
            return "audio-vendor";
          }
        },
      },
    },
  },
  worker: {
    format: "es",
  },
});
