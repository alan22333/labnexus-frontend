import { getToken, refreshToken } from "./api"
import type {
  ScoutBrief,
  ScoutCollection,
  ScoutFinding,
  ScoutConnection,
  ScoutOAuthStart,
  ScoutCoverage,
  ScoutEvidence,
  ScoutGap,
  ScoutProject,
  ScoutQueryEvent,
  ScoutRetrievalMode,
  ScoutScope,
  ScoutScopeMode,
  ScoutSession,
  ScoutSessionSummary,
  ScoutSyncRun,
  ScoutTurn,
} from "./scout-types"

const DEFAULT_API_BASE = "/api/scout"

export type ScoutApiProblemInit = {
  status: number
  code: string
  message: string
  retryable: boolean
  requestId: string | null
  details?: Record<string, unknown>
}

export class ScoutApiProblem extends Error {
  readonly status: number
  readonly code: string
  readonly retryable: boolean
  readonly requestId: string | null
  readonly details?: Record<string, unknown>

  constructor(init: ScoutApiProblemInit) {
    super(init.message)
    this.name = "ScoutApiProblem"
    this.status = init.status
    this.code = init.code
    this.retryable = init.retryable
    this.requestId = init.requestId
    this.details = init.details
  }
}

const CODE_MESSAGES: Record<string, string> = {
  invalid_request: "请求参数不合法，请检查后重试。",
  unauthorized: "调研助手身份未通过验证，请检查服务端开发身份配置。",
  forbidden: "没有访问该资源的权限。",
  not_found: "资源不存在或已被删除。",
  conflict: "请求与当前状态冲突，请刷新后重试。",
  zotero_credential_invalid: "Zotero 授权已失效，请重新连接。",
  source_unavailable: "外部来源暂时不可用，已按降级结果展示。",
  rate_limited: "请求过于频繁，请稍后重试。",
  internal: "调研助手服务出现异常，请稍后重试。",
  network_error: "无法连接调研助手服务，请确认 Research Scout API 已启动。",
  scope_empty: "当前项目没有可检索的范围，请先选择 collection。",
  index_not_ready: "文库索引尚未就绪，请先在「连接与覆盖」中完成一次同步。",
}

export function scoutProblemMessage(problem: ScoutApiProblem): string {
  const text = CODE_MESSAGES[problem.code] ?? (problem.message || "请求失败。")
  return problem.retryable ? `${text}（可重试）` : text
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function asScoutProblem(error: unknown): ScoutApiProblem {
  if (error instanceof ScoutApiProblem) return error
  if (isRecord(error)) {
    const status = typeof error.status === "number" ? error.status : 0
    const code = typeof error.code === "string" ? error.code : "internal"
    const message = typeof error.message === "string" ? error.message : "unknown error"
    const retryable = typeof error.retryable === "boolean" ? error.retryable : status >= 500
    const requestId = typeof error.requestId === "string" ? error.requestId : null
    const details = isRecord(error.details) ? error.details : undefined
    return new ScoutApiProblem({ status, code, message, retryable, requestId, details })
  }
  return new ScoutApiProblem({
    status: 0,
    code: "internal",
    message: error instanceof Error ? error.message : "unknown error",
    retryable: false,
    requestId: null,
  })
}

export type ScoutPage<T> = {
  items: T[]
  nextCursor: string | null
}

export function normalizeScoutPage<T>(payload: unknown): ScoutPage<T> {
  if (Array.isArray(payload)) {
    return { items: payload as T[], nextCursor: null }
  }
  if (isRecord(payload)) {
    const items = Array.isArray(payload.items) ? (payload.items as T[]) : []
    const meta = isRecord(payload.meta) ? payload.meta : undefined
    const fromMeta = typeof meta?.next_cursor === "string" ? meta.next_cursor : null
    const fromRoot = typeof payload.next_cursor === "string" ? payload.next_cursor : null
    return { items, nextCursor: fromMeta ?? fromRoot }
  }
  return { items: [], nextCursor: null }
}

/**
 * 归一化简报响应。
 *
 * 后端在「证据不足」弃答时会返回 `findings/citations = null` 而不是空数组;
 * 前端组件一律按数组处理,因此在边界处统一折叠为 []。
 */
export function normalizeScoutBrief(payload: unknown): ScoutBrief {
  const raw = (isRecord(payload) ? payload : {}) as unknown as Record<string, unknown>
  const arr = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])
  return {
    ...(raw as unknown as ScoutBrief),
    summary: typeof raw.summary === "string" ? raw.summary : "",
    summary_claims: arr(raw.summary_claims),
    findings: arr<ScoutFinding>(raw.findings),
    method_timeline: arr<Record<string, unknown>>(raw.method_timeline),
    chronology: arr<Record<string, unknown>>(raw.chronology),
    gaps: arr(raw.gaps),
    open_questions: arr<string>(raw.open_questions),
    citations: arr(raw.citations),
    source_status: arr(raw.source_status),
  }
}

