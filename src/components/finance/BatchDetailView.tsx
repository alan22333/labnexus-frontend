import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react"
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Download, FileSpreadsheet, HandCoins, History, Loader2,
  MoreHorizontal, Pencil, Plus, Trash2, Undo2, UserPlus,
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { financeApi, friendlyFinanceError } from "@/lib/api"
import { fen2yuan, fmtDate, today, yuan2fen } from "@/lib/format"
import type { FinanceBatchDetail, FinanceItem, FinanceSubmission, ImportPreview, ImportRow } from "@/lib/types"
import { cn } from "@/lib/utils"
import { RequiredMark } from "@/components/finance/RequiredMark"

const ITEM_STATUS: Record<string, string> = {
  pending: "未交",
  partial: "部分交",
  done: "已交清",
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

/** 将 Excel 单元格里的日期统一转换为 YYYY-MM-DD 文本（与后端 normalizeDate 对齐） */
function excelDateToText(value: unknown, ssf: typeof import("xlsx").SSF): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getFullYear() + "-" + pad2(value.getMonth() + 1) + "-" + pad2(value.getDate())
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = ssf.parse_date_code(value)
    if (d) return d.y + "-" + pad2(d.m) + "-" + pad2(d.d)
  }
  const s = String(value ?? "").trim()
  if (!s) return s
  // 文本日期:兼容 2026-08-22 / 2026/8/22 / 2026.8.22(自动去时间部分)
  const m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) return m[1] + "-" + pad2(parseInt(m[2], 10)) + "-" + pad2(parseInt(m[3], 10))
  return s
}

/** 上传前预处理 xlsx:日期列统一转文本 YYYY-MM-DD,工作表固定命名为 Sheet1(与后端对齐) */
async function normalizeImportFile(file: File): Promise<File> {
  // 动态加载 xlsx(仅在导入文件时拉取,避免撑大主包)
  const XLSX = await import("xlsx")
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true })
  const first = wb.SheetNames[0]
  if (!first) return file
  const ws = wb.Sheets[first]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" })
  if (rows.length === 0) return file
  const header = rows[0].map((c) => String(c ?? "").trim())
  const dateIdx = header.indexOf("日期")
  if (dateIdx < 0) return file
  const aoa: unknown[][] = [
    rows[0],
    ...rows.slice(1).map((row) => {
      const next = [...row]
      if (dateIdx < next.length) next[dateIdx] = excelDateToText(next[dateIdx], XLSX.SSF)
      return next
    }),
  ]
  const outWs = XLSX.utils.aoa_to_sheet(aoa)
  const outWb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(outWb, outWs, "Sheet1")
  const buf = XLSX.write(outWb, { type: "array", bookType: "xlsx" })
  return new File([buf], file.name, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
}

