import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // Sites binds static files from dist/client to env.ASSETS.
    outDir: "dist/client",
    target: "es2022",
  },
});
