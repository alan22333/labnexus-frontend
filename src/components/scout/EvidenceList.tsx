import { ExternalLink, FileText, Quote, ScanSearch } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { SCOUT_EVIDENCE_META, type ScoutEvidence } from "@/lib/scout-types"
import { cn } from "@/lib/utils"

function locatorText(evidence: ScoutEvidence): string {
  const locator = (evidence.locator ?? {}) as Record<string, unknown>
  const parts: string[] = []
  const section = typeof locator.section === "string" ? locator.section.trim() : ""
  if (section) parts.push(section)
  const pageStart = locator.page_start
  const pageEnd = locator.page_end
  if (typeof pageStart === "number") {
    parts.push(typeof pageEnd === "number" && pageEnd !== pageStart ? `p.${pageStart}-${pageEnd}` : `p.${pageStart}`)
  }
  const charStart = locator.char_start
  const charEnd = locator.char_end
  if (parts.length === 0 && typeof charStart === "number" && typeof charEnd === "number") {
    parts.push(`字符 ${charStart}–${charEnd}`)
  }
  return parts.join(" · ")
}

/**
 * 证据卡片。证据分层必须肉眼可辨:个人全文 / 结构化摘要 / 联网背景
 * 三种颜色与措辞都不同,联网背景明确标注「不能单独支撑结论」。
 */
export function EvidenceCard({
  evidence,
  index,
  active,
  onFocus,
}: {
  evidence: ScoutEvidence
  index?: number
  active?: boolean
  onFocus?: (evidence: ScoutEvidence) => void
}) {
  const meta = SCOUT_EVIDENCE_META[evidence.evidence_type]
  const locator = locatorText(evidence)
  return (
    <article
      id={`evidence-${evidence.id}`}
      data-testid="scout-evidence-card"
      className={cn(
        "scroll-mt-24 rounded-xl border bg-card p-4 transition-shadow",
        active && "border-primary/40 shadow-md ring-2 ring-primary/20",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {typeof index === "number" ? (
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-medium tabular-nums text-muted-foreground">
              {index + 1}
            </span>
          ) : null}
          <h4 className="min-w-0 text-sm leading-5 font-medium">{evidence.title || "未命名文献"}</h4>
        </div>
        <Badge variant="outline" className={cn("shrink-0 gap-1", meta?.className)}>
          <FileText className="size-3" />
          {meta?.label ?? evidence.evidence_type}
        </Badge>
      </div>

      {evidence.quote ? (
        <blockquote className="mt-3 flex gap-2 rounded-lg bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
          <Quote className="mt-0.5 size-3.5 shrink-0" />
          <span className="line-clamp-5">{evidence.quote}</span>
        </blockquote>
      ) : null}

      {meta ? <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{meta.hint}</p> : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {locator ? (
          <span className="inline-flex items-center gap-1">
            <ScanSearch className="size-3" />
            {locator}
          </span>
        ) : null}
        <span className="tabular-nums">相关度 {evidence.score.toFixed(4)}</span>
        {evidence.url ? (
          <a
            href={evidence.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <ExternalLink className="size-3" />
            外部链接
          </a>
        ) : null}
        {onFocus ? (
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={() => onFocus(evidence)}
          >
            查看详情
          </button>
        ) : null}
      </div>
    </article>
  )
}

export function EvidenceList({
  evidence,
  activeId,
  onFocus,
}: {
  evidence: ScoutEvidence[]
  activeId?: string | null
  onFocus?: (evidence: ScoutEvidence) => void
}) {
  if (evidence.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        本次没有留存任何可引用证据。
      </p>
    )
  }
  return (
    <div className="space-y-3">
      {evidence.map((item, index) => (
        <EvidenceCard
          key={item.id}
          evidence={item}
          index={index}
          active={activeId === item.id}
          onFocus={onFocus}
        />
      ))}
    </div>
  )
}
