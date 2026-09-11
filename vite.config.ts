import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

// root is src/ so that an HTML entry lands at dist/popup/index.html rather
// than dist/src/popup/index.html - the manifest names those paths, and a
// nested output would bake "src" into the shipped extension forever.
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
        // The manifest names background.js literally, so that one entry must
        // never be hashed. Everything else can be.
        entryFileNames: (chunk) =>
          chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
