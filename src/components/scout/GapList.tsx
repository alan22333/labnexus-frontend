import { Compass, ExternalLink } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { SCOUT_GAP_META, SCOUT_MISSING_META, type ScoutGap } from "@/lib/scout-types"

function rationaleLine(gap: ScoutGap): string {
  const rationale = (gap.rationale ?? {}) as Record<string, unknown>
  const parts: string[] = []
  const title = typeof rationale.work_title === "string" ? rationale.work_title : ""
  if (title) parts.push(title)
  const year = rationale.work_year
  if (typeof year === "number" && year > 0) parts.push(`${year} 年`)
  const citations = rationale.citation_count
  if (typeof citations === "number" && citations > 0) parts.push(`被引 ${citations}`)
  return parts.join(" · ")
}

/**
 * 缺口清单。
 *
 * 每条缺口都必须回答「相对于什么缺失」:个人文库 / 当前范围 / 仅外部发现。
 * 外部发现只是线索,不构成科学结论,因此这里也不会把它渲染成证据。
 */
export function GapList({ gaps }: { gaps: ScoutGap[] }) {
  if (gaps.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        本次未检测到结构性缺口。
      </p>
    )
  }
  return (
    <ul className="space-y-3" data-testid="scout-gap-list">
      {gaps.map((gap) => {
        const meta = SCOUT_GAP_META[gap.gap_type]
        const line = rationaleLine(gap)
        return (
          <li key={gap.id} className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <Compass className="size-3" />
                {meta?.label ?? gap.gap_type}
              </Badge>
              <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                {SCOUT_MISSING_META[gap.missing_relative_to] ?? gap.missing_relative_to}
              </Badge>
            </div>
            {line ? <p className="mt-3 text-sm font-medium">{line}</p> : null}
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{gap.explanation}</p>
            {gap.external_work_id ? (
              <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <ExternalLink className="size-3" />
                外部工作标识 {gap.external_work_id}
              </p>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
