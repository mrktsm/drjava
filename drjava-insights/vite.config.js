import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "./", // Ensure assets work when served from any path
  build: {
    outDir: "dist",
    assetsDir: "assets",
    rollupOptions: {
      output: {
        manualChunks: undefined, // Keep everything in one chunk for simpler CLI distribution
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