export function BatchDetailView({ batchId, onBack, onChanged }: {
  batchId: string
  onBack: () => void
  onChanged: () => void
}) {
  const [detail, setDetail] = useState<FinanceBatchDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<FinanceItem | null>(null)
  const [deleteItemTarget, setDeleteItemTarget] = useState<FinanceItem | null>(null)
  const [logTarget, setLogTarget] = useState<FinanceItem | null>(null)
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
      toast.error(friendlyFinanceError(err instanceof Error ? err.message : "批次加载失败"))
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
      toast.error(friendlyFinanceError(err instanceof Error ? err.message : "模板下载失败"))
    }
  }

  async function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    try {
      let uploadFile = file
      try {
        uploadFile = await normalizeImportFile(file)
      } catch {
        // 文件解析失败则原样上传,由后端给出具体错误
      }
      const data = await financeApi.importPreview(batchId, uploadFile)
      setPreview(data)
    } catch (err) {
      toast.error(friendlyFinanceError(err instanceof Error ? err.message : "导入解析失败"))
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
      toast.error(friendlyFinanceError(err instanceof Error ? err.message : "导入失败"))
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
      toast.error(friendlyFinanceError(err instanceof Error ? err.message : "操作失败"))
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
      await onChanged()
      onBack()
    } catch (err) {
      toast.error(friendlyFinanceError(err instanceof Error ? err.message : "删除失败"))
      setDeleteOpen(false)
    } finally {
      setBusy(false)
    }
  }

  async function deleteItem() {
    if (!deleteItemTarget) return
    setBusy(true)
    try {
      await financeApi.deleteItem(deleteItemTarget.id)
      toast.success("明细已删除")
      setDeleteItemTarget(null)
      await load()
      onChanged()
    } catch (err) {
      toast.error(friendlyFinanceError(err instanceof Error ? err.message : "删除失败"))
      setDeleteItemTarget(null)
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
  const returnPct = s.total_should_return > 0
    ? Math.min(100, Math.round((s.total_returned / s.total_should_return) * 100))
    : 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
          <ArrowLeft /> 返回
        </Button>
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          {detail.name}
          <Badge variant={active ? "default" : "outline"}>{active ? "进行中" : "已完成"}</Badge>
        </h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={!active} onClick={() => fileRef.current?.click()}>
            <FileSpreadsheet /> 导入 Excel
          </Button>
          <Button variant="outline" size="sm" disabled={!active} onClick={() => setAddOpen(true)}>
            <Plus /> 手动加明细
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="更多操作">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={downloadTemplate}>
                <Download /> 下载导入模板
              </DropdownMenuItem>
              {active && (
                <DropdownMenuItem onClick={() => setCompleteOpen(true)}>
                  <CheckCircle2 /> 标记批次完成
                </DropdownMenuItem>
              )}
              {active && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                    <Trash2 /> 删除批次
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={onPickFile} />
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-x-10 gap-y-5 px-5 py-4">
          <div className="shrink-0">
            <p className="text-xs text-muted-foreground">未交金额</p>
            <p className={cn(
              "mt-1.5 text-2xl leading-none font-semibold tracking-tight tabular-nums",
              s.total_unreturned > 0 ? "text-destructive" : "text-foreground"
            )}>
              ¥{fen2yuan(s.total_unreturned)}
            </p>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">发放总额</dt>
              <dd className="mt-1 font-medium tabular-nums">¥{fen2yuan(s.total_payroll)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">应交</dt>
              <dd className="mt-1 font-medium tabular-nums">¥{fen2yuan(s.total_should_return)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">已交</dt>
              <dd className="mt-1 font-medium tabular-nums">¥{fen2yuan(s.total_returned)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">明细</dt>
              <dd className="mt-1 font-medium tabular-nums">{s.item_count}</dd>
            </div>
          </dl>
          <div className="ml-auto w-full max-w-64">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>回收进度</span>
              <span className="tabular-nums">{returnPct}%</span>
            </div>
            <Progress value={returnPct} className="mt-2 h-1.5" />
            <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
              ¥{fen2yuan(s.total_returned)} / ¥{fen2yuan(s.total_should_return)}
            </p>
          </div>
        </div>
      </Card>

      {unreturned.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/[0.03] p-0">
          <div className="flex items-center gap-2 border-b border-destructive/20 px-5 py-3">
            <AlertTriangle className="size-4 text-destructive" />
            <h4 className="text-sm font-medium text-destructive">未交名单（{unreturned.length}）</h4>
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              合计 ¥{fen2yuan(s.total_unreturned)}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-7 gap-y-2 px-5 py-3 text-sm">
            {unreturned.map((i) => (
              <div key={i.id} className="flex items-center gap-2">
                <span className="font-medium">{i.participant.name}</span>
                <span className="tabular-nums text-destructive">欠 ¥{fen2yuan(i.unreturned)}</span>
                {i.note && <span className="text-xs text-muted-foreground">备注：{i.note}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
          <h4 className="text-sm font-medium">明细（{items.length}）</h4>
          {active && unreturned.length > 0 && (
            <span className="text-xs text-muted-foreground">点击「收款」登记上交，资金池自动入账</span>
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
                    暂无明细，点「手动加明细」或「导入 Excel」添加
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
                      <div className="flex items-center justify-end gap-1">
                        {active && i.unreturned > 0 && (
                          <Button size="sm" variant="outline" onClick={() => setSubmitTarget(i)}>
                            <HandCoins /> 收款
                          </Button>
                        )}
                        {i.submissions.length > 0 && (
                          <Button size="sm" variant="ghost" title="查看上交记录" onClick={() => setLogTarget(i)}>
                            <History /> <span className="tabular-nums">{i.submissions.length}</span>
                          </Button>
                        )}
                        {active && (
                          <Button size="sm" variant="ghost" title="编辑明细" onClick={() => setEditTarget(i)}>
                            <Pencil />
                          </Button>
                        )}
                        {active && i.returned === 0 && (
                          <Button size="sm" variant="ghost" className="text-destructive" title="删除明细" onClick={() => setDeleteItemTarget(i)}>
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ItemDialog
        open={addOpen || !!editTarget}
        item={editTarget}
        onOpenChange={(open) => { if (!open) { setAddOpen(false); setEditTarget(null) } }}
        batchId={batchId}
        onSaved={load}
      />
      <SubmitDialog target={submitTarget} onOpenChange={(open) => !open && setSubmitTarget(null)} onSubmitted={load} />
      <SubmissionsDialog target={logTarget} onOpenChange={(open) => !open && setLogTarget(null)} onChanged={load} active={active} />
      <ImportPreviewDialog preview={preview} onOpenChange={(open) => !open && setPreview(null)} confirming={confirming} onConfirm={confirmImport} />

      <AlertDialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>标记批次完成?</AlertDialogTitle>
            <AlertDialogDescription>批次完成需要全部明细交清；完成后不可再添加明细、收款或删除。确定继续?</AlertDialogDescription>
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
            <AlertDialogDescription>仅可删除进行中、且还没有任何上交记录的批次。删除后该批次及其明细不可恢复；若已收过款，请先在明细里撤销上交。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={deleteBatch} disabled={busy}>确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteItemTarget} onOpenChange={(open) => !open && setDeleteItemTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这条明细?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteItemTarget ? deleteItemTarget.participant.name + " · 应交 ¥" + fen2yuan(deleteItemTarget.should_return) + "；删除后不可恢复。" : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={deleteItem} disabled={busy}>确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============ 明细新增 / 编辑 ============
function ItemDialog({ open, item, onOpenChange, batchId, onSaved }: {
  open: boolean
  item: FinanceItem | null
  onOpenChange: (open: boolean) => void
  batchId: string
  onSaved: () => Promise<void>
}) {
  const editing = !!item
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

  // 打开时按"新建/编辑"填充初始值
  useEffect(() => {
    if (!open) return
    setError("")
    if (item) {
      setName(item.participant.name)
      setStudentNo(item.participant.student_no)
      setDate(item.date)
      setPayroll(fen2yuan(item.payroll_amount))
      setTax(fen2yuan(item.tax_amount))
      setTip(fen2yuan(item.tip_amount))
      setShouldReturn(fen2yuan(item.should_return))
      setNote(item.note)
    } else {
      setName("")
      setStudentNo("")
      setDate(today())
      setPayroll("")
      setTax("0")
      setTip("0")
      setShouldReturn("")
      setNote("")
    }
  }, [open, item])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !studentNo.trim() || !date || !payroll.trim()) {
      setError("姓名、学号、日期、应发为必填项")
      return
    }
    const payrollFen = yuan2fen(payroll)
    const taxFen = yuan2fen(tax)
    const tipFen = yuan2fen(tip)
    if (payrollFen == null || payrollFen <= 0) {
      setError("应发金额不合法（需大于 0）")
      return
    }
    if (taxFen == null || taxFen < 0 || tipFen == null || tipFen < 0) {
      setError("扣税或辛苦费金额不合法")
      return
    }
    // 显式填了应交（含 0）就覆盖；留空则交后端按公式自动算
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
      if (editing && item) {
        await financeApi.updateItem(item.id, {
          date,
          ...(item.returned > 0 ? {} : {
            payroll_amount: payrollFen,
            tax_amount: taxFen,
            tip_amount: tipFen,
            should_return: override ?? Math.max(payrollFen - tipFen, 0),
          }),
          note: note.trim(),
        })
        toast.success("明细已更新")
      } else {
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
      }
      onOpenChange(false)
      await onSaved()
    } catch (err) {
      setError(friendlyFinanceError(err instanceof Error ? err.message : "保存失败"))
    } finally {
      setBusy(false)
    }
  }

  const payrollFenLive = yuan2fen(payroll) ?? 0
  const tipFenLive = yuan2fen(tip) ?? 0
  const auto = Math.max(payrollFenLive - tipFenLive, 0)
  const locked = editing && (item?.returned ?? 0) > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {editing ? <Pencil className="size-5" /> : <UserPlus className="size-5" />}
          </span>
          <DialogHeader className="pt-1.5">
            <DialogTitle className="text-lg">{editing ? "编辑明细" : "手动加明细"}</DialogTitle>
            <DialogDescription>
              应交 = 应发 − 辛苦费（扣税只是暂扣、仅作登记，不减税）
            </DialogDescription>
          </DialogHeader>
        </div>

        {locked && (
          <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
            该明细已有上交记录，金额已被锁定，仅可修改日期与备注；如需改金额请先在上交记录里撤销上交。
          </p>
        )}

        <form onSubmit={submit} className="mt-1 grid grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="ai-name" className="text-sm font-medium">姓名 <RequiredMark /></Label>
            <Input id="ai-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：张同学" className="h-10" disabled={editing} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-no" className="text-sm font-medium">学号 <RequiredMark /></Label>
            <Input id="ai-no" value={studentNo} onChange={(e) => setStudentNo(e.target.value)} placeholder="如：20240001" className="h-10" disabled={editing} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-date" className="text-sm font-medium">日期 <RequiredMark /></Label>
            <Input id="ai-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-payroll" className="text-sm font-medium">应发（元） <RequiredMark /></Label>
            <Input id="ai-payroll" value={payroll} onChange={(e) => setPayroll(e.target.value)} placeholder="如：2500" inputMode="decimal" className="h-10" disabled={locked} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-tax" className="text-sm font-medium">扣税（元）</Label>
            <Input id="ai-tax" value={tax} onChange={(e) => setTax(e.target.value)} placeholder="如：0" inputMode="decimal" className="h-10" disabled={locked} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-tip" className="text-sm font-medium">辛苦费（元）</Label>
            <Input id="ai-tip" value={tip} onChange={(e) => setTip(e.target.value)} placeholder="如：100" inputMode="decimal" className="h-10" disabled={locked} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="ai-return" className="text-sm font-medium">应交（元）</Label>
            <Input id="ai-return" value={shouldReturn} onChange={(e) => setShouldReturn(e.target.value)} placeholder={"留空自动：" + fen2yuan(auto)} inputMode="decimal" className="h-10" disabled={locked} />
            <p className="text-xs text-muted-foreground">留空则按「应发 − 辛苦费」自动计算；填 0 表示应交为 0。</p>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="ai-note" className="text-sm font-medium">备注（选填）</Label>
            <Input id="ai-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="如：7 月劳务费" className="h-10" />
          </div>
          {error && (
            <p className="col-span-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          <DialogFooter className="col-span-2 gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              {busy ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============ 收款（上交登记） ============
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
      toast.success("收款登记成功，资金池已入账")
      onOpenChange(false)
      await onSubmitted()
    } catch (err) {
      setError(friendlyFinanceError(err instanceof Error ? err.message : "收款失败"))
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
            <Label htmlFor="sd-amount" className="text-sm font-medium">本次上交金额（元） <RequiredMark /></Label>
            <Input id="sd-amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="如：2100" inputMode="decimal" autoFocus className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sd-date" className="text-sm font-medium">上交日期 <RequiredMark /></Label>
            <Input id="sd-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sd-note" className="text-sm font-medium">备注（选填）</Label>
            <Input id="sd-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="如：补交" className="h-10" />
          </div>
          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={busy}>{busy ? "登记中…" : "确认收款"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============ 上交记录 / 撤销 ============
function SubmissionsDialog({ target, onOpenChange, onChanged, active }: {
  target: FinanceItem | null
  onOpenChange: (open: boolean) => void
  onChanged: () => Promise<void>
  active: boolean
}) {
  const [voidTarget, setVoidTarget] = useState<FinanceSubmission | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!target) {
      setVoidTarget(null)
      setBusy(false)
    }
  }, [target])

  async function doVoid() {
    if (!voidTarget) return
    setBusy(true)
    try {
      await financeApi.voidSubmission(voidTarget.id)
      toast.success("已撤销该笔上交，资金池与余额已回退")
      setVoidTarget(null)
      await onChanged()
      onOpenChange(false)
    } catch (err) {
      toast.error(friendlyFinanceError(err instanceof Error ? err.message : "撤销失败"))
      setVoidTarget(null)
    } finally {
      setBusy(false)
    }
  }

  const subs = target?.submissions ?? []

  return (
    <>
      <Dialog open={!!target} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>上交记录</DialogTitle>
            <DialogDescription>
              {target
                ? target.participant.name + " · 已交 ¥" + fen2yuan(target.returned) + " / 应交 ¥" + fen2yuan(target.should_return)
                : ""}
            </DialogDescription>
          </DialogHeader>
          {subs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">暂无上交记录</p>
          ) : (
            <div className="max-h-[60vh] overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">上交日期</th>
                    <th className="px-3 py-2 text-right font-medium">金额</th>
                    <th className="px-3 py-2 font-medium">备注</th>
                    {active && <th className="px-3 py-2 text-right font-medium">操作</th>}
                  </tr>
                </thead>
                <tbody>
                  {subs.map((sub) => (
                    <tr key={sub.id} className="border-b last:border-0">
                      <td className="px-3 py-2 tabular-nums">{fmtDate(sub.date)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">¥{fen2yuan(sub.amount)}</td>
                      <td className="max-w-[12rem] truncate px-3 py-2 text-muted-foreground" title={sub.note}>{sub.note || "—"}</td>
                      {active && (
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setVoidTarget(sub)}>
                            <Undo2 /> 撤销
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            撤销会删除该笔上交记录，并自动回退资金池余额与个人应交余额，不影响其他上交记录。
          </p>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!voidTarget} onOpenChange={(open) => !open && setVoidTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>撤销这笔上交?</AlertDialogTitle>
            <AlertDialogDescription>
              {voidTarget ? "将删除 " + fmtDate(voidTarget.date) + " 的 ¥" + fen2yuan(voidTarget.amount) + " 上交记录，并回退资金池与应交余额。此操作不可恢复。" : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={(e) => { e.preventDefault(); void doVoid() }} disabled={busy}>
              {busy ? "撤销中…" : "确认撤销"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ============ 导入 Excel 预览 ============
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
            有效 {preview?.valid_count ?? 0} 行，错误 {preview?.error_count ?? 0} 行（错误行不入库）
          </DialogDescription>
        </DialogHeader>
        <p className="-mt-1 text-xs text-muted-foreground">
          日期列已自动归一化为 YYYY-MM-DD（支持 2026-08-22、2026/8/22、2026.8.22 及 Excel 日期单元格）
        </p>
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
                  <th className="px-3 py-2 text-right font-medium">应交</th>
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
                    <td className="px-3 py-1.5 text-right font-medium tabular-nums">{fen2yuan(Math.max(r.payroll_amount - r.tip_amount, 0))}</td>
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
              <h5 className="mb-1 text-sm font-medium text-destructive">错误行（{preview.error_rows.length}）</h5>
              <ul className="space-y-1 text-xs text-destructive">
                {preview.error_rows.map((e, idx) => <li key={idx}>{e}</li>)}
              </ul>
            </div>
          )}
        </ScrollArea>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirming}>取消</Button>
          <Button onClick={onConfirm} disabled={confirming || (preview?.valid_count ?? 0) === 0}>
            {confirming ? <Loader2 className="animate-spin" /> : null}
            确认导入（{preview?.valid_count ?? 0} 条）
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
