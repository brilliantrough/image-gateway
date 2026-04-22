import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: path.resolve("src/ui"),
  plugins: [react()],
  build: {
    outDir: path.resolve("dist/ui"),
    emptyOutDir: false,
  },
  test: {
    environment: "jsdom",
    include: ["../../tests/**/*.test.ts", "../../tests/**/*.test.tsx"],
  },
});
