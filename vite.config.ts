import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    modulePreload: false,
    sourcemap: false,
  },
  server: {
    host: "127.0.0.1",
  },
  preview: {
    host: "127.0.0.1",
  },
});
