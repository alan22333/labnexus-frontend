import { useCallback, useEffect, useState } from "react"
import {
  BookOpenCheck,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react"

import { ConnectionList, type ScoutPendingAction } from "@/components/scout/ConnectionList"
import { CoveragePanel } from "@/components/scout/CoveragePanel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { asScoutProblem, scoutApi, scoutProblemMessage } from "@/lib/scout-api"
import type { ScoutConnection, ScoutCoverage } from "@/lib/scout-types"
import { cn } from "@/lib/utils"

type Notice = {
  kind: "success" | "danger"
  text: string
} | null

const OAUTH_CALLBACK_MESSAGES: Record<string, string> = {
  denied: "你取消了 Zotero 授权。",
  invalid_state: "授权状态无效，请重新连接。",
  expired: "授权已过期，请重新连接。",
  replayed: "该授权已使用过，请重新连接。",
  invalid_callback: "Zotero 回调参数不合法。",
  exchange_failed: "换取凭据失败，请重试。",
  config_missing: "服务端尚未配置 Zotero OAuth。",
}

function oauthCallbackNotice(): Notice {
  const params = new URLSearchParams(window.location.search)
  if (params.get("zotero") === "connected") {
    return { kind: "success", text: "Zotero 授权成功，连接已保存。" }
  }
  if (params.get("zotero") === "error") {
    const code = params.get("code") ?? "exchange_failed"
    return { kind: "danger", text: OAUTH_CALLBACK_MESSAGES[code] ?? "Zotero 授权失败，请重试。" }
  }
  return null
}

function errorText(error: unknown): string {
  return scoutProblemMessage(asScoutProblem(error))
}

export function ScoutConnectionsPage() {
  const [notice, setNotice] = useState<Notice>(() => oauthCallbackNotice())
  const [oauthBusy, setOauthBusy] = useState(false)

  const [connections, setConnections] = useState<ScoutConnection[]>([])
  const [connectionsLoading, setConnectionsLoading] = useState(true)
  const [connectionsError, setConnectionsError] = useState("")

  const [pendingAction, setPendingAction] = useState<ScoutPendingAction>(null)
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null)
  const [coverage, setCoverage] = useState<ScoutCoverage | null>(null)
  const [coverageLoading, setCoverageLoading] = useState(false)
  const [coverageError, setCoverageError] = useState("")
  const [collectionsCount, setCollectionsCount] = useState<number | null>(null)
  const [collectionsLoading, setCollectionsLoading] = useState(false)
  const [collectionsError, setCollectionsError] = useState("")

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!params.has("zotero")) return
    window.history.replaceState({}, "", window.location.pathname + window.location.hash)
  }, [])

  useEffect(() => {
    if (!selectedConnectionId) {
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
      .coverage(selectedConnectionId)
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
  }, [selectedConnectionId])

  useEffect(() => {
    if (!selectedConnectionId) {
      setCollectionsCount(null)
      setCollectionsError("")
      setCollectionsLoading(false)
      return
    }

    let cancelled = false
    setCollectionsLoading(true)
    setCollectionsError("")
    void scoutApi
      .listCollections()
      .then((collections) => {
        if (!cancelled) setCollectionsCount(collections.length)
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
  }, [selectedConnectionId])

  function startOAuth() {
    setNotice(null)
    setOauthBusy(true)
    void (async () => {
      try {
        const started = await scoutApi.startOAuth()
        window.location.assign(started.authorization_url)
      } catch (error) {
        setNotice({ kind: "danger", text: errorText(error) })
        setOauthBusy(false)
      }
    })()
  }

  async function validate(connectionId: string) {
    setNotice(null)
    setPendingAction({ kind: "validate", connectionId })
    try {
      await scoutApi.validateConnection(connectionId)
      setNotice({ kind: "success", text: "验证通过" })
      await loadConnections()
    } catch (error) {
      setNotice({ kind: "danger", text: errorText(error) })
    } finally {
      setPendingAction(null)
    }
  }

  async function sync(connectionId: string) {
    setNotice(null)
    setPendingAction({ kind: "sync", connectionId })
    try {
      await scoutApi.startSync(connectionId)
      setNotice({ kind: "success", text: "已提交同步任务" })
      await loadConnections()
    } catch (error) {
      setNotice({ kind: "danger", text: errorText(error) })
    } finally {
      setPendingAction(null)
    }
  }

  async function revoke(connectionId: string) {
    if (!window.confirm("撤销后该连接将停止同步，并在保留期结束后清理相关数据。确定继续吗？")) {
      return
    }

    setNotice(null)
    setPendingAction({ kind: "revoke", connectionId })
    try {
      await scoutApi.revokeConnection(connectionId)
      setNotice({ kind: "success", text: "已提交撤销" })
      setSelectedConnectionId((current) => (current === connectionId ? null : current))
      await loadConnections()
    } catch (error) {
      setNotice({ kind: "danger", text: errorText(error) })
    } finally {
      setPendingAction(null)
    }
  }

  function toggleCoverage(connectionId: string) {
    setSelectedConnectionId((current) => (current === connectionId ? null : connectionId))
  }

  const connectionSummary = connectionsLoading
    ? "正在读取连接列表"
    : connectionsError
      ? "连接列表不可用"
      : `共 ${connections.length} 个连接`

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">Zotero</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Zotero 连接与覆盖</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            连接个人 My Library，按需同步索引，并明确区分全文证据、结构化摘要与仅元数据缺口。
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
          凭据只在服务端加密保存，前端不回显
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
        <Card className="h-fit">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
                <ShieldCheck className="size-5" />
              </span>
              <div>
                <h2 className="font-semibold">连接 Zotero</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">跳转到 Zotero 完成只读 OAuth 授权</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full" type="button" onClick={startOAuth} disabled={oauthBusy}>
              {oauthBusy ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
              {oauthBusy ? "正在前往 Zotero" : "连接 Zotero"}
            </Button>

            <p className="text-xs leading-5 text-muted-foreground">
              仅申请个人文库只读权限，不申请笔记、写入或群组文库权限；你可以随时在连接列表中撤销。
            </p>
          </CardContent>
        </Card>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">已有连接</h2>
              <p className="mt-1 text-xs text-muted-foreground">{connectionSummary}</p>
            </div>
            {notice ? (
              <div
                role={notice.kind === "danger" ? "alert" : "status"}
                className={cn(
                  "text-sm font-medium",
                  notice.kind === "danger" ? "text-destructive" : "text-emerald-700 dark:text-emerald-300",
                )}
              >
                {notice.text}
              </div>
            ) : null}
          </div>

          {connectionsLoading ? (
            <div role="status" className="flex items-center gap-3 rounded-xl border bg-card p-5 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              正在读取连接列表…
            </div>
          ) : connectionsError ? (
            <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 p-5 text-sm">
              <p className="font-semibold text-destructive">连接列表加载失败</p>
              <p className="mt-1 text-destructive/90">{connectionsError}</p>
              <Button className="mt-3" size="sm" variant="outline" onClick={() => void loadConnections()}>
                <RefreshCw /> 重试
              </Button>
            </div>
          ) : connections.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-card px-6 py-10 text-center">
              <BookOpenCheck className="mx-auto size-7 text-muted-foreground" />
              <p className="mt-3 font-medium">还没有 Zotero 连接</p>
              <p className="mt-1 text-sm text-muted-foreground">点击左侧“连接 Zotero”，从个人 My Library 开始。</p>
            </div>
          ) : (
            <ConnectionList
              connections={connections}
              pendingAction={pendingAction}
              selectedConnectionId={selectedConnectionId}
              onToggleCoverage={toggleCoverage}
              onValidate={(id) => void validate(id)}
              onSync={(id) => void sync(id)}
              onRevoke={(id) => void revoke(id)}
            />
          )}

          {selectedConnectionId ? (
            <div className="space-y-4 pt-2">
              {coverageLoading ? (
                <div role="status" className="flex items-center gap-3 rounded-xl border bg-card p-5 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  正在读取覆盖情况…
                </div>
              ) : coverageError ? (
                <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 p-5 text-sm">
                  <p className="font-semibold text-destructive">覆盖信息加载失败</p>
                  <p className="mt-1 text-destructive/90">{coverageError}</p>
                </div>
              ) : coverage ? (
                <CoveragePanel coverage={coverage} />
              ) : null}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <RefreshCw className="size-3.5" />
                {collectionsLoading
                  ? "正在读取 collection 数量…"
                  : collectionsError
                    ? collectionsError
                    : collectionsCount == null
                      ? "尚未读取 collection 数量"
                      : `共 ${collectionsCount} 个 collection`}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
