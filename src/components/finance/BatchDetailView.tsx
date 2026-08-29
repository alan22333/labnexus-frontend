import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react"
import {
  ArrowLeft, CheckCircle2, Download, FileSpreadsheet, HandCoins, Loader2, Plus, Trash2,
} from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import { financeApi } from "@/lib/api"
import { fen2yuan, fmtDate, today, yuan2fen } from "@/lib/format"
import type { FinanceBatchDetail, FinanceItem, ImportPreview, ImportRow } from "@/lib/types"
import { cn } from "@/lib/utils"

const ITEM_STATUS: Record<string, string> = {
  pending: "未交",
  partial: "部分交",
  done: "已交清",
}

function SummaryCell({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-base font-semibold tabular-nums", danger && "text-destructive")}>¥{value}</span>
    </div>
  )
}

export function BatchDetailView({ batchId, onBack, onChanged }: {
  batchId: string
  onBack: () => void
  onChanged: () => void
}) {
  const [detail, setDetail] = useState<FinanceBatchDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const [addOpen, setAddOpen] = useState(false)
  const [submitTarget, setSubmitTarget] = useState<FinanceItem | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { batch } = await financeApi.getBatch(batchId)
      setDetail(batch)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "批次加载失败")
    } finally {
      setLoading(false)
    }
  }, [batchId])

  useEffect(() => {
    void load()
  }, [load])

  async function downloadTemplate() {
    try {
      const blob = await financeApi.importTemplate()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "finance-import-template.xlsx"
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "模板下载失败")
    }
  }

  async function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    try {
      const data = await financeApi.importPreview(batchId, file)
      setPreview(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "导入解析失败")
    }
  }

  async function confirmImport() {
    if (!preview) return
    setConfirming(true)
    try {
      const { imported_count, skipped_count } = await financeApi.confirmImport(preview.preview_id, batchId)
      toast.success("导入完成:" + imported_count + " 条" + (skipped_count ? ",跳过 " + skipped_count + " 条" : ""))
      setPreview(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "导入失败")
    } finally {
      setConfirming(false)
    }
  }

  async function completeBatch() {
    setBusy(true)
    try {
      await financeApi.completeBatch(batchId)
      toast.success("批次已完成")
      setCompleteOpen(false)
      onChanged()
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败")
    } finally {
      setBusy(false)
    }
  }

  async function deleteBatch() {
    setBusy(true)
    try {
      await financeApi.deleteBatch(batchId)
      toast.success("批次已删除")
      setDeleteOpen(false)
      onBack()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败")
      setDeleteOpen(false)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (!detail) return null

  const active = detail.status === "active"
  const items = detail.items ?? []
  const unreturned = items.filter((i) => i.unreturned > 0)
  const s = detail.summary ?? { item_count: 0, total_payroll: 0, total_should_return: 0, total_returned: 0, total_unreturned: 0 }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft /> 返回
        </Button>
        <h2 className="mr-2 flex items-center gap-2 text-lg font-bold">
          📦 {detail.name}
          <Badge variant={active ? "secondary" : "outline"}>{active ? "进行中" : "已完成"}</Badge>
        </h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={!active} onClick={() => setAddOpen(true)}>
            <Plus /> 手动加明细
          </Button>
          <Button variant="outline" size="sm" disabled={!active} onClick={() => fileRef.current?.click()}>
            <FileSpreadsheet /> 导入 Excel
          </Button>
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download /> 下载模板
          </Button>
          {active && (
            <Button size="sm" onClick={() => setCompleteOpen(true)}>
              <CheckCircle2 /> 批次完成
            </Button>
          )}
          {active && (
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 /> 删除
            </Button>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={onPickFile} />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <SummaryCell label="明细" value={String(s.item_count)} />
          <SummaryCell label="发放总额" value={fen2yuan(s.total_payroll)} />
          <SummaryCell label="应交" value={fen2yuan(s.total_should_return)} />
          <SummaryCell label="已交" value={fen2yuan(s.total_returned)} />
          <SummaryCell label="未交" value={fen2yuan(s.total_unreturned)} danger={s.total_unreturned > 0} />
        </div>
      </Card>

      {unreturned.length > 0 && (
        <Card className="border-destructive/40 p-4">
          <h4 className="mb-2 font-medium text-destructive">⏰ 未交名单({unreturned.length})</h4>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {unreturned.map((i) => (
              <div key={i.id} className="flex items-center gap-2">
                <span className="font-medium">{i.participant.name}</span>
                <span className="tabular-nums text-destructive">欠 ¥{fen2yuan(i.unreturned)}</span>
                {i.note && <span className="text-xs text-muted-foreground">备注:{i.note}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-0">
        <div className="flex items-center justify-between px-4 pt-4">
          <h4 className="font-medium">明细({items.length})</h4>
          {active && unreturned.length > 0 && (
            <span className="text-xs text-muted-foreground">点击「收款」登记上交,资金池自动入账</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">姓名</th>
                <th className="px-3 py-2 font-medium">学号</th>
                <th className="px-3 py-2 font-medium">日期</th>
                <th className="px-3 py-2 text-right font-medium">应发</th>
                <th className="px-3 py-2 text-right font-medium">扣税</th>
                <th className="px-3 py-2 text-right font-medium">辛苦费</th>
                <th className="px-3 py-2 text-right font-medium">应交</th>
                <th className="px-3 py-2 text-right font-medium">已交</th>
                <th className="px-3 py-2 text-right font-medium">未交</th>
                <th className="px-3 py-2 font-medium">状态</th>
                <th className="px-3 py-2 font-medium">备注</th>
                <th className="px-4 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-muted-foreground">
                    暂无明细,点「手动加明细」或「导入 Excel」添加
                  </td>
                </tr>
              ) : (
                items.map((i) => (
                  <tr key={i.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">{i.participant.name}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{i.participant.student_no}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtDate(i.date)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fen2yuan(i.payroll_amount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fen2yuan(i.tax_amount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fen2yuan(i.tip_amount)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{fen2yuan(i.should_return)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fen2yuan(i.returned)}</td>
                    <td className={cn("px-3 py-2 text-right tabular-nums", i.unreturned > 0 && "font-medium text-destructive")}>
                      {fen2yuan(i.unreturned)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={i.status === "done" ? "outline" : "secondary"}>{ITEM_STATUS[i.status] ?? i.status}</Badge>
                    </td>
                    <td className="max-w-[10rem] truncate px-3 py-2 text-muted-foreground" title={i.note}>{i.note || "—"}</td>
                    <td className="px-4 py-2">
                      {active && i.unreturned > 0 ? (
                        <Button size="sm" variant="outline" onClick={() => setSubmitTarget(i)}>
                          <HandCoins /> 收款
                        </Button>
                      ) : (
                        <span className="text-emerald-600">✓</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <AddItemDialog open={addOpen} onOpenChange={setAddOpen} batchId={batchId} onCreated={load} />
      <SubmitDialog target={submitTarget} onOpenChange={(open) => !open && setSubmitTarget(null)} onSubmitted={load} />
      <ImportPreviewDialog preview={preview} onOpenChange={(open) => !open && setPreview(null)} confirming={confirming} onConfirm={confirmImport} />

      <AlertDialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>标记批次完成?</AlertDialogTitle>
            <AlertDialogDescription>批次完成需要全部明细交清;完成后不可再添加明细、收款或删除。确定继续?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={completeBatch} disabled={busy}>确认完成</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除批次?</AlertDialogTitle>
            <AlertDialogDescription>将删除该批次及其全部明细与上交记录,此操作不可恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={deleteBatch} disabled={busy}>确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function AddItemDialog({ open, onOpenChange, batchId, onCreated }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  batchId: string
  onCreated: () => Promise<void>
}) {
  const [name, setName] = useState("")
  const [studentNo, setStudentNo] = useState("")
  const [date, setDate] = useState(today())
  const [payroll, setPayroll] = useState("")
  const [tax, setTax] = useState("0")
  const [tip, setTip] = useState("0")
  const [shouldReturn, setShouldReturn] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  function reset() {
    setName("")
    setStudentNo("")
    setDate(today())
    setPayroll("")
    setTax("0")
    setTip("0")
    setShouldReturn("")
    setNote("")
    setError("")
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !studentNo.trim() || !date || !payroll.trim()) {
      setError("姓名 / 学号 / 日期 / 应发 为必填")
      return
    }
    const payrollFen = yuan2fen(payroll)
    const taxFen = yuan2fen(tax)
    const tipFen = yuan2fen(tip)
    if (payrollFen == null || payrollFen <= 0) {
      setError("应发金额不合法(需大于 0)")
      return
    }
    if (taxFen == null || taxFen < 0 || tipFen == null || tipFen < 0) {
      setError("扣税 / 辛苦费金额不合法")
      return
    }
    let override: number | undefined
    if (shouldReturn.trim()) {
      const v = yuan2fen(shouldReturn)
      if (v == null || v < 0) {
        setError("应交金额不合法")
        return
      }
      override = v
    }
    setBusy(true)
    setError("")
    try {
      await financeApi.createItem(batchId, {
        name: name.trim(),
        student_no: studentNo.trim(),
        date,
        payroll_amount: payrollFen,
        tax_amount: taxFen,
        tip_amount: tipFen,
        ...(override !== undefined ? { should_return: override } : {}),
        note: note.trim(),
      })
      toast.success("明细已添加")
      reset()
      onOpenChange(false)
      await onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加失败")
    } finally {
      setBusy(false)
    }
  }

  const payrollFenLive = yuan2fen(payroll) ?? 0
  const tipFenLive = yuan2fen(tip) ?? 0
  const auto = Math.max(payrollFenLive - tipFenLive, 0)

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>手动加明细</DialogTitle>
          <DialogDescription>应交 = 应发 − 辛苦费(扣税仅记录);留空应交则自动计算</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ai-name">姓名 *</Label>
            <Input id="ai-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="张同学" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-no">学号 *</Label>
            <Input id="ai-no" value={studentNo} onChange={(e) => setStudentNo(e.target.value)} placeholder="20240001" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-date">日期 *</Label>
            <Input id="ai-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-payroll">应发(元)*</Label>
            <Input id="ai-payroll" value={payroll} onChange={(e) => setPayroll(e.target.value)} placeholder="2500" inputMode="decimal" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-tax">扣税(元)</Label>
            <Input id="ai-tax" value={tax} onChange={(e) => setTax(e.target.value)} placeholder="0" inputMode="decimal" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-tip">辛苦费(元)</Label>
            <Input id="ai-tip" value={tip} onChange={(e) => setTip(e.target.value)} placeholder="100" inputMode="decimal" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-return">应交(元)</Label>
            <Input id="ai-return" value={shouldReturn} onChange={(e) => setShouldReturn(e.target.value)} placeholder={"自动:" + fen2yuan(auto)} inputMode="decimal" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-note">备注</Label>
            <Input id="ai-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && <p className="col-span-2 text-sm text-destructive">{error}</p>}
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={busy}>{busy ? "保存中…" : "保存"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SubmitDialog({ target, onOpenChange, onSubmitted }: {
  target: FinanceItem | null
  onOpenChange: (open: boolean) => void
  onSubmitted: () => Promise<void>
}) {
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(today())
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (target) {
      setAmount("")
      setDate(today())
      setNote("")
      setError("")
    }
  }, [target])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!target) return
    const fen = yuan2fen(amount)
    if (fen == null || fen <= 0) {
      setError("请输入大于 0 的金额")
      return
    }
    if (fen > target.unreturned) {
      setError("金额超过未交余额 ¥" + fen2yuan(target.unreturned))
      return
    }
    setBusy(true)
    setError("")
    try {
      await financeApi.submit(target.id, { amount: fen, date, note: note.trim() })
      toast.success("收款登记成功,资金池已入账")
      onOpenChange(false)
      await onSubmitted()
    } catch (err) {
      setError(err instanceof Error ? err.message : "收款失败")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>收款登记</DialogTitle>
          <DialogDescription>
            {target ? target.participant.name + " · 未交 ¥" + fen2yuan(target.unreturned) : ""}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sd-amount">本次上交金额(元)*</Label>
            <Input id="sd-amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="2100" inputMode="decimal" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sd-date">上交日期 *</Label>
            <Input id="sd-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sd-note">备注</Label>
            <Input id="sd-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="如:补交" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={busy}>{busy ? "登记中…" : "确认收款"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ImportPreviewDialog({ preview, onOpenChange, confirming, onConfirm }: {
  preview: ImportPreview | null
  onOpenChange: (open: boolean) => void
  confirming: boolean
  onConfirm: () => Promise<void>
}) {
  return (
    <Dialog open={!!preview} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>导入预览</DialogTitle>
          <DialogDescription>
            有效 {preview?.valid_count ?? 0} 行,错误 {preview?.error_count ?? 0} 行(错误行不入库)
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          {preview && preview.valid_rows.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">姓名</th>
                  <th className="px-3 py-2 font-medium">学号</th>
                  <th className="px-3 py-2 font-medium">日期</th>
                  <th className="px-3 py-2 text-right font-medium">应发</th>
                  <th className="px-3 py-2 text-right font-medium">扣税</th>
                  <th className="px-3 py-2 text-right font-medium">辛苦费</th>
                  <th className="px-3 py-2 font-medium">备注</th>
                </tr>
              </thead>
              <tbody>
                {preview.valid_rows.map((r: ImportRow, idx: number) => (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="px-3 py-1.5">{r.name}</td>
                    <td className="px-3 py-1.5 tabular-nums">{r.student_no}</td>
                    <td className="px-3 py-1.5 tabular-nums">{r.date}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fen2yuan(r.payroll_amount)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fen2yuan(r.tax_amount)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fen2yuan(r.tip_amount)}</td>
                    <td className="px-3 py-1.5">{r.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {preview && preview.valid_rows.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">没有可导入的有效行</p>
          )}
          {preview && preview.error_rows.length > 0 && (
            <div className="mt-4">
              <h5 className="mb-1 text-sm font-medium text-destructive">错误行({preview.error_rows.length})</h5>
              <ul className="space-y-1 text-xs text-destructive">
                {preview.error_rows.map((e, idx) => <li key={idx}>{e}</li>)}
              </ul>
            </div>
          )}
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirming}>取消</Button>
          <Button onClick={onConfirm} disabled={confirming || (preview?.valid_count ?? 0) === 0}>
            {confirming ? <Loader2 className="animate-spin" /> : null}
            确认导入({preview?.valid_count ?? 0} 条)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
