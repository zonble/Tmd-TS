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
  worker: {
    format: "es",
  },
});
