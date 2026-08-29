import type {
  Comment, Document, FinanceBatch, FinanceBatchDetail, FinanceBatchListItem, FinanceBill, FinanceItem, FinanceLedger,
  FinanceSubmission, FinanceTransaction, Folder, ImportPreview, Milestone, Pagination,
  ParticipantStat, Project, ProjectDetail, Resource, SearchResults, SpaceResponse, Tag,
  Task, User, Visibility,
} from "./types"

const TOKEN_KEY = "ln_token"

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? ""
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  code: string
  status: number
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = "ApiError"
    this.code = code
    this.status = status
  }
}

type Query = Record<string, string | number | boolean | undefined | null>

function buildQuery(q?: Query): string {
  if (!q) return ""
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(q)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v))
  }
  const s = params.toString()
  return s ? `?${s}` : ""
}

let refreshing: Promise<string> | null = null

async function refreshToken(): Promise<string> {
  if (!refreshing) {
    refreshing = (async () => {
      const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin" })
      if (!res.ok) throw new ApiError(res.status, "AUTH_REQUIRED", "登录已过期,请重新登录")
      const data = (await res.json()) as { access_token: string }
      setToken(data.access_token)
      return data.access_token
    })().finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

async function request<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const token = getToken()
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json")
  if (token) headers.set("Authorization", `Bearer ${token}`)

  const res = await fetch(`/api${path}`, {
    ...init,
    headers,
    credentials: "same-origin",
  })

  if (res.status === 401 && token && !retried && !path.startsWith("/auth/")) {
    try {
      await refreshToken()
      return request<T>(path, init, true)
    } catch {
      // refresh 失败 → 抛出原始错误,由调用方引导登录
    }
  }

  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } })?.error
    throw new ApiError(res.status, err?.code ?? "INTERNAL", err?.message ?? `请求失败(HTTP ${res.status})`)
  }
  return data as T
}

