import { fileURLToPath, URL } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

// Research Scout 独立服务地址。默认 :8081;可用 VITE_SCOUT_PROXY_TARGET 覆盖
// (例如 Scout 已占用 :8080 时,设 VITE_SCOUT_PROXY_TARGET=http://localhost:8080)。
const scoutProxyTarget = process.env.VITE_SCOUT_PROXY_TARGET || "http://localhost:8081"
// LabNexus 后端地址。默认 :8080;可用 VITE_API_PROXY_TARGET 覆盖(例如 8080 被占用时)。
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || "http://localhost:8080"

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
      // 开发期将 /api/scout 转发到独立的 Research Scout 服务(默认 :8081);
      // 必须放在 /api 之前,Vite 按声明顺序匹配前缀。生产由部署网关提供同一路由。
      "/api/scout": {
        target: scoutProxyTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/scout/, "/api/v1"),
      },
      // 开发期将 /api 转发到本地后端(默认 :8080),见后端 docs/api-contract.md
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
})
