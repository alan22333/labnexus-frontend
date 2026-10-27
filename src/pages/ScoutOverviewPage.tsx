import { useCallback, useEffect, useState } from "react"
import {
  ArrowRight,
  BookOpen,
  CircleCheck,
  FileSearch,
  Library,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { useNavigate } from "react-router-dom"

import { CoveragePanel } from "@/components/scout/CoveragePanel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"
import { asScoutProblem, scoutApi, scoutProblemMessage } from "@/lib/scout-api"
import type { ScoutConnection, ScoutCoverage } from "@/lib/scout-types"
import { formatDateTime } from "@/lib/format"

const ROLE_LABEL: Record<string, string> = {
  admin: "管理员",
  supervisor: "导师",
  student: "学生",
}

const STATUS_LABEL: Record<ScoutConnection["status"], string> = {
  healthy: "正常",
  degraded: "降级",
  disconnected: "已断开",
  revoked: "已撤销",
}

function errorText(error: unknown): string {
  return scoutProblemMessage(asScoutProblem(error))
}

export function ScoutOverviewPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [connections, setConnections] = useState<ScoutConnection[]>([])
  const [connectionsLoading, setConnectionsLoading] = useState(true)
  const [connectionsError, setConnectionsError] = useState("")
  const [coverage, setCoverage] = useState<ScoutCoverage | null>(null)
  const [coverageLoading, setCoverageLoading] = useState(false)
  const [coverageError, setCoverageError] = useState("")

  const loadConnections = useCallback(async () => {
    setConnectionsLoading(true)
    setConnectionsError("")
    try {
      setConnections(await scoutApi.listConnections())
    } catch (error) {
      setConnectionsError(errorText(error))
    } finally {
      setConnectionsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadConnections()
  }, [loadConnections])

  const activeConnection =
    connections.find((connection) => connection.status !== "revoked") ?? connections[0]

  useEffect(() => {
    if (!activeConnection) {
      setCoverage(null)
      setCoverageError("")
      setCoverageLoading(false)
      return
    }

    let cancelled = false
    setCoverageLoading(true)
    setCoverageError("")
    setCoverage(null)
    void scoutApi
      .coverage(activeConnection.id)
      .then((data) => {
        if (!cancelled) setCoverage(data)
      })
      .catch((error: unknown) => {
        if (!cancelled) setCoverageError(errorText(error))
      })
      .finally(() => {
        if (!cancelled) setCoverageLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeConnection])

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-2xl bg-slate-950 p-6 text-white shadow-lg sm:p-8">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)] lg:items-end">
          <div>
            <Badge className="border-white/15 bg-white/10 text-white">Research Scout v1</Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">调研助手</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              以个人 Zotero 文库为证据底座，先把连接与覆盖讲清楚，再进入可追溯的研究问答与简报。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                className="bg-white text-slate-950 hover:bg-slate-100"
                onClick={() => navigate("/scout/research")}
              >
                进入调研工作台
                <ArrowRight className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={() => navigate("/scout/connections")}
              >
                管理 Zotero 连接
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-medium tracking-[0.16em] text-slate-400 uppercase">
              当前身份
            </p>
            <p className="mt-3 text-xl font-semibold">{user?.display_name || user?.username || "未登录"}</p>
            <p className="mt-1 text-sm text-slate-300">LabNexus · 课题组工作空间</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
              <span className="rounded-full bg-white/10 px-2.5 py-1">
                角色：{ROLE_LABEL[user?.role ?? ""] ?? user?.role ?? "—"}
              </span>
              <span className="rounded-full bg-white/10 px-2.5 py-1">身份源：LabNexus</span>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-400">
              调研助手通过 LabNexus Bearer JWT 识别当前账号，并为每人建立独立私有 workspace。
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-start gap-4 pt-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Library className="size-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">连接数量</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {connectionsLoading ? "—" : connections.length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">已接入的 Zotero 文库</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-4 pt-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
              <CircleCheck className="size-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">连接状态</p>
              <p className="mt-1 text-2xl font-semibold">
                {activeConnection ? STATUS_LABEL[activeConnection.status] : "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {activeConnection
                  ? `当前文库：${activeConnection.display_name?.trim() || activeConnection.library_id}`
                  : "尚未连接文库"}
              </p>
              {activeConnection ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  最近同步：{formatDateTime(activeConnection.last_sync_at) || "—"}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-4 pt-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
              <FileSearch className="size-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">可检索证据</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {coverageLoading ? "—" : coverage?.indexed_documents ?? "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">已建立索引的文档数</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {connectionsError ? (
        <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 p-5 text-sm">
          <p className="font-semibold text-destructive">连接摘要加载失败</p>
          <p className="mt-1 text-destructive/90">{connectionsError}</p>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => void loadConnections()}>
            <RefreshCw /> 重试
          </Button>
        </div>
      ) : null}

      {!connectionsLoading && !connectionsError && !activeConnection ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">还没有可用的 Zotero 文库</CardTitle>
            <p className="text-sm text-muted-foreground">
              先连接个人 My Library，调研助手才能开始建立可追溯的证据索引。
            </p>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/scout/connections")}>
              去连接 Zotero
              <ArrowRight className="size-4" />
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {activeConnection ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
          <div>
            {coverageLoading ? (
              <div role="status" className="flex items-center gap-3 rounded-xl border bg-card p-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                正在读取覆盖情况…
              </div>
            ) : null}
            {coverageError ? (
              <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 p-5 text-sm">
                <p className="font-semibold text-destructive">覆盖信息加载失败</p>
                <p className="mt-1 text-destructive/90">{coverageError}</p>
              </div>
            ) : null}
            {coverage ? <CoveragePanel coverage={coverage} /> : null}
          </div>

          <Card className="h-fit">
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
                  <BookOpen className="size-5" />
                </span>
                <div>
                  <CardTitle>现在可以做什么</CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">当前交付边界</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
              <p className="flex gap-3">
                <ShieldCheck className="mt-1 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                连接与覆盖是可验证事实；仅元数据不会被当作科学结论证据。
              </p>
              <p className="flex gap-3">
                <Sparkles className="mt-1 size-4 shrink-0 text-violet-600 dark:text-violet-400" />
                在调研工作台里可以按「我的文库 / 查缺补漏 / 全景调研」三种模式提问，得到带引用、带缺口清单、可导出的研究简报。
              </p>
              <Button variant="outline" className="w-full" onClick={() => navigate("/scout/research")}>
                进入调研工作台
                <ArrowRight className="size-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
