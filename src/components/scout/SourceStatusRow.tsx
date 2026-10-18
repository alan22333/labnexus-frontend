import { CircleAlert, CircleCheck, CircleSlash, CircleMinus } from "lucide-react"

import type { ScoutSourceState, ScoutSourceStatus } from "@/lib/scout-types"
import { SCOUT_SOURCE_META, SCOUT_SOURCE_STATE_META } from "@/lib/scout-types"
import { cn } from "@/lib/utils"

const ICONS: Record<ScoutSourceState, typeof CircleCheck> = {
  available: CircleCheck,
  degraded: CircleAlert,
  unavailable: CircleSlash,
  skipped: CircleMinus,
}

const ICON_TONE: Record<ScoutSourceState, string> = {
  available: "text-emerald-600 dark:text-emerald-400",
  degraded: "text-amber-600 dark:text-amber-400",
  unavailable: "text-destructive",
  skipped: "text-muted-foreground",
}

/**
 * 数据来源状态条。
 *
 * 只要某个来源不是 available,就必须在界面上显式可见——降级不能静默,
 * 否则用户会把「没检索到」误当成「不存在」。
 */
export function SourceStatusRow({
  sources,
  className,
}: {
  sources: ScoutSourceStatus[]
  className?: string
}) {
  if (!sources || sources.length === 0) return null
  return (
    <ul className={cn("flex flex-wrap gap-2", className)} data-testid="scout-source-status">
      {sources.map((source) => {
        const Icon = ICONS[source.status] ?? CircleMinus
        const meta = SCOUT_SOURCE_STATE_META[source.status]
        return (
          <li
            key={source.source}
            title={source.degraded_reason ?? undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
              meta?.className,
            )}
          >
            <Icon className={cn("size-3.5", ICON_TONE[source.status])} />
            <span className="font-medium">{SCOUT_SOURCE_META[source.source] ?? source.source}</span>
            <span className="opacity-80">{meta?.label ?? source.status}</span>
          </li>
        )
      })}
    </ul>
  )
}
