import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ScoutResearchPage } from "@/pages/ScoutResearchPage"
import type { ScoutBrief, ScoutProject, ScoutSession } from "@/lib/scout-types"

const apiMocks = vi.hoisted(() => ({
  listProjects: vi.fn(),
  listCollections: vi.fn(),
  projectScope: vi.fn(),
  listSessions: vi.fn(),
  createSession: vi.fn(),
  createTurn: vi.fn(),
  getSession: vi.fn(),
  listTurns: vi.fn(),
  sessionBrief: vi.fn(),
  sessionEvents: vi.fn(),
  saveProjectScope: vi.fn(),
  submitFeedback: vi.fn(),
  exportBrief: vi.fn(),
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
    listProjects: apiMocks.listProjects,
    listCollections: apiMocks.listCollections,
    projectScope: apiMocks.projectScope,
    listSessions: apiMocks.listSessions,
    createSession: apiMocks.createSession,
    createTurn: apiMocks.createTurn,
    getSession: apiMocks.getSession,
    listTurns: apiMocks.listTurns,
    sessionBrief: apiMocks.sessionBrief,
    sessionEvents: apiMocks.sessionEvents,
    saveProjectScope: apiMocks.saveProjectScope,
    submitFeedback: apiMocks.submitFeedback,
    exportBrief: apiMocks.exportBrief,
  },
  asScoutProblem: (error: unknown) => error,
  scoutProblemMessage: () => "请求失败",
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const project: ScoutProject = {
  id: "project-1",
  name: "云存储完整性审计",
  description: "关注可证明数据持有与完整性审计",
  default_mode: "my_library",
  scope_mode: "all_library",
  collection_ids: [],
  scope_version: 1,
  created_at: "2026-10-01T00:00:00+08:00",
  updated_at: "2026-10-01T00:00:00+08:00",
}

const session: ScoutSession = {
  id: "session-1",
  project_id: "project-1",
  current_turn_id: "turn-1",
  mode: "my_library",
  status: "completed",
  phase: "completed",
  created_at: "2026-10-18T09:00:00+08:00",
}

const populatedBrief: ScoutBrief = {
  id: "brief-1",
  session_id: "session-1",
  turn_id: "turn-1",
  schema_version: "v1",
  retrieval_config_version: "v1",
  prompt_version: "v1",
  summary: "现有工作主要围绕可证明数据持有与动态审计两类路线展开。",
  findings: [
    {
      claim_id: "c1",
      claim_type: "finding",
      claim: "基于同态标签的方案支持公开可验证性。",
      support_level: "sufficient",
      confidence: 0.9,
      verification_status: "verified",
      evidence_ids: ["ev-1"],
      claim_evidence: [{ evidence_id: "ev-1", stance: "supports", support_score: 0.9 }],
    },
  ],
  method_timeline: [],
  chronology: [],
  citations: [
    {
      id: "ev-1",
      brief_id: "brief-1",
      evidence_type: "personal_fulltext",
      title: "Public Provable Data Possession",
      url: "https://example.org/papers/1",
      score: 0.92,
      retrieved_at: "2026-10-18T09:00:00+08:00",
    },
  ],
  gaps: [],
  open_questions: [],
  source_status: [{ source: "zotero", status: "available" }],
  created_at: "2026-10-18T09:00:00+08:00",
}

const abstainedBrief: ScoutBrief = {
  id: "brief-2",
  session_id: "session-1",
  turn_id: "turn-1",
  schema_version: "v1",
  retrieval_config_version: "v1",
  prompt_version: "v1",
  summary: "Insufficient scientific evidence in the current scope to answer this question.",
  findings: [],
  method_timeline: [],
  chronology: [],
  citations: [],
  gaps: [],
  open_questions: [],
  source_status: [{ source: "zotero", status: "available" }],
  created_at: "2026-10-18T09:00:00+08:00",
}

const turn = {
  id: "turn-1",
  session_id: "session-1",
  turn_no: 1,
  question: "q",
  mode: "my_library" as const,
  status: "completed" as const,
  phase: "completed",
  created_at: "2026-10-18T09:00:00+08:00",
}

function primeHappyPath() {
  apiMocks.listProjects.mockResolvedValue([project])
  apiMocks.listCollections.mockResolvedValue([])
  apiMocks.projectScope.mockResolvedValue({
    scope_mode: "all_library",
    collection_ids: [],
    version: 1,
  })
  apiMocks.listSessions.mockResolvedValue([])
  apiMocks.sessionEvents.mockResolvedValue([])
  apiMocks.createSession.mockResolvedValue(session)
  apiMocks.getSession.mockResolvedValue(session)
  apiMocks.listTurns.mockResolvedValue([turn])
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ScoutResearchPage />
    </MemoryRouter>,
  )
}

describe("ScoutResearchPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("loads projects and shows the active project workspace", async () => {
    primeHappyPath()

    renderPage()

    expect((await screen.findAllByText("云存储完整性审计")).length).toBeGreaterThan(0)
    expect(await screen.findByTestId("scout-question-input")).toBeTruthy()
    expect(apiMocks.listProjects).toHaveBeenCalledOnce()
  })

  it("answers an English question and renders the brief findings", async () => {
    primeHappyPath()
    apiMocks.sessionBrief.mockResolvedValue(populatedBrief)

    renderPage()
    const input = await screen.findByTestId("scout-question-input")
    fireEvent.change(input, {
      target: { value: "What are the main approaches to cloud data integrity auditing?" },
    })
    fireEvent.click(screen.getByRole("button", { name: /开始调研/ }))

    await waitFor(() => expect(apiMocks.createSession).toHaveBeenCalledOnce())
    expect(await screen.findByTestId("scout-findings")).toBeTruthy()
    expect(screen.getByText(/基于同态标签的方案支持公开可验证性/)).toBeTruthy()
    // 没有出现中文提示
    expect(screen.queryByText(/中文长句的术语匹配偏保守/)).toBeNull()
  })

  it("shows the abstain state when the brief reports insufficient evidence", async () => {
    primeHappyPath()
    apiMocks.sessionBrief.mockResolvedValue(abstainedBrief)

    renderPage()
    const input = await screen.findByTestId("scout-question-input")
    fireEvent.change(input, { target: { value: "Are there provable data possession schemes?" } })
    fireEvent.click(screen.getByRole("button", { name: /开始调研/ }))

    expect(await screen.findByTestId("scout-brief-abstain")).toBeTruthy()
    expect(screen.queryByTestId("scout-findings")).toBeNull()
  })

  it("warns about Chinese questions before submitting", async () => {
    primeHappyPath()

    renderPage()
    const input = await screen.findByTestId("scout-question-input")
    fireEvent.change(input, { target: { value: "云存储完整性审计有哪些主要方法？" } })

    expect(await screen.findByText(/中文长句的术语匹配偏保守/)).toBeTruthy()
  })
})
