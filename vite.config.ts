import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

// root is src/ so pages land at dist/popup/index.html, which is what the manifest names.
export default defineConfig({
  root: "src",
  publicDir: resolve(import.meta.dirname, "public"),
  plugins: [preact(), tailwindcss()],
  build: {
    outDir: resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    target: "chrome120",
    rollupOptions: {
      input: {
        popup: resolve(import.meta.dirname, "src/popup/index.html"),
        options: resolve(import.meta.dirname, "src/options/index.html"),
        background: resolve(import.meta.dirname, "src/worker/background.js"),
      },
      output: {
        // background.js is named literally by the manifest, so it must not be hashed.
        entryFileNames: (chunk) =>
          chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
