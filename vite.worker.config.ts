import { defineConfig } from "vite";

export default defineConfig({
  // Static assets belong in dist/ and are served through the ASSETS binding.
  // Copying public/ into dist/server makes Sites interpret images as modules.
  publicDir: false,
  build: {
    ssr: "worker/index.mjs",
    outDir: "dist/server",
    emptyOutDir: false,
    target: "es2022",
    rollupOptions: {
      output: {
        entryFileNames: "index.js",
        format: "es",
      },
    },
  },
  ssr: {
    target: "webworker",
    noExternal: true,
  },
});
