import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@overlay": fileURLToPath(new URL("../shared/overlay", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    fs: { allow: [fileURLToPath(new URL("..", import.meta.url))] },
  },
});
