import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react"
import { useNavigate } from "react-router-dom"
import {
  AlertTriangle,
  ArrowRight,
  BookMarked,
  ChevronDown,
  FolderTree,
  History,
  Layers,
  Loader2,
  MessageSquarePlus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import {
  BriefPanel,
  type BriefExportFormat,
} from "@/components/scout/BriefPanel"
import { RetrievalProgress } from "@/components/scout/RetrievalProgress"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatDateTime, timeAgo } from "@/lib/format"
import { asScoutProblem, scoutApi, scoutProblemMessage } from "@/lib/scout-api"
import {
  SCOUT_MODE_META,
  SCOUT_PHASE_META,
  SCOUT_SESSION_STATUS_META,
  containsCJK,
  type ScoutBrief,
  type ScoutCollection,
  type ScoutEvidence,
  type ScoutProject,
  type ScoutQueryEvent,
  type ScoutRetrievalMode,
  type ScoutScope,
  type ScoutScopeMode,
  type ScoutSession,
  type ScoutSessionSummary,
  type ScoutTurn,
} from "@/lib/scout-types"
import { cn } from "@/lib/utils"

const MODES: ScoutRetrievalMode[] = ["my_library", "gap_fill", "landscape"]

function errorText(error: unknown): string {
  return scoutProblemMessage(asScoutProblem(error))
}

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((value, index) => value === sortedB[index])
}

/** 把持久化的检索事件翻译成一句人话;不展示隐藏推理,只展示阶段/工具/来源。 */
function eventText(event: ScoutQueryEvent): string {
  const data = event.data ?? {}
  const asText = (value: unknown) =>
    value === undefined || value === null ? "" : String(value)
  switch (event.type) {
    case "session_accepted":
      return "会话已受理"
    case "plan_updated":
      return `检索计划 · ${asText(data.intent) || asText(data.plan_version) || "已生成"}`
    case "phase_changed":
      return `阶段 · ${SCOUT_PHASE_META[asText(data.phase)] ?? asText(data.phase)}`
    case "tool_started":
      return `开始调用 · ${asText(data.tool) || asText(data.name) || "工具"}`
    case "tool_completed":
      return `调用完成 · ${asText(data.tool) || asText(data.name) || "工具"}`
    case "source_status":
      return `来源状态 · ${asText(data.source)} / ${asText(data.status)}`
    case "evidence_ready":
      return `命中证据 · ${asText(data.evidence_type)}`
    case "brief_ready":
      return "简报已生成"
    case "error":
      return `错误 · ${asText(data.code) || asText(data.message)}`
    default:
      return event.type
  }
}

