import { useCallback, useEffect, useState } from "react"
import { Loader2, UserRound } from "lucide-react"
import { toast } from "sonner"

import { Card } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { financeApi } from "@/lib/api"
import { fen2yuan, fmtDate } from "@/lib/format"
import type { FinanceBill, ParticipantStat } from "@/lib/types"
import { cn } from "@/lib/utils"

export function ParticipantsView() {
  const [list, setList] = useState<ParticipantStat[]>([])
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState<ParticipantStat | null>(null)
  const [bills, setBills] = useState<FinanceBill[] | null>(null)
  const [billsLoading, setBillsLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await financeApi.participants()
      setList(data.participants ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "参与同学加载失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function openBills(p: ParticipantStat) {
    setCurrent(p)
    setBills(null)
    setBillsLoading(true)
    try {
      const data = await financeApi.participantBills(p.id)
      setBills(data.bills ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "历史账单加载失败")
    } finally {
      setBillsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
          <div>
            <h3 className="font-medium">参与同学（{list.length}）</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">按人汇总跨批次金额，点击任意一行查看历史账单</p>
          </div>
        </div>
        {list.length === 0 ? (
          <p className="px-5 py-14 text-center text-sm text-muted-foreground">
            暂无参与同学记录，在批次中添加明细后会自动出现在这里
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-5 py-2 font-medium">姓名</th>
                  <th className="px-3 py-2 font-medium">学号</th>
                  <th className="px-3 py-2 text-right font-medium">参与次数</th>
                  <th className="px-3 py-2 text-right font-medium">累计应交</th>
                  <th className="px-3 py-2 text-right font-medium">累计已交</th>
                  <th className="px-5 py-2 text-right font-medium">未交</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const un = p.total_should_return - p.total_returned
                  return (
                    <tr
                      key={p.id}
                      className="cursor-pointer border-b last:border-0 hover:bg-muted/40"
                      onClick={() => void openBills(p)}
                    >
                      <td className="px-5 py-2.5">
                        <span className="flex items-center gap-2 font-medium">
                          <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <UserRound className="size-3.5" />
                          </span>
                          {p.name}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{p.student_no}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{p.total_items}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fen2yuan(p.total_should_return)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{fen2yuan(p.total_returned)}</td>
                      <td className={cn("px-5 py-2.5 text-right tabular-nums", un > 0 && "font-medium text-destructive")}>
                        {fen2yuan(un)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!current} onOpenChange={(o) => !o && setCurrent(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>历史账单</DialogTitle>
            <DialogDescription>
              {current ? current.name + "(" + current.student_no + ") · 跨批次记录" : ""}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {billsLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
            ) : !bills || bills.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">暂无账单记录</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">批次</th>
                    <th className="px-3 py-2 font-medium">日期</th>
                    <th className="px-3 py-2 text-right font-medium">应发</th>
                    <th className="px-3 py-2 text-right font-medium">应交</th>
                    <th className="px-3 py-2 text-right font-medium">已交</th>
                    <th className="px-3 py-2 text-right font-medium">未交</th>
                    <th className="px-3 py-2 font-medium">备注</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((b, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="px-3 py-1.5 font-medium">{b.batch_name}</td>
                      <td className="px-3 py-1.5 tabular-nums">{fmtDate(b.date)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fen2yuan(b.payroll_amount)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fen2yuan(b.should_return)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fen2yuan(b.returned)}</td>
                      <td className={cn("px-3 py-1.5 text-right tabular-nums", b.unreturned > 0 && "text-destructive")}>{fen2yuan(b.unreturned)}</td>
                      <td className="max-w-[10rem] truncate px-3 py-1.5 text-muted-foreground" title={b.note}>{b.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}
