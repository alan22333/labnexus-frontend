import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ScoutConnectionsPage } from "@/pages/ScoutConnectionsPage"

const apiMocks = vi.hoisted(() => ({
  listConnections: vi.fn(() => Promise.resolve([])),
  startOAuth: vi.fn(() => Promise.resolve({ authorization_url: "https://www.zotero.org/oauth/authorize?oauth_token=temporary" })),
  validateConnection: vi.fn(),
  startSync: vi.fn(),
  revokeConnection: vi.fn(),
  coverage: vi.fn(),
  listCollections: vi.fn(() => Promise.resolve([])),
}))

vi.mock("@/lib/scout-api", () => ({
  scoutApi: apiMocks,
  asScoutProblem: (error: unknown) => error,
  scoutProblemMessage: () => "请求失败",
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <ScoutConnectionsPage />
    </MemoryRouter>,
  )
}

describe("ScoutConnectionsPage OAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState({}, "", "/scout/connections")
  })

  it("不再展示 API Key/Library ID 表单", async () => {
    renderPage()

    expect(await screen.findByRole("button", { name: "连接 Zotero" })).toBeTruthy()
    expect(screen.queryByLabelText("Zotero API Key")).toBeNull()
    expect(screen.queryByLabelText("Zotero Library ID")).toBeNull()
  })

  it("点击连接时请求一次性授权地址", async () => {
    renderPage()

    fireEvent.click(await screen.findByRole("button", { name: "连接 Zotero" }))

    await waitFor(() => expect(apiMocks.startOAuth).toHaveBeenCalledTimes(1))
  })

  it("OAuth 回调成功时提示并清理 query", async () => {
    window.history.replaceState({}, "", "/scout/connections?zotero=connected")
    renderPage()

    expect(await screen.findByText("Zotero 授权成功，连接已保存。")).toBeTruthy()
    await waitFor(() => expect(window.location.search).toBe(""))
  })

  it("OAuth 回调失败时按稳定错误码提示", async () => {
    window.history.replaceState({}, "", "/scout/connections?zotero=error&code=exchange_failed")
    renderPage()

    expect(await screen.findByText(/换取凭据失败/)).toBeTruthy()
    await waitFor(() => expect(window.location.search).toBe(""))
  })
})
