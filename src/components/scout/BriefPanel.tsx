import {
  CircleHelp,
  Download,
  GitBranch,
  Loader2,
  Quote,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
} from "lucide-react"

import { EvidenceList } from "@/components/scout/EvidenceList"
import { GapList } from "@/components/scout/GapList"
import { SourceStatusRow } from "@/components/scout/SourceStatusRow"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { formatDateTime } from "@/lib/format"
import {
  SCOUT_EVIDENCE_META,
  SCOUT_SESSION_STATUS_META,
  SCOUT_SUPPORT_META,
  containsCJK,
  scoutBriefAbstained,
  type ScoutBrief,
  type ScoutEvidence,
} from "@/lib/scout-types"
import { cn } from "@/lib/utils"

export type BriefExportFormat = "json" | "bibtex" | "csv"

type BriefPanelProps = {
  brief: ScoutBrief | null
  /** 本轮提问;用于在「证据不足」时给出可执行的改写建议。 */
  question?: string
  loading: boolean
  error: string
  exporting: BriefExportFormat | null
  feedback: 1 | -1 | null
  activeEvidenceId: string | null
  onExport: (format: BriefExportFormat) => void
  onFeedback: (rating: 1 | -1) => void
  onFocusEvidence: (evidence: ScoutEvidence) => void
}

const EXPORT_LABELS: Record<BriefExportFormat, string> = {
  json: "JSON",
  bibtex: "BibTeX",
  csv: "CSV",
}

/** 时间线条目是后端保留的开放结构;这里只提取常见键,不发明的字段就不展示。 */
function timelineEntry(item: Record<string, unknown>): {
  title: string
  meta: string
  body: string
} {
  const pick = (keys: string[]): string => {
    for (const key of keys) {
      const value = item[key]
      if (typeof value === "string" && value.trim()) return value.trim()
      if (typeof value === "number") return String(value)
    }
    return ""
  }
  return {
    title: pick(["title", "name", "label", "method", "work_title"]),
    meta: [pick(["year"]), pick(["venue", "date"])].filter(Boolean).join(" · "),
    body: pick(["summary", "description", "note", "detail"]),
  }
}