export function ScoutResearchPage() {
  const navigate = useNavigate()

  // ---- 项目 ----
  const [projects, setProjects] = useState<ScoutProject[]>([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [projectsError, setProjectsError] = useState("")
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [projectDialog, setProjectDialog] = useState<"create" | "edit" | null>(
    null,
  )
  const [projectName, setProjectName] = useState("")
  const [projectDescription, setProjectDescription] = useState("")
  const [projectSaving, setProjectSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ScoutProject | null>(null)

  // ---- 检索范围 ----
  const [scope, setScope] = useState<ScoutScope | null>(null)
  const [scopeLoading, setScopeLoading] = useState(false)
  const [scopeError, setScopeError] = useState("")
  const [draftScopeMode, setDraftScopeMode] =
    useState<ScoutScopeMode>("all_library")
  const [draftCollectionIds, setDraftCollectionIds] = useState<string[]>([])
  const [scopeSaving, setScopeSaving] = useState(false)

  // ---- collection 目录(库级,与项目无关) ----
  const [collections, setCollections] = useState<ScoutCollection[]>([])
  const [collectionsLoading, setCollectionsLoading] = useState(true)
  const [collectionsError, setCollectionsError] = useState("")
  const [collectionFilter, setCollectionFilter] = useState("")

  // ---- 提问 ----
  const [mode, setMode] = useState<ScoutRetrievalMode>("my_library")
  const [question, setQuestion] = useState("")
  const [asking, setAsking] = useState(false)
  const [askStartedAt, setAskStartedAt] = useState<number | null>(null)
  const [askError, setAskError] = useState("")

  // ---- 会话 / 简报 ----
  const [session, setSession] = useState<ScoutSession | null>(null)
  const [sessions, setSessions] = useState<ScoutSessionSummary[]>([])
  const [turns, setTurns] = useState<ScoutTurn[]>([])
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null)
  const [briefByTurn, setBriefByTurn] = useState<Record<string, ScoutBrief>>({})
  const [latestBrief, setLatestBrief] = useState<ScoutBrief | null>(null)
  const [briefLoading, setBriefLoading] = useState(false)
  const [briefError, setBriefError] = useState("")
  const [events, setEvents] = useState<ScoutQueryEvent[]>([])
  const [activeEvidenceId, setActiveEvidenceId] = useState<string | null>(null)
  const [feedbackByBrief, setFeedbackByBrief] = useState<
    Record<string, 1 | -1>
  >({})
  const [exporting, setExporting] = useState<BriefExportFormat | null>(null)

  const questionRef = useRef<HTMLTextAreaElement | null>(null)
  const briefSectionRef = useRef<HTMLDivElement | null>(null)
  const scrollAfterAskRef = useRef(false)
  const modeButtonRefs = useRef<
    Partial<Record<ScoutRetrievalMode, HTMLButtonElement | null>>
  >({})

  const activeProject = useMemo(
    () => projects.find((item) => item.id === activeProjectId) ?? null,
    [projects, activeProjectId],
  )

  const scopeDirty = useMemo(() => {
    if (!scope) return false
    if (scope.scope_mode !== draftScopeMode) return true
    return !sameIds(scope.collection_ids ?? [], draftCollectionIds)
  }, [scope, draftScopeMode, draftCollectionIds])

  const visibleCollections = useMemo(() => {
    const keyword = collectionFilter.trim().toLowerCase()
    return collections
      .filter((item) => !item.is_deleted)
      .filter((item) =>
        keyword ? item.name.toLowerCase().includes(keyword) : true,
      )
      .sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"))
  }, [collections, collectionFilter])

  const displayBrief = useMemo(() => {
    if (!activeTurnId) return latestBrief
    return (
      briefByTurn[activeTurnId] ??
      (latestBrief?.turn_id === activeTurnId ? latestBrief : null) ??
      latestBrief
    )
  }, [activeTurnId, briefByTurn, latestBrief])

  const activeTurn = useMemo(
    () => turns.find((item) => item.id === activeTurnId) ?? null,
    [turns, activeTurnId],
  )

  useEffect(() => {
    if (asking || !scrollAfterAskRef.current || !displayBrief) return
    scrollAfterAskRef.current = false
    window.requestAnimationFrame(() => {
      briefSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    })
  }, [asking, displayBrief])

  function handleModeKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    current: ScoutRetrievalMode,
  ) {
    const keys = [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
    ]
    if (!keys.includes(event.key)) return
    event.preventDefault()
    const currentIndex = MODES.indexOf(current)
    let nextIndex = currentIndex
    if (event.key === "Home") nextIndex = 0
    else if (event.key === "End") nextIndex = MODES.length - 1
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      nextIndex = (currentIndex - 1 + MODES.length) % MODES.length
    else nextIndex = (currentIndex + 1) % MODES.length
    const next = MODES[nextIndex]
    setMode(next)
    window.requestAnimationFrame(() => modeButtonRefs.current[next]?.focus())
  }

  // ---- 加载项目 ----
  const loadProjects = useCallback(async () => {
    setProjectsLoading(true)
    setProjectsError("")
    try {
      const items = await scoutApi.listProjects()
      setProjects(items)
      setActiveProjectId((current) => current ?? items[0]?.id ?? null)
    } catch (error) {
      setProjectsError(errorText(error))
    } finally {
      setProjectsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProjects()
  }, [loadProjects])

  // ---- collection 目录只加载一次 ----
  useEffect(() => {
    let cancelled = false
    setCollectionsLoading(true)
    setCollectionsError("")
    void scoutApi
      .listCollections()
      .then((items) => {
        if (!cancelled) setCollections(items)
      })
      .catch((error: unknown) => {
        if (!cancelled) setCollectionsError(errorText(error))
      })
      .finally(() => {
        if (!cancelled) setCollectionsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const resetSessionState = useCallback(() => {
    setSession(null)
    setTurns([])
    setActiveTurnId(null)
    setLatestBrief(null)
    setBriefByTurn({})
    setBriefError("")
    setEvents([])
    setActiveEvidenceId(null)
    setFeedbackByBrief({})
    scrollAfterAskRef.current = false
  }, [])

  // ---- 切换项目:重置会话,加载范围与历史会话 ----
  useEffect(() => {
    if (!activeProjectId) return
    let cancelled = false
    resetSessionState()
    setScopeLoading(true)
    setScopeError("")
    setAskError("")
    const project = projects.find((item) => item.id === activeProjectId)
    if (project?.default_mode) setMode(project.default_mode)

    void scoutApi
      .projectScope(activeProjectId)
      .then((data) => {
        if (cancelled) return
        setScope(data)
        setDraftScopeMode(data.scope_mode)
        setDraftCollectionIds(data.collection_ids ?? [])
      })
      .catch((error: unknown) => {
        if (!cancelled) setScopeError(errorText(error))
      })
      .finally(() => {
        if (!cancelled) setScopeLoading(false)
      })

    void scoutApi
      .listSessions(activeProjectId)
      .then((items) => {
        if (!cancelled) setSessions(items)
      })
      .catch(() => {
        if (!cancelled) setSessions([])
      })

    return () => {
      cancelled = true
    }
    // projects 变化会带来 default_mode,但不需要因此重新拉取;用 activeProjectId 单独触发。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId])

  // ---- 定位到被引用的证据 ----
  useEffect(() => {
    if (!activeEvidenceId) return
    const node = document.getElementById(`evidence-${activeEvidenceId}`)
    node?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [activeEvidenceId])

  const openSession = useCallback(async (sessionId: string) => {
    setBriefLoading(true)
    setBriefError("")
    setActiveTurnId(null)
    setActiveEvidenceId(null)
    try {
      const [loadedSession, turnList] = await Promise.all([
        scoutApi.getSession(sessionId),
        scoutApi.listTurns(sessionId),
      ])
      setSession(loadedSession)
      setTurns(turnList)
      const currentTurnId =
        loadedSession.current_turn_id ??
        turnList[turnList.length - 1]?.id ??
        null
      setActiveTurnId(currentTurnId)
      if (loadedSession.mode) setMode(loadedSession.mode)
      const [brief, eventList] = await Promise.all([
        scoutApi.sessionBrief(sessionId).catch(() => null),
        scoutApi.sessionEvents(sessionId).catch(() => [] as ScoutQueryEvent[]),
      ])
      setLatestBrief(brief)
      if (brief?.turn_id)
        setBriefByTurn((prev) => ({ ...prev, [brief.turn_id]: brief }))
      setEvents(eventList)
      if (brief) setFeedbackByBrief({})
    } catch (error) {
      setBriefError(errorText(error))
    } finally {
      setBriefLoading(false)
    }
  }, [])

  const refreshSessions = useCallback(async (projectId: string) => {
    try {
      setSessions(await scoutApi.listSessions(projectId))
    } catch {
      /* 历史会话刷新失败不影响主流程 */
    }
  }, [])

  // ---- 提问 ----
  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const value = question.trim()
    if (!value || !activeProjectId || asking) return
    if (
      draftScopeMode === "selected_collections" &&
      draftCollectionIds.length === 0
    ) {
      setAskError(
        "当前项目的检索范围没有选中任何 collection，请先在左侧选择范围。",
      )
      return
    }
    if (scopeDirty) {
      setAskError("检索范围有未保存的修改，请先点击「保存范围」。")
      return
    }

    setAskError("")
    setAsking(true)
    setAskStartedAt(Date.now())
    setActiveEvidenceId(null)
    scrollAfterAskRef.current = true

    try {
      let sessionId = session?.id ?? null
      let turnId: string | null = null

      if (sessionId) {
        const turn = await scoutApi.createTurn(sessionId, {
          question: value,
          mode,
        })
        turnId = turn.id
        setSession(await scoutApi.getSession(sessionId))
      } else {
        const created = await scoutApi.createSession(activeProjectId, {
          question: value,
          mode,
        })
        sessionId = created.id
        turnId = created.current_turn_id ?? null
        setSession(created)
      }

      const [brief, turnList, eventList] = await Promise.all([
        scoutApi.sessionBrief(sessionId),
        scoutApi.listTurns(sessionId),
        scoutApi.sessionEvents(sessionId).catch(() => [] as ScoutQueryEvent[]),
      ])

      const resolvedTurnId = turnId ?? brief.turn_id ?? null
      setTurns(turnList)
      setLatestBrief(brief)
      setActiveTurnId(resolvedTurnId)
      setBriefByTurn((prev) =>
        resolvedTurnId ? { ...prev, [resolvedTurnId]: brief } : prev,
      )
      setEvents(eventList)
      setFeedbackByBrief({})
      setQuestion("")
      void refreshSessions(activeProjectId)
    } catch (error) {
      setAskError(errorText(error))
    } finally {
      setAsking(false)
      setAskStartedAt(null)
    }
  }

  // ---- 范围保存 ----
  async function handleSaveScope() {
    if (!activeProjectId) return
    if (
      draftScopeMode === "selected_collections" &&
      draftCollectionIds.length === 0
    ) {
      toast.error("请至少选择一个 collection。")
      return
    }
    setScopeSaving(true)
    try {
      const saved = await scoutApi.saveProjectScope(activeProjectId, {
        scope_mode: draftScopeMode,
        collection_ids:
          draftScopeMode === "all_library" ? [] : draftCollectionIds,
      })
      setScope(saved)
      setDraftScopeMode(saved.scope_mode)
      setDraftCollectionIds(saved.collection_ids ?? [])
      toast.success("检索范围已保存，下一次提问生效。")
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setScopeSaving(false)
    }
  }

  // ---- 项目增删改 ----
  function openCreateProject() {
    setProjectName("")
    setProjectDescription("")
    setProjectDialog("create")
  }

  function openEditProject(project: ScoutProject) {
    setProjectName(project.name)
    setProjectDescription(project.description ?? "")
    setProjectDialog("edit")
  }

  async function submitProjectDialog() {
    const name = projectName.trim()
    if (!name) {
      toast.error("请填写项目名称。")
      return
    }
    setProjectSaving(true)
    try {
      if (projectDialog === "edit" && activeProject) {
        const updated = await scoutApi.updateProject(activeProject.id, {
          name,
          description: projectDescription.trim(),
        })
        setProjects((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item)),
        )
        toast.success("项目已更新。")
      } else {
        const created = await scoutApi.createProject({
          name,
          description: projectDescription.trim(),
          default_mode: mode,
          scope_mode: "all_library",
          collection_ids: [],
        })
        setProjects((prev) => [...prev, created])
        setActiveProjectId(created.id)
        toast.success("项目已创建。")
      }
      setProjectDialog(null)
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setProjectSaving(false)
    }
  }

  async function confirmDeleteProject() {
    const target = deleteTarget
    if (!target) return
    try {
      await scoutApi.deleteProject(target.id)
      setProjects((prev) => prev.filter((item) => item.id !== target.id))
      if (activeProjectId === target.id) {
        const next = projects.find((item) => item.id !== target.id) ?? null
        setActiveProjectId(next?.id ?? null)
      }
      toast.success("项目已删除。")
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setDeleteTarget(null)
    }
  }

  async function handleExport(format: BriefExportFormat) {
    if (!displayBrief) return
    setExporting(format)
    try {
      const blob = await scoutApi.exportBrief(displayBrief.id, format)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `research-brief-${displayBrief.id}.${format === "bibtex" ? "bib" : format}`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setExporting(null)
    }
  }

  async function handleFeedback(rating: 1 | -1) {
    if (!displayBrief) return
    try {
      await scoutApi.submitFeedback(displayBrief.id, { rating })
      setFeedbackByBrief((prev) => ({ ...prev, [displayBrief.id]: rating }))
      toast.success("已记录你的反馈，谢谢。")
    } catch (error) {
      toast.error(errorText(error))
    }
  }

  function handleFocusEvidence(evidence: ScoutEvidence) {
    setActiveEvidenceId(evidence.id)
  }

  const currentFeedback = displayBrief
    ? (feedbackByBrief[displayBrief.id] ?? null)
    : null
  const cjkQuestion = containsCJK(question)

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-2xl bg-slate-950 p-6 text-white shadow-lg sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)] lg:items-end">
          <div>
            <Badge className="border-white/15 bg-white/10 text-white">
              Research Scout · 检索工作台
            </Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              调研工作台
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              先选项目与检索范围，再提问。回答以你的 Zotero
              文库为证据底座，每条结论都能追溯到具体文献；
              缺什么、哪些没覆盖，同样会写清楚。
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                <ShieldCheck className="size-3.5 text-emerald-300" />{" "}
                全文证据优先
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                <Layers className="size-3.5 text-sky-300" /> 三种调研模式
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                <Search className="size-3.5 text-violet-300" /> 缺口与降级可见
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
            <p className="text-xs font-medium tracking-[0.16em] text-slate-400 uppercase">
              当前项目
            </p>
            <p className="mt-2 text-lg font-semibold">
              {activeProject?.name ?? "尚未选择"}
            </p>
            <p className="mt-1 text-xs text-slate-300">
              {scope?.scope_mode === "selected_collections"
                ? `限定 ${scope.collection_ids.length} 个 collection`
                : "整库检索"}
              {scope ? ` · 范围版本 v${scope.version}` : ""}
            </p>
            <Button
              size="sm"
              className="mt-4 bg-white text-slate-950 hover:bg-slate-100"
              onClick={() => navigate("/scout/connections")}
            >
              连接与覆盖
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:self-start xl:overflow-y-auto xl:overscroll-contain xl:pr-1 [scrollbar-gutter:stable]">
          {/* 项目 */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <BookMarked className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">研究项目</h2>
              </div>
              <Button size="sm" variant="outline" onClick={openCreateProject}>
                <Plus className="size-3.5" />
                新建
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {projectsLoading ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  正在加载项目…
                </p>
              ) : null}

              {projectsError ? (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs"
                >
                  <p className="text-destructive">{projectsError}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => void loadProjects()}
                  >
                    <RefreshCw className="size-3.5" />
                    重试
                  </Button>
                </div>
              ) : null}

              {!projectsLoading && !projectsError && projects.length === 0 ? (
                <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                  还没有项目。创建一个项目，为它设定检索范围后即可开始提问。
                </p>
              ) : null}

              {projects.map((project) => {
                const active = project.id === activeProjectId
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setActiveProjectId(project.id)}
                    className={cn(
                      "w-full rounded-xl border p-3 text-left transition-colors",
                      active
                        ? "border-primary/40 bg-primary/5"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {project.name}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {project.description?.trim() || "未填写说明"}
                        </span>
                      </span>
                      <Badge
                        variant="outline"
                        className="shrink-0 border-border bg-muted text-[10px] text-muted-foreground"
                      >
                        {SCOUT_MODE_META[project.default_mode]?.short ??
                          project.default_mode}
                      </Badge>
                    </span>
                  </button>
                )
              })}

              {activeProject ? (
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditProject(activeProject)}
                  >
                    <Pencil className="size-3.5" />
                    重命名
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget(activeProject)}
                  >
                    <Trash2 className="size-3.5" />
                    删除
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* 检索范围 */}
          <Card>
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2">
                <FolderTree className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">检索范围</h2>
                {scopeDirty ? (
                  <Badge
                    variant="outline"
                    className="border-amber-200 bg-amber-50 text-[10px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
                  >
                    未保存
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                范围决定「我的文库」这一路能看到哪些文献；外部检索不受影响。
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {scopeLoading ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  正在读取范围…
                </p>
              ) : null}

              {scopeError ? (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive"
                >
                  {scopeError}
                </p>
              ) : null}

              {!scopeLoading && !scopeError ? (
                <>
                  <div className="space-y-1.5">
                    {(
                      [
                        {
                          value: "all_library",
                          label: "整个文库",
                          hint: "使用全部已索引文献",
                        },
                        {
                          value: "selected_collections",
                          label: "指定 collection",
                          hint: "只在这个项目的子库里检索",
                        },
                      ] as {
                        value: ScoutScopeMode
                        label: string
                        hint: string
                      }[]
                    ).map((option) => (
                      <label
                        key={option.value}
                        className={cn(
                          "flex cursor-pointer items-start gap-2 rounded-lg border p-2.5",
                          draftScopeMode === option.value
                            ? "border-primary/40 bg-primary/5"
                            : "border-border",
                        )}
                      >
                        <input
                          type="radio"
                          name="scope-mode"
                          className="mt-0.5"
                          checked={draftScopeMode === option.value}
                          onChange={() => setDraftScopeMode(option.value)}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm">{option.label}</span>
                          <span className="block text-xs text-muted-foreground">
                            {option.hint}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>

                  {draftScopeMode === "selected_collections" ? (
                    <div className="space-y-2 border-t pt-3">
                      <div className="relative">
                        <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={collectionFilter}
                          onChange={(event) =>
                            setCollectionFilter(event.target.value)
                          }
                          placeholder="搜索 collection"
                          className="h-8 pl-8 text-sm"
                        />
                      </div>

                      {collectionsLoading ? (
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="size-3.5 animate-spin" />
                          正在加载 collection…
                        </p>
                      ) : null}
                      {collectionsError ? (
                        <p className="text-xs text-destructive">
                          {collectionsError}
                        </p>
                      ) : null}

                      <div
                        className="max-h-64 space-y-1 overflow-y-auto pr-1"
                        data-testid="scout-collection-picker"
                      >
                        {visibleCollections.map((collection) => {
                          const checked = draftCollectionIds.includes(
                            collection.id,
                          )
                          return (
                            <label
                              key={collection.id}
                              className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-muted/60"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(value) => {
                                  setDraftCollectionIds((prev) =>
                                    value
                                      ? [...prev, collection.id]
                                      : prev.filter(
                                          (id) => id !== collection.id,
                                        ),
                                  )
                                }}
                              />
                              <span className="min-w-0 flex-1 truncate">
                                {collection.name}
                              </span>
                            </label>
                          )
                        })}
                        {!collectionsLoading &&
                        visibleCollections.length === 0 ? (
                          <p className="px-1 py-2 text-xs text-muted-foreground">
                            没有匹配的 collection。
                          </p>
                        ) : null}
                      </div>

                      <p className="text-xs text-muted-foreground">
                        已选 {draftCollectionIds.length} 个
                        {draftCollectionIds.length > 0 ? (
                          <button
                            type="button"
                            className="ml-2 text-primary hover:underline"
                            onClick={() => setDraftCollectionIds([])}
                          >
                            清空
                          </button>
                        ) : null}
                      </p>
                    </div>
                  ) : null}

                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!scopeDirty || scopeSaving}
                    onClick={() => void handleSaveScope()}
                  >
                    {scopeSaving ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : null}
                    保存范围
                  </Button>
                </>
              ) : null}
            </CardContent>
          </Card>

          {/* 历史会话 */}
          <Card>
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2">
                <History className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">历史会话</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                当前项目最近的调研会话。
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                size="sm"
                variant={session ? "outline" : "secondary"}
                className="w-full"
                onClick={resetSessionState}
              >
                <MessageSquarePlus className="size-3.5" />
                开始新会话
              </Button>

              {sessions.length === 0 ? (
                <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                  还没有历史会话。
                </p>
              ) : null}

              {sessions.map((item) => {
                const active = item.id === session?.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void openSession(item.id)}
                    className={cn(
                      "w-full rounded-lg border p-2.5 text-left transition-colors",
                      active
                        ? "border-primary/40 bg-primary/5"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium">
                        {item.title?.trim() || "调研会话"}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 text-[10px]",
                          SCOUT_SESSION_STATUS_META[item.status]?.className,
                        )}
                      >
                        {SCOUT_SESSION_STATUS_META[item.status]?.label ??
                          item.status}
                      </Badge>
                    </span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      {timeAgo(item.updated_at ?? item.created_at)}
                    </span>
                  </button>
                )
              })}
            </CardContent>
          </Card>
        </aside>

        <main className="min-w-0 space-y-5">
          {/* 提问 */}
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">提出问题</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {session
                      ? "在本次会话中继续追问"
                      : "将开启一个新的调研会话"}
                  </p>
                </div>
                {activeProject ? (
                  <Badge
                    variant="outline"
                    className="border-border bg-muted text-muted-foreground"
                  >
                    <Layers className="size-3" />
                    {activeProject.name}
                  </Badge>
                ) : null}
              </div>

              <div
                className="grid gap-2 sm:grid-cols-3"
                role="radiogroup"
                aria-label="检索模式"
              >
                {MODES.map((value) => {
                  const meta = SCOUT_MODE_META[value]
                  const active = mode === value
                  return (
                    <button
                      key={value}
                      ref={(node) => {
                        modeButtonRefs.current[value] = node
                      }}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      tabIndex={active ? 0 : -1}
                      onClick={() => setMode(value)}
                      onKeyDown={(event) => handleModeKeyDown(event, value)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-colors",
                        active
                          ? meta.accent
                          : "border-border hover:bg-muted/50",
                      )}
                    >
                      <span className="block text-sm font-medium">
                        {meta.label}
                      </span>
                      <span className="mt-1 block text-xs leading-5 opacity-80">
                        {meta.description}
                      </span>
                    </button>
                  )
                })}
              </div>
            </CardHeader>

            <CardContent>
              <form className="space-y-3" onSubmit={handleSubmit}>
                <Textarea
                  ref={questionRef}
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      (event.metaKey || event.ctrlKey) &&
                      event.key === "Enter"
                    ) {
                      event.preventDefault()
                      void handleSubmit(event as unknown as FormEvent)
                    }
                  }}
                  rows={3}
                  placeholder="例如：What are the main approaches to blockchain-based cloud data integrity auditing?"
                  disabled={asking}
                  data-testid="scout-question-input"
                />

                {cjkQuestion ? (
                  <p
                    role="note"
                    className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
                  >
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    当前版本对中文长句的术语匹配偏保守，中文提问更容易被判为「证据不足」。建议改用英文提问，或保留英文关键词。
                  </p>
                ) : null}

                {askError ? (
                  <p
                    role="alert"
                    className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
                  >
                    {askError}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {session
                      ? `本次会话已进行 ${turns.length} 轮；新的追问会沿用当前范围。`
                      : "⌘/Ctrl + Enter 快速提交"}
                  </p>
                  <Button
                    type="submit"
                    disabled={asking || !question.trim() || !activeProjectId}
                  >
                    {asking ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    {asking ? "正在调研…" : "开始调研"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {asking && askStartedAt ? (
            <RetrievalProgress mode={mode} startedAt={askStartedAt} />
          ) : null}

          {!asking && askStartedAt === null && turns.length > 1 ? (
            <Card>
              <CardHeader className="space-y-1">
                <h2 className="text-sm font-semibold">本次会话的提问</h2>
                <p className="text-xs text-muted-foreground">
                  点击任意一轮可查看它对应当前保留的简报。
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {turns.map((turn) => {
                  const active = turn.id === activeTurnId
                  return (
                    <button
                      key={turn.id}
                      type="button"
                      onClick={() => {
                        setActiveTurnId(turn.id)
                        setActiveEvidenceId(null)
                      }}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left transition-colors",
                        active
                          ? "border-primary/40 bg-primary/5"
                          : "border-border hover:bg-muted/50",
                      )}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="text-[11px] text-muted-foreground">
                            第 {turn.turn_no} 轮
                          </span>
                          <span className="mt-0.5 block text-sm">
                            {turn.question}
                          </span>
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 text-[10px]",
                            SCOUT_SESSION_STATUS_META[turn.status]?.className,
                          )}
                        >
                          {SCOUT_SESSION_STATUS_META[turn.status]?.label ??
                            turn.status}
                        </Badge>
                      </span>
                    </button>
                  )
                })}
              </CardContent>
            </Card>
          ) : null}

          {activeTurn &&
          displayBrief &&
          displayBrief.turn_id !== activeTurn.id ? (
            <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              第 {activeTurn.turn_no}{" "}
              轮的完整简报未保存在本页，下面展示的是最近一轮的简报。
            </p>
          ) : null}

          <div
            ref={briefSectionRef}
            id="research-brief"
            className="scroll-mt-24"
          >
            <BriefPanel
              brief={displayBrief}
              question={
                activeTurn?.question ??
                (latestBrief ? turns[turns.length - 1]?.question : undefined)
              }
              loading={briefLoading}
              error={briefError}
              exporting={exporting}
              feedback={currentFeedback}
              activeEvidenceId={activeEvidenceId}
              onExport={(format) => void handleExport(format)}
              onFeedback={(rating) => void handleFeedback(rating)}
              onFocusEvidence={handleFocusEvidence}
            />
          </div>

          {events.length > 0 ? (
            <details className="rounded-xl border bg-card p-4">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <ChevronDown className="size-4 text-muted-foreground" />
                检索过程记录
                <span className="text-xs font-normal text-muted-foreground">
                  （{events.length} 条，仅阶段 / 工具 / 来源）
                </span>
              </summary>
              <ol className="mt-3 space-y-1.5 border-l pl-4">
                {events.map((event) => (
                  <li
                    key={`${event.seq}-${event.id}`}
                    className="relative text-xs text-muted-foreground"
                  >
                    <span className="absolute top-1.5 -left-[21px] size-1.5 rounded-full bg-border" />
                    <span className="tabular-nums">
                      {formatDateTime(event.at).slice(11) || "—"}
                    </span>{" "}
                    {eventText(event)}
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
        </main>
      </div>

      {/* 新建 / 重命名项目 */}
      <Dialog
        open={projectDialog !== null}
        onOpenChange={(open) => (open ? null : setProjectDialog(null))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {projectDialog === "edit" ? "重命名项目" : "新建研究项目"}
            </DialogTitle>
            <DialogDescription>
              一个项目对应一个检索范围；范围可以在创建后随时调整。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="scout-project-name">项目名称</Label>
              <Input
                id="scout-project-name"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="例如：云存储完整性审计"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scout-project-desc">说明（可选）</Label>
              <Textarea
                id="scout-project-desc"
                value={projectDescription}
                onChange={(event) => setProjectDescription(event.target.value)}
                rows={3}
                placeholder="这个项目要回答什么问题、覆盖哪些子方向"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProjectDialog(null)}>
              取消
            </Button>
            <Button
              disabled={projectSaving}
              onClick={() => void submitProjectDialog()}
            >
              {projectSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {projectDialog === "edit" ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除项目 */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => (open ? null : setDeleteTarget(null))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              删除项目「{deleteTarget?.name}」？
            </AlertDialogTitle>
            <AlertDialogDescription>
              项目的检索范围与会话记录将不再可用。Zotero 文库本身不会被修改。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => void confirmDeleteProject()}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
