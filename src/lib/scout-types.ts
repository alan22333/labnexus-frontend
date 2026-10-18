/** Research Scout 控制面前端类型；只声明当前页面实际消费的字段。 */

export type ScoutConnectionStatus = "healthy" | "degraded" | "disconnected" | "revoked"

export interface ScoutConnection {
  id: string
  provider: "web_api"
  library_type: "user"
  library_id: string
  display_name?: string
  status: ScoutConnectionStatus
  last_library_version?: number | null
  last_sync_at?: string | null
  last_success_at?: string | null
  created_at: string
}

export interface ScoutOAuthStart {
  authorization_url: string
}

export interface ScoutCoverage {
  visible_items: number
  indexed_documents: number
  personal_fulltext: number
  structured_abstract: number
  metadata_only: number
  failed: number
  last_success_at?: string | null
  local_only_warning: boolean
}

export interface ScoutSyncRun {
  id: string
  connection_id: string
  mode: "full" | "incremental" | "retry"
  status: "pending" | "running" | "partial" | "complete" | "failed" | "canceled"
  started_at: string
  finished_at?: string | null
}

export interface ScoutCollection {
  id: string
  zotero_key: string
  parent_key?: string | null
  name: string
  version: number
  is_deleted: boolean
}

// ============ 检索 / 会话 / 简报(Stage 6 前端垂直切片) ============

/** 三种检索模式,与后端 domain.RetrievalMode 一一对应。 */
export type ScoutRetrievalMode = "my_library" | "gap_fill" | "landscape"

/** 项目范围模式:整库,或显式挑选若干 Zotero collection。 */
export type ScoutScopeMode = "all_library" | "selected_collections"

export type ScoutSessionStatus =
  | "accepted"
  | "running"
  | "degraded"
  | "completed"
  | "failed"
  | "canceled"

/** 会话阶段,与后端 domain.QueryPhase 对应;用于检索过程时间线。 */
export type ScoutQueryPhase =
  | "accepted"
  | "planning"
  | "retrieving_library"
  | "retrieving_scholarly"
  | "retrieving_web"
  | "ranking"
  | "drafting"
  | "verifying"
  | "completed"

/** 证据分层。personal_fulltext 才能单独支撑科学结论。 */
export type ScoutEvidenceType = "personal_fulltext" | "structured_abstract" | "web_context"

export type ScoutGapType = "canonical" | "related_method" | "latest_progress"

export type ScoutMissingRelativeTo = "personal_library" | "current_scope" | "external_only"

export type ScoutSupportLevel = "sufficient" | "partial" | "insufficient"

export type ScoutSourceName =
  | "zotero"
  | "rerank"
  | "semantic_scholar"
  | "openalex"
  | "qwen_web_search"

export type ScoutSourceState = "available" | "degraded" | "unavailable" | "skipped"

export interface ScoutSourceStatus {
  source: ScoutSourceName
  status: ScoutSourceState
  degraded_reason?: string | null
  request_id?: string | null
}

export interface ScoutProject {
  id: string
  name: string
  description?: string
  default_mode: ScoutRetrievalMode
  scope_mode: ScoutScopeMode
  /** 项目默认范围里的 Zotero collection id;整库模式下为空数组。 */
  collection_ids?: string[]
  /** 项目范围的版本号;范围每次变更都会自增,用于判断前端缓存是否过期。 */
  scope_version?: number
  created_at: string
  updated_at?: string
}

export interface ScoutScope {
  scope_mode: ScoutScopeMode
  collection_ids: string[]
  version: number
  created_at?: string
}

export interface ScoutSession {
  id: string
  project_id: string
  current_turn_id?: string | null
  mode: ScoutRetrievalMode
  status: ScoutSessionStatus
  phase: ScoutQueryPhase | string
  events_url?: string
  source_status?: ScoutSourceStatus[]
  created_at: string
  completed_at?: string | null
}

/** `GET /projects/:id/sessions` 返回的是精简会话记录,字段与 sessionResponse 不同。 */
export interface ScoutSessionSummary {
  id: string
  project_id: string
  title: string
  status: ScoutSessionStatus
  phase: ScoutQueryPhase | string
  index_epoch_id?: string | null
  created_at: string
  updated_at?: string | null
}

export interface ScoutTurn {
  id: string
  session_id: string
  turn_no: number
  question: string
  mode: ScoutRetrievalMode
  status: ScoutSessionStatus
  phase: ScoutQueryPhase | string
  created_at: string
  completed_at?: string | null
}

/** 证据与结论之间的支撑关系;stance 固定为 supports/contradicts 之类的稳定枚举。 */
export interface ScoutClaimEvidence {
  evidence_id: string
  stance: string
  support_score: number
  evidence_span?: string | null
  locator?: Record<string, unknown>
}

export interface ScoutFinding {
  claim_id: string
  claim_type: "finding" | string
  claim: string
  support_level: ScoutSupportLevel
  confidence?: number | null
  verification_status: string
  evidence_ids: string[]
  claim_evidence: ScoutClaimEvidence[]
}

export interface ScoutEvidence {
  id: string
  brief_id: string
  index_epoch_id?: string | null
  evidence_type: ScoutEvidenceType
  title: string
  quote?: string | null
  url?: string | null
  document_id?: string | null
  document_version_id?: string | null
  chunk_id?: string | null
  external_work_id?: string | null
  locator?: Record<string, unknown>
  score: number
  retrieved_at: string
}

export interface ScoutGap {
  id: string
  gap_type: ScoutGapType
  missing_relative_to: ScoutMissingRelativeTo
  external_work_id?: string | null
  document_id?: string | null
  explanation: string
  score?: number
  rationale?: Record<string, unknown>
}

