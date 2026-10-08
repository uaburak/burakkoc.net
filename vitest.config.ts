import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The model's and the data's pure functions, tested in Node (no browser, no Firestore).
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
