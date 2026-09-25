import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@codemirror\/(.*)$/, replacement: path.resolve(__dirname, "web/node_modules/@codemirror/$1") },
      { find: /^codemirror$/, replacement: path.resolve(__dirname, "web/node_modules/codemirror") },
    ],
  },
});