function TimelineSection({
  title,
  items,
}: {
  title: string
  items: Record<string, unknown>[]
}) {
  if (items.length === 0) return null
  return (
    <section>
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <GitBranch className="size-4 text-muted-foreground" />
        {title}
      </h3>
      <ol className="mt-3 space-y-2 border-l pl-4">
        {items.map((raw, index) => {
          const entry = timelineEntry(raw)
          return (
            <li key={index} className="relative">
              <span className="absolute top-2 -left-[21px] size-2 rounded-full bg-border" />
              <p className="text-sm font-medium">
                {entry.title || `条目 ${index + 1}`}
              </p>
              {entry.meta ? (
                <p className="text-xs text-muted-foreground">{entry.meta}</p>
              ) : null}
              {entry.body ? (
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {entry.body}
                </p>
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export function BriefPanel({
  brief,
  question,
  loading,
  error,
  exporting,
  feedback,
  activeEvidenceId,
  onExport,
  onFeedback,
  onFocusEvidence,
}: BriefPanelProps) {
  if (loading) {
    return (
      <Card data-testid="scout-brief-loading">
        <CardContent className="flex items-center gap-3 pt-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          正在读取研究简报…
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-destructive/20 bg-destructive/10 p-5 text-sm"
      >
        <p className="font-semibold text-destructive">简报加载失败</p>
        <p className="mt-1 text-destructive/90">{error}</p>
      </div>
    )
  }

  if (!brief) {
    const steps = [
      ["01", "确定范围", "选择研究项目和 Zotero collection 范围"],
      ["02", "提出问题", "选择「我的文库 / 查缺补漏 / 全景调研」"],
      ["03", "核验简报", "逐条检查发现、引用、缺口和来源状态"],
    ]
    return (
      <Card className="overflow-hidden" data-testid="scout-brief-empty">
        <div className="h-1 bg-gradient-to-r from-primary via-sky-400 to-violet-400" />
        <CardHeader className="space-y-3 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="size-4" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">研究简报会在这里生成</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  每次调研都保留可追溯的来源与边界
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className="border-primary/20 bg-primary/5 text-primary"
            >
              等待第一次调研
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {steps.map(([number, title, body]) => (
              <div key={number} className="rounded-xl border bg-muted/20 p-4">
                <span className="text-[11px] font-semibold tracking-widest text-primary tabular-nums">
                  {number}
                </span>
                <p className="mt-2 text-sm font-medium">{title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {body}
                </p>
              </div>
            ))}
          </div>
          <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2.5 text-xs leading-5 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
            <span>
              证据口径：个人全文优先；结构化摘要只作降级支持；联网背景只提供线索，不单独支撑科学结论。
            </span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const abstained = scoutBriefAbstained(brief)
  const findings = brief.findings ?? []
  const citations = brief.citations ?? []
  const gaps = brief.gaps ?? []
  const openQuestions = brief.open_questions ?? []
  // 能拿到简报就说明这一轮已经走完;阶段细节以检索过程时间线为准。
  const statusMeta = SCOUT_SESSION_STATUS_META.completed
  const evidenceIndex = new Map(
    citations.map((item, index) => [item.id, index]),
  )

  return (
    <Card data-testid="scout-brief-panel">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">研究简报</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              生成于 {formatDateTime(brief.created_at) || "—"} · 简报版本{" "}
              {brief.schema_version}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(["json", "bibtex", "csv"] as BriefExportFormat[]).map(
              (format) => (
                <Button
                  key={format}
                  size="sm"
                  variant="outline"
                  disabled={exporting !== null}
                  onClick={() => onExport(format)}
                >
                  {exporting === format ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  {EXPORT_LABELS[format]}
                </Button>
              ),
            )}
            <div className="flex items-center gap-1 rounded-lg border p-0.5">
              <Button
                size="sm"
                variant={feedback === 1 ? "secondary" : "ghost"}
                aria-label="这份简报有帮助"
                onClick={() => onFeedback(1)}
              >
                <ThumbsUp className="size-3.5" />
              </Button>
              <Button
                size="sm"
                variant={feedback === -1 ? "secondary" : "ghost"}
                aria-label="这份简报没有帮助"
                onClick={() => onFeedback(-1)}
              >
                <ThumbsDown className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn("gap-1", statusMeta.className)}
          >
            {statusMeta.label}
          </Badge>
          <Badge
            variant="outline"
            className="border-border bg-muted text-muted-foreground"
          >
            引用 {citations.length} 条 · 发现 {findings.length} 条 · 缺口{" "}
            {gaps.length} 条
          </Badge>
        </div>

        <SourceStatusRow sources={brief.source_status ?? []} />
      </CardHeader>

      <CardContent className="space-y-8">
        {abstained ? (
          <div
            role="status"
            data-testid="scout-brief-abstain"
            className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30"
          >
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  证据不足，暂不下结论
                </p>
                <p className="mt-1 text-sm leading-6 text-amber-900/90 dark:text-amber-100/90">
                  {brief.summary}
                </p>
                <p className="mt-3 text-xs leading-5 text-amber-900/80 dark:text-amber-100/80">
                  检索并没有失败，但当前范围内没有找到足以支撑科学结论的证据。可以尝试：换用更具体的
                  术语、缩小或放宽检索范围、先在「连接与覆盖」里同步更多全文。
                </p>
                {question && containsCJK(question) ? (
                  <p className="mt-3 rounded-lg bg-amber-100/70 px-3 py-2 text-xs leading-5 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
                    当前版本对中文长句的术语匹配偏保守，中文提问更容易被判为证据不足。建议改用英文提问，
                    或保留英文关键词（如 “integrity auditing”“proof of
                    retrievability”）。
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <section>
            <h3 className="text-sm font-semibold">结论摘要</h3>
            <blockquote className="mt-2 flex gap-3 rounded-xl bg-muted/40 p-4">
              <Quote className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-sm leading-6 whitespace-pre-line">
                {brief.summary}
              </p>
            </blockquote>
          </section>
        )}

        {findings.length > 0 ? (
          <section data-testid="scout-findings">
            <h3 className="text-sm font-semibold">证据化发现</h3>
            <ol className="mt-3 space-y-3">
              {findings.map((finding, index) => {
                const support = SCOUT_SUPPORT_META[finding.support_level]
                return (
                  <li
                    key={finding.claim_id}
                    className="rounded-xl border bg-card p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-medium tabular-nums text-muted-foreground">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {support ? (
                            <Badge
                              variant="outline"
                              className={cn("gap-1", support.className)}
                            >
                              {support.label}
                            </Badge>
                          ) : null}
                          {typeof finding.confidence === "number" ? (
                            <span className="text-[11px] text-muted-foreground tabular-nums">
                              置信度 {Math.round(finding.confidence * 100)}%
                            </span>
                          ) : null}
                          <span className="text-[11px] text-muted-foreground">
                            {finding.verification_status}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6">
                          {finding.claim}
                        </p>
                        {(finding.evidence_ids ?? []).length > 0 ? (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] text-muted-foreground">
                              引用
                            </span>
                            {(finding.evidence_ids ?? []).map((evidenceId) => {
                              const position = evidenceIndex.get(evidenceId)
                              return (
                                <button
                                  key={evidenceId}
                                  type="button"
                                  onClick={() => {
                                    const target = citations.find(
                                      (item) => item.id === evidenceId,
                                    )
                                    if (target) onFocusEvidence(target)
                                  }}
                                  className="rounded-md border px-1.5 py-0.5 text-[11px] font-medium text-primary tabular-nums transition-colors hover:bg-primary/10"
                                >
                                  {typeof position === "number"
                                    ? position + 1
                                    : evidenceId.slice(-4)}
                                </button>
                              )
                            })}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        ) : null}

        <TimelineSection title="方法脉络" items={brief.method_timeline ?? []} />
        <TimelineSection title="时间脉络" items={brief.chronology ?? []} />

        <section data-testid="scout-gaps-section">
          <h3 className="text-sm font-semibold">缺口：你的文库还缺什么</h3>
          <div className="mt-3">
            <GapList gaps={gaps} />
          </div>
        </section>

        {openQuestions.length > 0 ? (
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <CircleHelp className="size-4 text-muted-foreground" />
              未决问题
            </h3>
            <ul className="mt-3 space-y-2">
              {openQuestions.map((item, index) => (
                <li
                  key={index}
                  className="flex gap-2 text-sm leading-6 text-muted-foreground"
                >
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section data-testid="scout-evidence-section">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">引用与证据</h3>
            <p className="text-[11px] text-muted-foreground">
              证据分层：
              {Object.values(SCOUT_EVIDENCE_META)
                .sort((a, b) => a.rank - b.rank)
                .map((meta) => meta.label)
                .join(" > ")}
            </p>
          </div>
          <div className="mt-3">
            <EvidenceList
              evidence={citations}
              activeId={activeEvidenceId}
              onFocus={onFocusEvidence}
            />
          </div>
        </section>
      </CardContent>
    </Card>
  )
}
