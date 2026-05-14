import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiTarget = process.env.VITE_API_TARGET ?? "http://localhost:3000";

export default defineConfig({
  root: path.resolve("src/ui"),
  plugins: [react()],
  server: {
    proxy: {
      "/v1": {
        target: apiTarget,
        changeOrigin: true,
        proxyTimeout: 1_800_000,
        timeout: 1_800_000,
      },
    },
  },
  build: {
    outDir: path.resolve("dist/ui"),
    emptyOutDir: false,
  },
  test: {
    environment: "jsdom",
    include: ["../../tests/**/*.test.ts", "../../tests/**/*.test.tsx"],
  },
});
