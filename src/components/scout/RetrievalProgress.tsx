import { Check, Clock3, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

import { Card, CardContent } from "@/components/ui/card"
import type { ScoutRetrievalMode } from "@/lib/scout-types"
import { cn } from "@/lib/utils"

/**
 * 检索过程时间线。
 *
 * 后端 `POST /sessions` 是同步返回的:请求结束即代表简报已经落库,因此前端
 * 拿不到逐帧进度,只能按模式给出「将要执行的阶段」并在等待期间按经验节奏
 * 推进,同时始终显示真实已用时长。真实阶段以返回后的 `GET /events` 为准。
 */
const BASE_STEPS = [
  { key: "planning", label: "拆解问题", note: "判断意图并生成检索计划" },
  { key: "retrieving_library", label: "检索你的文库", note: "词汇 + 向量混合召回" },
] as const

const SCHOLARLY_STEP = {
  key: "retrieving_scholarly",
  label: "检索外部学术来源",
  note: "Semantic Scholar / OpenAlex",
} as const

const WEB_STEP = {
  key: "retrieving_web",
  label: "检索联网背景",
  note: "仅作背景与线索",
} as const

const TAIL_STEPS = [
  { key: "ranking", label: "重排序与去重", note: "RRF 融合后重排" },
  { key: "drafting", label: "生成简报", note: "按证据分层组织结论" },
] as const

export function retrievalSteps(mode: ScoutRetrievalMode) {
  const steps: { key: string; label: string; note: string }[] = [...BASE_STEPS]
  if (mode === "gap_fill" || mode === "landscape") steps.push(SCHOLARLY_STEP)
  if (mode === "landscape") steps.push(WEB_STEP)
  steps.push(...TAIL_STEPS)
  return steps
}

type RetrievalProgressProps = {
  mode: ScoutRetrievalMode
  startedAt: number
  /** 客户端等待已超过该时长时的提示语(通常来自上一次的真实耗时)。 */
  endingHint?: string
}

export function RetrievalProgress({ mode, startedAt, endingHint }: RetrievalProgressProps) {
  const [elapsed, setElapsed] = useState(() => Date.now() - startedAt)
  const steps = retrievalSteps(mode)

  useEffect(() => {
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt), 1000)
    return () => window.clearInterval(timer)
  }, [startedAt])

  // 按经验节奏推进:前 60 秒线性覆盖前 3 步,之后停在「生成简报」。
  const activeIndex = Math.min(steps.length - 1, Math.floor(elapsed / 20000))

  return (
    <Card data-testid="scout-retrieval-progress">
      <CardContent className="space-y-4 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Loader2 className="size-4 animate-spin text-primary" />
            正在调研 · {steps[activeIndex]?.label ?? "处理中"}
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
            <Clock3 className="size-3.5" />
            已等待 {Math.floor(elapsed / 1000)} 秒
          </span>
        </div>

        <ol className="space-y-2.5">
          {steps.map((step, index) => {
            const done = index < activeIndex
            const active = index === activeIndex
            return (
              <li key={step.key} className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-[10px]",
                    done && "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
                    active && "border-primary/40 bg-primary/10 text-primary",
                    !done && !active && "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3" /> : index + 1}
                </span>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-sm",
                      active ? "font-medium text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.note}</p>
                </div>
              </li>
            )
          })}
        </ol>

        <p className="text-xs leading-5 text-muted-foreground">
          {endingHint ?? "阶段为预期顺序，真实进度以完成后的检索记录为准。"}
        </p>
      </CardContent>
    </Card>
  )
}
