import { useCallback, useEffect, useState, type FormEvent } from "react"
import {
  ArrowDownToLine, ArrowUpFromLine, Boxes, Loader2, Plus, RefreshCw, Wallet,
} from "lucide-react"
import { toast } from "sonner"

import { BatchDetailView } from "@/components/finance/BatchDetailView"
import { ParticipantsView } from "@/components/finance/ParticipantsView"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs"
import { useAuth } from "@/hooks/use-auth"
import { financeApi } from "@/lib/api"
import { fen2yuan, today, yuan2fen } from "@/lib/format"
import type { FinanceBatchListItem, FinanceLedger } from "@/lib/types"
import { cn } from "@/lib/utils"

const CATEGORY_LABEL: Record<string, string> = {
  turnover: "上交回笼",
  supplement: "导师补充",
  labor: "劳务发放",
  other: "其他",
}

/** 必填星标(红色) */
function RequiredMark() {
  return <span className="text-destructive" aria-hidden="true">*</span>
}

function StatusBadge({ status }: { status: FinanceBatchListItem["status"] }) {
  return <Badge variant={status === "active" ? "secondary" : "outline"}>{status === "active" ? "进行中" : "已完成"}</Badge>
}

export function FinancePage() {
  const { user } = useAuth()
  const [tab, setTab] = useState("overview")
  const [activeBatch, setActiveBatch] = useState<string | null>(null)

  const [batches, setBatches] = useState<FinanceBatchListItem[]>([])
  const [ledger, setLedger] = useState<FinanceLedger | null>(null)
  const [loading, setLoading] = useState(true)

  const [newOpen, setNewOpen] = useState(false)
  const [incomeOpen, setIncomeOpen] = useState(false)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [ledgerOpen, setLedgerOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [b, l] = await Promise.all([financeApi.batches(), financeApi.ledger()])
      setBatches(b.batches ?? [])
      setLedger(l)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "经费数据加载失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (user && user.role !== "admin" && user.role !== "supervisor") {
    return (
      <Card className="mx-auto max-w-md p-10 text-center">
        <p className="text-lg font-medium">无权访问</p>
        <p className="mt-2 text-sm text-muted-foreground">经费管理仅经费负责人（admin）与导师（supervisor）可用</p>
      </Card>
    )
  }

  if (activeBatch) {
    return (
      <BatchDetailView
        batchId={activeBatch}
        onBack={() => setActiveBatch(null)}
        onChanged={load}
      />
    )
  }

  const unreturnedCount = batches.reduce((n, b) => n + (b.summary?.total_unreturned ?? 0), 0)

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-wrap items-center gap-2">
          <TabsList>
            <TabsTrigger value="overview">
              <Wallet /> 总览
            </TabsTrigger>
            <TabsTrigger value="participants">
              <Boxes /> 参与同学
            </TabsTrigger>
          </TabsList>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setNewOpen(true)}>
              <Plus /> 新建批次
            </Button>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} 刷新
            </Button>
          </div>
        </div>

        <TabsContent value="overview" className="space-y-4">
          {/* 资金池 */}
          <Card className="border-primary/20 bg-gradient-to-br from-blue-50 to-sky-50 p-5 dark:from-blue-950/40 dark:to-sky-950/40">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-xs text-muted-foreground">资金池余额（收入 − 支出）</p>
                <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">¥{fen2yuan(ledger?.balance)}</p>
              </div>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setIncomeOpen(true)}>
                  <ArrowUpFromLine /> 导师补充
                </Button>
                <Button variant="outline" size="sm" onClick={() => setExpenseOpen(true)}>
                  <ArrowDownToLine /> 支出
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setLedgerOpen(true)}>
                  流水明细
                </Button>
              </div>
            </div>
          </Card>

          {/* 批次列表 */}
          <div className="flex items-center justify-between">
            <h3 className="font-medium">批次（{batches.length}）</h3>
            {unreturnedCount > 0 && (
              <span className="text-xs text-destructive">未交合计 ¥{fen2yuan(unreturnedCount)}</span>
            )}
          </div>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : batches.length === 0 ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              暂无批次，点「新建批次」开始（如：2026-08）
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {batches.map((b) => {
                const s = b.summary
                return (
                  <Card key={b.id} className="cursor-pointer p-4 transition-colors hover:bg-muted/40" onClick={() => setActiveBatch(b.id)}>
                    <div className="flex items-center gap-2">
                      <span className="text-base">📦</span>
                      <span className="flex-1 truncate font-medium">{b.name}</span>
                      <StatusBadge status={b.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                      <span>明细 {s?.item_count ?? 0}</span>
                      <span>应交 <b className="tabular-nums text-foreground">¥{fen2yuan(s?.total_should_return)}</b></span>
                      <span>已交 <b className="tabular-nums text-emerald-600">¥{fen2yuan(s?.total_returned)}</b></span>
                      <span className={cn("tabular-nums", (s?.total_unreturned ?? 0) > 0 && "text-destructive")}>
                        未交 ¥{fen2yuan(s?.total_unreturned)}
                      </span>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="participants">
          <ParticipantsView />
        </TabsContent>
      </Tabs>

      <NewBatchDialog open={newOpen} onOpenChange={setNewOpen} onCreated={load} />
      <LedgerTxDialog
        open={incomeOpen}
        onOpenChange={setIncomeOpen}
        tone="income"
        title="导师补充"
        description="向资金池补充经费（收入），自动记入流水"
        onCreated={load}
      />
      <LedgerTxDialog
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        tone="expense"
        title="资金支出"
        description="登记资金使用（如：发放劳务），余额相应减少"
        onCreated={load}
      />
      <LedgerDialog open={ledgerOpen} onOpenChange={setLedgerOpen} ledger={ledger} />
    </div>
  )
}

// ============ 新建批次 ============
function NewBatchDialog({ open, onOpenChange, onCreated }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => Promise<void>
}) {
  const [name, setName] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError("批次名称不能为空（如：2026-08）")
      return
    }
    setBusy(true)
    setError("")
    try {
      await financeApi.createBatch({ name: name.trim(), note: note.trim() })
      toast.success("批次已创建")
      setName("")
      setNote("")
      onOpenChange(false)
      await onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setError("") }}>
      <DialogContent className="sm:max-w-md">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-sky-400 text-white shadow-md shadow-blue-500/20">
            <Boxes className="size-5" />
          </span>
          <DialogHeader className="pt-1.5">
            <DialogTitle className="text-lg">新建批次</DialogTitle>
            <DialogDescription>一次「发放 → 回收」周转流程，名称即标识（如：2026-08）</DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={submit} className="mt-1 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nb-name" className="text-sm font-medium">
              批次名称 <RequiredMark />
            </Label>
            <Input
              id="nb-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：2026-08"
              autoFocus
              className="h-10"
            />
            <p className="text-xs text-muted-foreground">必填。建议用月份或用途命名，便于区分</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nb-note" className="text-sm font-medium">备注</Label>
            <Input
              id="nb-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="选填。如：暑假劳务费周转"
              className="h-10"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={busy} className="gap-1.5">
              {busy ? <Loader2 className="animate-spin" /> : <Plus />}
              {busy ? "创建中…" : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============ 导师补充 / 资金支出 ============
function LedgerTxDialog({ open, onOpenChange, tone, title, description, onCreated }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tone: "income" | "expense"
  title: string
  description: string
  onCreated: () => Promise<void>
}) {
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(today())
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const income = tone === "income"
  const Icon = income ? ArrowUpFromLine : ArrowDownToLine
  const iconClass = income
    ? "from-emerald-500 to-teal-400 shadow-emerald-500/20"
    : "from-rose-500 to-red-400 shadow-rose-500/20"

  function reset() {
    setAmount("")
    setDate(today())
    setNote("")
    setError("")
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const fen = yuan2fen(amount)
    if (fen == null || fen <= 0) {
      setError("请输入大于 0 的金额")
      return
    }
    setBusy(true)
    setError("")
    try {
      if (income) {
        await financeApi.addIncome({ amount: fen, date, note: note.trim() })
        toast.success("已入账资金池")
      } else {
        await financeApi.addExpense({ amount: fen, date, note: note.trim() })
        toast.success("支出已登记")
      }
      reset()
      onOpenChange(false)
      await onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="sm:max-w-md">
        <div className="flex items-start gap-3">
          <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md", iconClass)}>
            <Icon className="size-5" />
          </span>
          <DialogHeader className="pt-1.5">
            <DialogTitle className="text-lg">{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={submit} className="mt-1 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lt-amount" className="text-sm font-medium">
              金额（元） <RequiredMark />
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">¥</span>
              <Input
                id="lt-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="如：5000"
                inputMode="decimal"
                autoFocus
                className="h-10 pl-7"
              />
            </div>
            <p className="text-xs text-muted-foreground">必填。请输入大于 0 的金额</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lt-date" className="text-sm font-medium">
              日期 <RequiredMark />
            </Label>
            <Input
              id="lt-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10"
            />
            <p className="text-xs text-muted-foreground">必填。默认今天</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lt-note" className="text-sm font-medium">备注</Label>
            <Input
              id="lt-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="选填。如：7 月劳务费"
              className="h-10"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              {busy ? "提交中…" : "确认"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============ 流水明细 ============
function LedgerDialog({ open, onOpenChange, ledger }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  ledger: FinanceLedger | null
}) {
  const txs = ledger?.transactions ?? []
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>资金流水</DialogTitle>
          <DialogDescription>
            当前余额 <b className="tabular-nums text-foreground">¥{fen2yuan(ledger?.balance)}</b>
            · 共 {txs.length} 条
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          {txs.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">暂无流水</p>
          ) : (
            <div className="space-y-2">
              {txs.map((t) => {
                const income = t.type === "income"
                return (
                  <div key={t.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={income ? "secondary" : "destructive"} className={income ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50" : ""}>
                        {income ? "收入 +" : "支出 −"}{fen2yuan(t.amount)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{CATEGORY_LABEL[t.category] ?? t.category}</span>
                      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                        {new Date(t.occurred_at).toLocaleString("zh-CN")}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 text-xs text-muted-foreground">
                      {t.note && <span>{t.note}</span>}
                      <span className="ml-auto">经手:{t.operator?.display_name ?? "?"}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