export interface ScoutBrief {
  id: string
  session_id: string
  turn_id: string
  schema_version: string
  index_epoch_id?: string | null
  retrieval_config_version: string
  prompt_version: string
  summary: string
  summary_claims?: unknown[]
  findings: ScoutFinding[]
  method_timeline: Record<string, unknown>[]
  chronology: Record<string, unknown>[]
  gaps: ScoutGap[]
  open_questions: string[]
  citations: ScoutEvidence[]
  source_status: ScoutSourceStatus[]
  created_at: string
}

export interface ScoutQueryEvent {
  id: string
  seq: number
  type: string
  at: string
  data: Record<string, unknown>
}

export interface ScoutDiscoveryWork {
  id: string
  identity_key: string
  doi?: string | null
  s2_id?: string | null
  openalex_id?: string | null
  pmid?: string | null
  title: string
  abstract?: string | null
  year?: number | null
  venue?: string | null
  citation_count?: number | null
  type?: string | null
  source_status?: ScoutSourceStatus
}

export interface ScoutDiscoveryPage {
  items: ScoutDiscoveryWork[]
  next_cursor?: string | null
  source_status: ScoutSourceStatus[]
}

// ---- 展示层元数据(标签 / 说明 / 配色) ----

export const SCOUT_MODE_META: Record<
  ScoutRetrievalMode,
  { label: string; short: string; description: string; accent: string }
> = {
  my_library: {
    label: "我的文库",
    short: "文库问答",
    description: "只在你选定的 Zotero 范围内检索,回答必须带可追溯引用。",
    accent: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-900",
  },
  gap_fill: {
    label: "查缺补漏",
    short: "查缺补漏",
    description: "在文库基础上对照外部权威来源,指出你漏掉的重要工作。",
    accent: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900",
  },
  landscape: {
    label: "全景调研",
    short: "全景调研",
    description: "文库 + 外部发现 + 联网背景,产出进入陌生领域所需的全景简报。",
    accent: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-900",
  },
}

export const SCOUT_EVIDENCE_META: Record<
  ScoutEvidenceType,
  { label: string; hint: string; rank: number; className: string }
> = {
  personal_fulltext: {
    label: "个人全文",
    hint: "可直接支撑科学结论的首要证据",
    rank: 1,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300",
  },
  structured_abstract: {
    label: "结构化摘要",
    hint: "全文缺失时的降级证据,只能得到部分支持",
    rank: 2,
    className: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300",
  },
  web_context: {
    label: "联网背景",
    hint: "仅作背景与线索,不能单独支撑科学结论",
    rank: 3,
    className: "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
  },
}

export const SCOUT_GAP_META: Record<
  ScoutGapType,
  { label: string; hint: string }
> = {
  canonical: { label: "经典工作", hint: "领域内公认的奠基或综述性工作" },
  related_method: { label: "相关方法", hint: "与问题高度相关但当前范围内缺失的方法" },
  latest_progress: { label: "最新进展", hint: "近两年出现、尚未进入你文库的进展" },
}

export const SCOUT_MISSING_META: Record<ScoutMissingRelativeTo, string> = {
  personal_library: "缺失于个人文库",
  current_scope: "缺失于当前范围",
  external_only: "仅外部发现",
}

export const SCOUT_SUPPORT_META: Record<
  ScoutSupportLevel,
  { label: string; className: string }
> = {
  sufficient: {
    label: "充分支持",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300",
  },
  partial: {
    label: "部分支持",
    className: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
  },
  insufficient: {
    label: "证据不足",
    className: "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
  },
}

export const SCOUT_SOURCE_META: Record<ScoutSourceName, string> = {
  zotero: "Zotero 文库",
  rerank: "重排序",
  semantic_scholar: "Semantic Scholar",
  openalex: "OpenAlex",
  qwen_web_search: "联网搜索",
}

export const SCOUT_SOURCE_STATE_META: Record<
  ScoutSourceState,
  { label: string; className: string }
> = {
  available: {
    label: "可用",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300",
  },
  degraded: {
    label: "降级",
    className: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
  },
  unavailable: {
    label: "不可用",
    className: "border-destructive/20 bg-destructive/10 text-destructive",
  },
  skipped: {
    label: "未启用",
    className: "border-border bg-muted text-muted-foreground",
  },
}

export const SCOUT_PHASE_META: Record<string, string> = {
  accepted: "已受理",
  planning: "拆解问题",
  retrieving_library: "检索你的文库",
  retrieving_scholarly: "检索外部学术来源",
  retrieving_web: "检索联网背景",
  ranking: "重排序与去重",
  drafting: "生成简报",
  verifying: "核验引用",
  completed: "已完成",
}

export const SCOUT_SESSION_STATUS_META: Record<
  ScoutSessionStatus,
  { label: string; className: string }
> = {
  accepted: { label: "已受理", className: "border-border bg-muted text-muted-foreground" },
  running: { label: "进行中", className: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300" },
  degraded: { label: "降级完成", className: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200" },
  completed: { label: "已完成", className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300" },
  failed: { label: "失败", className: "border-destructive/20 bg-destructive/10 text-destructive" },
  canceled: { label: "已取消", className: "border-border bg-muted text-muted-foreground" },
}

/** 简报里唯一允许的"证据不足"摘要句式;用于把 abstain 与普通回答区分开。 */
export function scoutBriefAbstained(brief: ScoutBrief | null): boolean {
  if (!brief) return false
  // 后端在弃答时会返回 findings/citations = null 而不是空数组,这里必须容错。
  if ((brief.findings?.length ?? 0) > 0) return false
  return (brief.summary || "").toLowerCase().startsWith("insufficient scientific evidence")
}

/** 是否包含中日韩文字;用于提示跨语言检索的已知限制。 */
export function containsCJK(text: string): boolean {
  return /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/.test(text)
}
