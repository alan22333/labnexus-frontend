import { fileURLToPath, URL } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // 开发期将 /api 转发到本地后端(默认 :8080),见后端 docs/api-contract.md
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
})
