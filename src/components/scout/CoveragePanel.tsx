import { AlertTriangle, Database, FileCheck2, FileText, Leaf, RefreshCcw } from "lucide-react"
import type { ComponentType } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateTime } from "@/lib/format"
import type { ScoutCoverage } from "@/lib/scout-types"
import { cn } from "@/lib/utils"

type CoveragePanelProps = {
  coverage: ScoutCoverage
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value)
}

type MetricProps = {
  label: string
  value: number
  hint: string
  testId?: string
  icon: ComponentType<{ className?: string }>
  tone?: "default" | "warning" | "danger"
}

function Metric({ label, value, hint, testId, icon: Icon, tone = "default" }: MetricProps) {
  return (
    <div className="rounded-xl border bg-muted/30 p-4" data-testid={testId}>
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </div>
      <p
        className={cn(
          "mt-3 text-2xl font-semibold tracking-tight tabular-nums",
          tone === "danger" && "text-destructive",
          tone === "warning" && "text-amber-700 dark:text-amber-300",
        )}
      >
        {formatCount(value)}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p>
    </div>
  )
}

export function CoveragePanel({ coverage }: CoveragePanelProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              Coverage
            </p>
            <CardTitle className="mt-1 text-lg">文库覆盖情况</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">
            最近成功同步：{formatDateTime(coverage.last_success_at) || "—"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Metric
            icon={Database}
            label="可见条目"
            value={coverage.visible_items}
            hint="Zotero Web API 当前可见的全部条目"
          />
          <Metric
            icon={FileCheck2}
            label="已建索引"
            value={coverage.indexed_documents}
            hint="已经完成索引，可供后续检索"
            testId="coverage-indexed-documents"
          />
          <Metric
            icon={FileText}
            label="个人全文"
            value={coverage.personal_fulltext}
            hint="可直接支撑科学结论的首要证据"
            testId="coverage-personal-fulltext"
          />
          <Metric
            icon={Leaf}
            label="结构化摘要"
            value={coverage.structured_abstract}
            hint="全文缺失时可使用的降级证据"
            testId="coverage-structured-abstract"
          />
          <Metric
            icon={AlertTriangle}
            label="仅元数据 · 不作为结论证据"
            value={coverage.metadata_only}
            hint="仅有题录信息，不能单独支撑研究结论"
            tone="warning"
            testId="coverage-metadata-only"
          />
          <Metric
            icon={RefreshCcw}
            label="失败"
            value={coverage.failed}
            hint="同步或索引失败的条目，可稍后重试"
            tone={coverage.failed > 0 ? "danger" : "default"}
          />
        </div>

        {coverage.local_only_warning ? (
          <div
            role="note"
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
          >
            <strong>本地-only 与未同步全文不在覆盖范围内。</strong>{" "}
            当前覆盖只反映 Zotero Web API 可见并完成同步的内容，不会把本机未上传的 PDF 推断为已覆盖。
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
