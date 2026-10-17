import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

// jsdom / Node 提供的对象地址实现会返回 `blob:nodedata:...`,不便断言;统一替换为稳定桩
Object.defineProperty(URL, "createObjectURL", {
  value: vi.fn(() => "blob:mock"),
  writable: true,
  configurable: true,
})
Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), writable: true, configurable: true })

// 每个用例后卸载已挂载组件,避免 DOM 泄漏到下一个用例
afterEach(() => {
  cleanup()
})