// ============ 认证 F1 ============
export const authApi = {
  register: (body: { invite_code: string; username: string; display_name: string; password: string }) =>
    request<{ access_token: string; user: User }>("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { username: string; password: string }) =>
    request<{ access_token: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  me: () => request<{ user: User }>("/me"),
  updateMe: (body: { display_name?: string; password?: string; old_password?: string }) =>
    request<{ user: User }>("/me", { method: "PATCH", body: JSON.stringify(body) }),
}

// ============ 空间与目录 F2 ============
export const spaceApi = {
  getSpace: () => request<SpaceResponse>("/me/space"),
  createFolder: (body: { name: string; parent_id?: string | null }) =>
    request<{ folder: Folder }>("/me/folders", { method: "POST", body: JSON.stringify(body) }),
  renameFolder: (id: string, body: { name?: string; sort_order?: number }) =>
    request<{ folder: Folder }>(`/me/folders/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteFolder: (id: string) => request<void>(`/me/folders/${id}`, { method: "DELETE" }),
}

// ============ 文档/信息流 F3 F4 ============
export interface DocumentPayload {
  title: string
  content: string
  visibility: Visibility
  folder_id?: string | null
  tag_ids?: string[]
  pinned?: boolean
}

export const documentApi = {
  listMine: (q?: { folder_id?: string; visibility?: Visibility }) =>
    request<{ documents: Document[] }>(`/me/documents${buildQuery(q)}`),
  create: (body: DocumentPayload) =>
    request<{ document: Document }>("/me/documents", { method: "POST", body: JSON.stringify(body) }),
  get: (id: string) => request<Document>(`/documents/${id}`),
  update: (id: string, body: Partial<DocumentPayload>) =>
    request<{ document: Document }>(`/documents/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: string) => request<void>(`/documents/${id}`, { method: "DELETE" }),
  feed: (q: { sort?: "latest" | "hot"; page?: number; page_size?: number }) =>
    request<{ documents: Document[]; pagination: Pagination }>(`/feed${buildQuery(q)}`),
  toggleReaction: (id: string) =>
    request<void>(`/documents/${id}/reactions`, { method: "POST", body: JSON.stringify({ emoji: "👍" }) }),
  comments: (id: string) => request<{ comments: Comment[] }>(`/documents/${id}/comments`),
  addComment: (id: string, body: { content: string; reply_to_id?: string }) =>
    request<{ comment: Comment }>(`/documents/${id}/comments`, { method: "POST", body: JSON.stringify(body) }),
  deleteComment: (id: string) => request<void>(`/comments/${id}`, { method: "DELETE" }),
}

// ============ 标签 F5 ============
export const tagApi = {
  list: () => request<{ tags: Tag[] }>("/tags"),
  create: (body: { name: string; color?: string }) =>
    request<{ tag: Tag }>("/tags", { method: "POST", body: JSON.stringify(body) }),
  contents: (id: string) =>
    request<{ documents: Document[]; resources: Resource[] }>(`/tags/${id}/contents`),
}

// ============ 搜索 F6 ============
export const searchApi = {
  run: (q: string, type?: "document" | "resource" | "task") =>
    request<SearchResults>(`/search${buildQuery({ q, type })}`),
}

// ============ 资源库 F7 ============
export const resourceApi = {
  list: (q?: { type?: "link" | "file"; tag_id?: string; keyword?: string; page?: number; page_size?: number }) =>
    request<{ resources: Resource[]; pagination: Pagination }>(`/resources${buildQuery(q)}`),
  createLink: (body: { title: string; url: string; description?: string; tag_ids?: string[] }) =>
    request<{ resource: Resource }>("/resources", { method: "POST", body: JSON.stringify(body) }),
  upload: (body: { file: File; title?: string; description?: string; tag_ids?: string[] }) => {
    const form = new FormData()
    form.append("file", body.file)
    if (body.title) form.append("title", body.title)
    if (body.description) form.append("description", body.description)
    if (body.tag_ids?.length) form.append("tag_ids", JSON.stringify(body.tag_ids))
    return request<{ resource: Resource }>("/resources/upload", { method: "POST", body: form })
  },
  get: (id: string) => request<{ resource: Resource }>(`/resources/${id}`),
  update: (id: string, body: { title?: string; description?: string; tag_ids?: string[] }) =>
    request<{ resource: Resource }>(`/resources/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: string) => request<void>(`/resources/${id}`, { method: "DELETE" }),
}

// ============ 项目与任务 F9 ============
export const projectApi = {
  list: () => request<{ projects: Project[] }>("/projects"),
  create: (body: { name: string; description?: string }) =>
    request<{ project: Project }>("/projects", { method: "POST", body: JSON.stringify(body) }),
  get: (id: string) =>
    request<{ project: ProjectDetail }>(`/projects/${id}`).then((d) => d.project),
  update: (id: string, body: { name?: string; description?: string; status?: string }) =>
    request<{ project: Project }>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  addMember: (id: string, body: { user_id: string; role?: string }) =>
    request<{ member: { user: User } }>(`/projects/${id}/members`, { method: "POST", body: JSON.stringify(body) }),
  removeMember: (projectId: string, userId: string) =>
    request<void>(`/projects/${projectId}/members/${userId}`, { method: "DELETE" }),
  addMilestone: (projectId: string, body: { name: string; due_date?: string | null }) =>
    request<{ milestone: Milestone }>(`/projects/${projectId}/milestones`, { method: "POST", body: JSON.stringify(body) }),
  updateMilestone: (id: string, body: { name?: string; due_date?: string | null; completed_at?: string | null }) =>
    request<{ milestone: Milestone }>(`/milestones/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  tasks: (projectId: string, q?: { status?: string; assignee_id?: string; milestone_id?: string }) =>
    request<{ tasks: Task[] }>(`/projects/${projectId}/tasks${buildQuery(q)}`),
  createTask: (projectId: string, body: Partial<Task>) =>
    request<{ task: Task }>(`/projects/${projectId}/tasks`, { method: "POST", body: JSON.stringify(body) }),
  updateTask: (id: string, body: Partial<Task>) =>
    request<{ task: Task }>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  transitionTask: (id: string, status: string) =>
    request<{ task: Task }>(`/tasks/${id}/transition`, { method: "POST", body: JSON.stringify({ status }) }),
  deleteTask: (id: string) => request<void>(`/tasks/${id}`, { method: "DELETE" }),
}

export async function fetchBlob(path: string): Promise<Blob> {
  // 后端返回的 preview.url / download_url 已含 /api 前缀,避免重复拼接
  const full = path.startsWith("/api") ? path : `/api${path}`
  const res = await fetch(full, {
    headers: { Authorization: `Bearer ${getToken()}` },
    credentials: "same-origin",
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    let message = `请求失败(HTTP ${res.status})`
    try {
      const data = JSON.parse(text) as { error?: { message?: string } }
      if (data?.error?.message) message = data.error.message
    } catch {
      // 非 JSON 响应(如 HTML 错误页),保留默认消息
    }
    throw new ApiError(res.status, "FILE_FETCH_FAILED", message)
  }
  return res.blob()
}






// ============ 经费管理 F10(仅 admin/supervisor,金额以分传输) ============
export const financeApi = {
  batches: () => request<{ batches: FinanceBatchListItem[] }>("/finance/batches"),
  createBatch: (body: { name: string; note?: string }) =>
    request<{ batch: FinanceBatch }>("/finance/batches", { method: "POST", body: JSON.stringify(body) }),
  getBatch: (id: string) => request<{ batch: FinanceBatchDetail }>("/finance/batches/" + id),
  deleteBatch: (id: string) => request<void>("/finance/batches/" + id, { method: "DELETE" }),
  completeBatch: (id: string) =>
    request<{ batch: FinanceBatch }>("/finance/batches/" + id + "/complete", { method: "POST" }),
  createItem: (
    batchId: string,
    body: {
      name: string
      student_no: string
      date: string
      payroll_amount: number
      tax_amount: number
      tip_amount: number
      should_return?: number
      note?: string
    }
  ) => request<{ item: FinanceItem }>("/finance/batches/" + batchId + "/items", { method: "POST", body: JSON.stringify(body) }),
  // 下载导入模板(xlsx blob)
  importTemplate: () => fetchBlob("/finance/import-template"),
  importPreview: (batchId: string, file: File) => {
    const form = new FormData()
    form.append("file", file)
    return request<ImportPreview>("/finance/batches/" + batchId + "/items/import-preview", { method: "POST", body: form })
  },
  confirmImport: (previewId: string, batchId: string) =>
    request<{ imported_count: number; skipped_count: number }>(
      "/finance/imports/" + previewId + "/confirm" + buildQuery({ batch_id: batchId }),
      { method: "POST" }
    ),
  submit: (itemId: string, body: { amount: number; date: string; note?: string }) =>
    request<{ submission: FinanceSubmission }>("/finance/items/" + itemId + "/submit", { method: "POST", body: JSON.stringify(body) }),
  ledger: () => request<FinanceLedger>("/finance/ledger"),
  addIncome: (body: { amount: number; date: string; note?: string }) =>
    request<{ transaction: FinanceTransaction }>("/finance/ledger/income", { method: "POST", body: JSON.stringify(body) }),
  addExpense: (body: { amount: number; date: string; note?: string }) =>
    request<{ transaction: FinanceTransaction }>("/finance/ledger/expense", { method: "POST", body: JSON.stringify(body) }),
  participants: () => request<{ participants: ParticipantStat[] }>("/finance/participants"),
  participantBills: (id: string) =>
    request<{ participant: { id: string; name: string; student_no: string; note: string; created_at: string }; bills: FinanceBill[] }>(
      "/finance/participants/" + id + "/bills"
    ),
}