export function scoutApiBaseUrl(): string {
  const configured = import.meta.env.VITE_SCOUT_API_BASE_URL
  const base = typeof configured === "string" && configured.trim() ? configured.trim() : DEFAULT_API_BASE
  return base.replace(/\/+$/, "")
}

function problemFromResponse(res: Response, payload: unknown): ScoutApiProblem {
  const body = isRecord(payload) && isRecord(payload.error) ? payload.error : undefined
  return new ScoutApiProblem({
    status: res.status,
    code: typeof body?.code === "string" ? body.code : "internal",
    message: typeof body?.message === "string" ? body.message : `HTTP ${res.status}`,
    retryable: typeof body?.retryable === "boolean" ? body.retryable : res.status >= 500,
    requestId:
      typeof body?.request_id === "string"
        ? body.request_id
        : res.headers.get("X-Request-ID"),
    details: isRecord(body?.details) ? body.details : undefined,
  })
}

async function requestResponse(
  path: string,
  init: RequestInit = {},
  retried = false,
): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set("Accept", "application/json")
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json")
  }
  const token = getToken()
  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  let res: Response
  try {
    res = await fetch(`${scoutApiBaseUrl()}${path}`, {
      ...init,
      headers,
      credentials: "same-origin",
    })
  } catch (cause) {
    throw new ScoutApiProblem({
      status: 0,
      code: "network_error",
      message: cause instanceof Error ? cause.message : "network unreachable",
      retryable: true,
      requestId: null,
    })
  }

  // Lab Nexus access tokens live 15 minutes. On the first 401 with a token in
  // hand, refresh once through the shared auth flow and replay the request. The
  // Zotero OAuth start call is included, so a stale token never blocks connect.
  if (res.status === 401 && token && !retried) {
    try {
      await refreshToken()
      return requestResponse(path, init, true)
    } catch {
      throw new ScoutApiProblem({
        status: 401,
        code: "unauthorized",
        message: "登录已过期，请重新登录 Lab Nexus 后重试。",
        retryable: false,
        requestId: res.headers.get("X-Request-ID"),
      })
    }
  }

  return res
}

async function problemFromRawResponse(res: Response): Promise<ScoutApiProblem> {
  const text = await res.text()
  let payload: unknown = null
  if (text.trim()) {
    try {
      payload = JSON.parse(text) as unknown
    } catch {
      payload = null
    }
  }
  return problemFromResponse(res, payload)
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await requestResponse(path, init)

  const text = await res.text()
  let payload: unknown = null
  if (text.trim()) {
    try {
      payload = JSON.parse(text) as unknown
    } catch {
      throw new ScoutApiProblem({
        status: res.status,
        code: "internal",
        message: "服务返回了无法解析的响应",
        retryable: res.status >= 500,
        requestId: res.headers.get("X-Request-ID"),
      })
    }
  }

  if (!res.ok) throw problemFromResponse(res, payload)
  return payload as T
}


/** 解析后端 SSE 重放响应(text/event-stream),返回结构化事件序列。
 *
 * 调研助手把「检索过程」持久化后回放,因此这里不是长连接,而是一次性
 * 读取完整事件流并解析;因此用 fetch + bearer 头而不是 EventSource。
 */
export function parseScoutEventStream(payload: string): ScoutQueryEvent[] {
  const events: ScoutQueryEvent[] = []
  for (const block of payload.split(/\n\n/)) {
    const lines = block.split(/\n/)
    let id = ""
    let type = ""
    const dataLines: string[] = []
    for (const line of lines) {
      if (line.startsWith(":")) continue
      if (line.startsWith("id:")) id = line.slice(3).trim()
      else if (line.startsWith("event:")) type = line.slice(6).trim()
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim())
    }
    if (!type || dataLines.length === 0) continue
    let data: Record<string, unknown> = {}
    try {
      const parsed = JSON.parse(dataLines.join("\n")) as unknown
      if (isRecord(parsed)) data = parsed
    } catch {
      data = {}
    }
    const seq = Number.parseInt(id, 10)
    events.push({
      id,
      seq: Number.isFinite(seq) ? seq : events.length,
      type,
      at: typeof data.at === "string" ? data.at : "",
      data,
    })
  }
  return events
}

export type ScoutExportFormat = "json" | "bibtex" | "csv"

export type ScoutBriefPayload = {
  question: string
  mode: ScoutRetrievalMode
}

async function listConnections(): Promise<ScoutConnection[]> {
  const payload = await request<unknown>("/zotero/connections")
  return normalizeScoutPage<ScoutConnection>(payload).items
}

