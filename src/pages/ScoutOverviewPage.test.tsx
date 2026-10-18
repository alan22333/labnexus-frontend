import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ScoutOverviewPage } from "@/pages/ScoutOverviewPage"
import type { ScoutConnection, ScoutCoverage } from "@/lib/scout-types"

const apiMocks = vi.hoisted(() => ({
  listConnections: vi.fn(),
  coverage: vi.fn(),
}))

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: {
      id: "user-1",
      username: "zhangsan",
      display_name: "张三",
      role: "student",
      avatar_url: null,
      created_at: "2026-10-01T00:00:00+08:00",
    },
  }),
}))

vi.mock("@/lib/scout-api", () => ({
  scoutApi: {
    listConnections: apiMocks.listConnections,
    coverage: apiMocks.coverage,
  },
  asScoutProblem: (error: unknown) => error,
  scoutProblemMessage: () => "请求失败",
}))

const connection: ScoutConnection = {
  id: "conn-1",
  provider: "web_api",
  library_type: "user",
  library_id: "123456",
  display_name: "课题组文献库",
  status: "healthy",
  last_library_version: 42,
  last_sync_at: "2026-10-17T10:30:00+08:00",
  created_at: "2026-10-01T00:00:00+08:00",
}

const coverage: ScoutCoverage = {
  visible_items: 159,
  indexed_documents: 152,
  personal_fulltext: 149,
  structured_abstract: 3,
  metadata_only: 7,
  failed: 0,
  last_success_at: "2026-10-17T10:30:00+08:00",
  local_only_warning: true,
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ScoutOverviewPage />
    </MemoryRouter>,
  )
}

describe("ScoutOverviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("uses the LabNexus identity and shows a connection call to action", async () => {
    apiMocks.listConnections.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText("张三")).toBeTruthy()
    expect(await screen.findByText("还没有可用的 Zotero 文库")).toBeTruthy()
    expect(screen.getByRole("button", { name: /去连接 Zotero/ })).toBeTruthy()
    expect(apiMocks.coverage).not.toHaveBeenCalled()
  })

  it("summarizes the active connection coverage", async () => {
    apiMocks.listConnections.mockResolvedValue([connection])
    apiMocks.coverage.mockResolvedValue(coverage)

    renderPage()

    expect(await screen.findByText(/课题组文献库/)).toBeTruthy()
    expect((await screen.findByTestId("coverage-indexed-documents")).textContent).toContain("152")
    expect(screen.getByRole("note").textContent).toContain("本地-only")
  })
})
