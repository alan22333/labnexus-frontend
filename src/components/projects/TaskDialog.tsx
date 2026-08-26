import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { projectApi } from "@/lib/api"
import type { Milestone, ProjectMember, Task, TaskPriority } from "@/lib/types"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  projectId: string
  members: ProjectMember[]
  milestones: Milestone[]
  task?: Task | null
  onSaved?: () => void
}

/** 任务创建/编辑对话框 */
export function TaskDialog({ open, onOpenChange, projectId, members, milestones, task, onSaved }: Props) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [assigneeId, setAssigneeId] = useState("")
  const [priority, setPriority] = useState<TaskPriority>("medium")
  const [dueDate, setDueDate] = useState("")
  const [milestoneId, setMilestoneId] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setTitle(task?.title ?? "")
    setDescription(task?.description ?? "")
    setAssigneeId(task?.assignee_id ?? "")
    setPriority(task?.priority ?? "medium")
    setDueDate(task?.due_date ?? "")
    setMilestoneId(task?.milestone_id ?? "")
    setError("")
  }, [open, task])

  async function save() {
    if (!title.trim()) {
      setError("任务标题不能为空")
      return
    }
    setBusy(true)
    setError("")
    const payload = {
      title: title.trim(),
      description,
      assignee_id: assigneeId || undefined,
      priority,
      due_date: dueDate || null,
      milestone_id: milestoneId || null,
    }
    try {
      if (task) {
        await projectApi.updateTask(task.id, payload)
        toast.success("任务已更新")
      } else {
        await projectApi.createTask(projectId, payload)
        toast.success("任务已创建")
      }
      onOpenChange(false)
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "编辑任务" : "新建任务"}</DialogTitle>
          <DialogDescription>任务将出现在项目看板中,按状态流转</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="task-title">标题</Label>
            <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="任务内容" maxLength={200} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-desc">描述</Label>
            <Textarea id="task-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="补充说明(可选)" className="min-h-20" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>负责人</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="未指派" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">未指派</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.user.id} value={m.user.id}>{m.user.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>优先级</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">🔴 高</SelectItem>
                  <SelectItem value="medium">🟡 中</SelectItem>
                  <SelectItem value="low">🟢 低</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-due">截止日期</Label>
              <Input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>里程碑</Label>
              <Select value={milestoneId} onValueChange={setMilestoneId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="无里程碑" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">无里程碑</SelectItem>
                  {milestones.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