export const scoutApi = {
  listConnections,
  startOAuth: () =>
    request<ScoutOAuthStart>("/zotero/oauth/start", {
      method: "POST",
      body: JSON.stringify({}),
    }),
  validateConnection: (connectionId: string) =>
    request<ScoutConnection>(`/zotero/connections/${connectionId}/validate`, { method: "POST" }),
  startSync: (connectionId: string) =>
    request<ScoutSyncRun>(`/zotero/connections/${connectionId}/sync`, {
      method: "POST",
      body: JSON.stringify({ mode: "incremental", force_full: false }),
    }),
  revokeConnection: (connectionId: string) =>
    request<void>(`/zotero/connections/${connectionId}/revoke`, { method: "POST" }),
  coverage: (connectionId: string) =>
    request<ScoutCoverage>(`/zotero/connections/${connectionId}/coverage`),
  listCollections: async (): Promise<ScoutCollection[]> => {
    const payload = await request<unknown>("/zotero/collections")
    return normalizeScoutPage<ScoutCollection>(payload).items
  },

  // ---- 检索 / 会话 / 简报(Stage 6 垂直切片) ----

  listProjects: async (): Promise<ScoutProject[]> => {
    const payload = await request<unknown>("/projects")
    return normalizeScoutPage<ScoutProject>(payload).items
  },
  createProject: (input: {
    name: string
    description?: string
    default_mode?: ScoutRetrievalMode
    // 后端 projectCreateRequest 直接绑定平铺字段,不是嵌套的 scope 对象。
    scope_mode?: ScoutScopeMode
    collection_ids?: string[]
  }) =>
    request<ScoutProject>("/projects", { method: "POST", body: JSON.stringify(input) }),
  getProject: (projectId: string) => request<ScoutProject>(`/projects/${projectId}`),
  updateProject: (
    projectId: string,
    input: { name?: string; description?: string; default_mode?: ScoutRetrievalMode },
  ) => request<ScoutProject>(`/projects/${projectId}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteProject: (projectId: string) =>
    request<unknown>(`/projects/${projectId}`, { method: "DELETE" }),
  projectScope: (projectId: string) => request<ScoutScope>(`/projects/${projectId}/scope`),
  saveProjectScope: (
    projectId: string,
    input: { scope_mode: ScoutScopeMode; collection_ids?: string[] },
  ) => request<ScoutScope>(`/projects/${projectId}/scope`, { method: "PUT", body: JSON.stringify(input) }),

  listSessions: async (projectId: string): Promise<ScoutSessionSummary[]> => {
    const payload = await request<unknown>(`/projects/${projectId}/sessions`)
    return normalizeScoutPage<ScoutSessionSummary>(payload).items
  },
  createSession: (projectId: string, input: ScoutBriefPayload, signal?: AbortSignal) =>
    request<ScoutSession>(`/projects/${projectId}/sessions`, {
      method: "POST",
      body: JSON.stringify({ question: input.question, mode: input.mode }),
      signal,
    }),
  getSession: (sessionId: string) => request<ScoutSession>(`/sessions/${sessionId}`),
  listTurns: async (sessionId: string): Promise<ScoutTurn[]> => {
    const payload = await request<unknown>(`/sessions/${sessionId}/turns`)
    return normalizeScoutPage<ScoutTurn>(payload).items
  },
  createTurn: (sessionId: string, input: ScoutBriefPayload, signal?: AbortSignal) =>
    request<ScoutTurn>(`/sessions/${sessionId}/turns`, {
      method: "POST",
      body: JSON.stringify({ question: input.question, mode: input.mode }),
      signal,
    }),
  cancelSession: (sessionId: string) =>
    request<ScoutSession>(`/sessions/${sessionId}/cancel`, { method: "POST" }),
  sessionEvents: async (sessionId: string): Promise<ScoutQueryEvent[]> => {
    const res = await requestResponse(`/sessions/${sessionId}/events`)
    if (!res.ok) throw await problemFromRawResponse(res)
    return parseScoutEventStream(await res.text())
  },

  sessionBrief: async (sessionId: string): Promise<ScoutBrief> =>
    normalizeScoutBrief(await request<unknown>(`/sessions/${sessionId}/brief`)),
  getBrief: async (briefId: string): Promise<ScoutBrief> =>
    normalizeScoutBrief(await request<unknown>(`/briefs/${briefId}`)),
  listBriefEvidence: async (briefId: string): Promise<ScoutEvidence[]> => {
    const payload = await request<unknown>(`/briefs/${briefId}/evidence`)
    return normalizeScoutPage<ScoutEvidence>(payload).items
  },
  listBriefGaps: async (briefId: string): Promise<ScoutGap[]> => {
    const payload = await request<unknown>(`/briefs/${briefId}/gaps`)
    return normalizeScoutPage<ScoutGap>(payload).items
  },
  submitFeedback: (briefId: string, input: { rating: number; comment?: string }) =>
    request<void>(`/briefs/${briefId}/feedback`, { method: "POST", body: JSON.stringify(input) }),
  exportBrief: async (briefId: string, format: ScoutExportFormat): Promise<Blob> => {
    const res = await requestResponse(`/briefs/${briefId}/export?format=${format}`)
    if (!res.ok) throw await problemFromRawResponse(res)
    return res.blob()
  },
}
