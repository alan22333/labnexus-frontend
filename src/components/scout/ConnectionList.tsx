import {
  CheckCircle2,
  FileSearch,
  KeyRound,
  Library,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatDateTime } from "@/lib/format"
import type { ScoutConnection, ScoutConnectionStatus } from "@/lib/scout-types"
import { cn } from "@/lib/utils"

export type ScoutPendingAction = {
  kind: "validate" | "sync" | "revoke"
  connectionId: string
} | null

type ConnectionListProps = {
  connections: ScoutConnection[]
  pendingAction: ScoutPendingAction
  selectedConnectionId: string | null
  onToggleCoverage: (connectionId: string) => void
  onValidate: (connectionId: string) => void
  onSync: (connectionId: string) => void
  onRevoke: (connectionId: string) => void
}

const STATUS_MAP: Record<
  ScoutConnectionStatus,
  { label: string; className: string }
> = {
  healthy: {
    label: "正常",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300",
  },
  degraded: {
    label: "降级",
    className: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
  },
  disconnected: {
    label: "已断开",
    className: "border-destructive/20 bg-destructive/10 text-destructive",
  },
  revoked: {
    label: "已撤销",
    className: "border-border bg-muted text-muted-foreground",
  },
}

function isPending(
  pendingAction: ScoutPendingAction,
  connectionId: string,
  kind: NonNullable<ScoutPendingAction>["kind"],
) {
  return pendingAction?.connectionId === connectionId && pendingAction.kind === kind
}

export function ConnectionList({
  connections,
  pendingAction,
  selectedConnectionId,
  onToggleCoverage,
  onValidate,
  onSync,
  onRevoke,
}: ConnectionListProps) {
  return (
    <div className="space-y-3">
      {connections.map((connection) => {
        const status = STATUS_MAP[connection.status]
        const selected = selectedConnectionId === connection.id
        return (
          <Card key={connection.id}>
            <CardContent className="space-y-5 pt-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-semibold">
                      {connection.display_name?.trim() || "Zotero 个人文库"}
                    </h3>
                    <Badge variant="outline" className={cn(status.className)}>
                      {status.label}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Library className="size-3.5" />
                      Library ID：{connection.library_id}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <KeyRound className="size-3.5" />
                      Zotero OAuth 授权已加密保存
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <RefreshCw className="size-3.5" />
                      最近同步：{formatDateTime(connection.last_sync_at) || "—"}
                    </span>
                  </div>
                </div>
                <div className="text-left text-xs text-muted-foreground sm:shrink-0 sm:text-right">
                  <p className="whitespace-nowrap">文库版本</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                    {connection.last_library_version ?? "—"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={connection.status === "revoked" || pendingAction !== null}
                  onClick={() => onValidate(connection.id)}
                >
                  {isPending(pendingAction, connection.id, "validate") ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <ShieldCheck />
                  )}
                  验证连接
                </Button>
                <Button
                  size="sm"
                  disabled={connection.status === "revoked" || pendingAction !== null}
                  onClick={() => onSync(connection.id)}
                >
                  {isPending(pendingAction, connection.id, "sync") ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <RefreshCw />
                  )}
                  同步
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onToggleCoverage(connection.id)}
                >
                  <FileSearch />
                  {selected ? "收起覆盖" : "查看覆盖"}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="sm:ml-auto"
                  disabled={connection.status === "revoked" || pendingAction !== null}
                  onClick={() => onRevoke(connection.id)}
                >
                  {isPending(pendingAction, connection.id, "revoke") ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Trash2 />
                  )}
                  撤销连接
                </Button>
              </div>

              <div className="flex items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                创建于 {formatDateTime(connection.created_at) || "—"}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
