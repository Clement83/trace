import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Vite configuration for guiv2 UI
 *
 * - React plugin enabled
 * - Simple alias `@` -> `src`
 * - Dev server proxies `/api` to the local backend server (http://localhost:3001)
 *
 * Notes:
 * - Adjust the proxy target via environment variables if you run the server on a different port.
 * - Ports: Vite dev default 5173, preview set to 5174 in package.json scripts; adjust if needed.
 */

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    open: false,
    // Allow access from reverse proxy domain
    allowedHosts: ["trace.quintard.me", "api.trace.quintard.me"],
    // Proxy API requests to the local server to avoid CORS in dev.
    proxy: {
      "/api": {
        target: process.env.API_PROXY || "http://localhost:3001",
        changeOrigin: true,
        secure: false,
        // Do not proxy websockets for SSE; EventSource uses HTTP long-polling style so this is fine.
      },
    },
  },
  preview: {
    port: 5174,
  },
});
