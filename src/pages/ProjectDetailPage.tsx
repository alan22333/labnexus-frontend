import { useCallback, useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import {
  ArrowLeft, CalendarDays, CheckCircle2, Flag, Pencil, Play, Plus, RefreshCw, RotateCcw, Trash2, UserPlus, X,
} from "lucide-react"
import { toast } from "sonner"

import { Avatar } from "@/components/common/Avatar"
import { TaskDialog } from "@/components/projects/TaskDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/use-auth"
import { projectApi } from "@/lib/api"
import { formatDate } from "@/lib/format"
import type { Milestone, ProjectDetail, Task, TaskStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

const COLUMNS: { status: TaskStatus; label: string; dot: string; empty: string }[] = [
  { status: "todo", label: "待办", dot: "bg-slate-400", empty: "还没有待办任务" },
  { status: "in_progress", label: "进行中", dot: "bg-blue-500", empty: "没有进行中的任务" },
  { status: "blocked", label: "受阻", dot: "bg-amber-500", empty: "没有受阻任务" },
  { status: "done", label: "完成", dot: "bg-emerald-500", empty: "还没有完成任务" },
]

const TRANSITIONS: Record<TaskStatus, { to: TaskStatus; label: string; icon: typeof Play }[]> = {
  todo: [{ to: "in_progress", label: "开始", icon: Play }],
  in_progress: [
    { to: "blocked", label: "受阻", icon: X },
    { to: "done", label: "完成", icon: CheckCircle2 },
  ],
  blocked: [
    { to: "todo", label: "重开", icon: RotateCcw },
    { to: "in_progress", label: "继续", icon: Play },
  ],
  done: [],
}

const STATUS_BADGE: Record<TaskStatus, string> = {
  todo: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-50 text-blue-600",
  blocked: "bg-amber-50 text-amber-600",
  done: "bg-emerald-50 text-emerald-600",
}

export function ProjectDetailPage() {
  const { id = "" } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const [memberOpen, setMemberOpen] = useState(false)
  const [milestoneOpen, setMilestoneOpen] = useState(false)
  const [editProjectOpen, setEditProjectOpen] = useState(false)
  const [taskDialog, setTaskDialog] = useState<{ open: boolean; task: Task | null }>({ open: false, task: null })
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<Task | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await projectApi.get(id)
      setDetail(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "项目加载失败")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="rounded-xl border border-dashed bg-background py-20 text-center">
        <p className="text-sm text-muted-foreground">项目不存在或无权访问</p>
        <Button className="mt-4" variant="outline" asChild>
          <Link to="/projects">返回项目列表</Link>
        </Button>
      </div>
    )
  }

  // 后端详情返回平铺的 ProjectView(含 owner/members/milestones/tasks)
  const { members, milestones, tasks } = detail
  const project = detail
  const isOwner = user != null && project.owner?.id === user.id

  async function addMember() {
    const input = document.getElementById("member-user-id") as HTMLInputElement | null
    const uid = input?.value.trim()
    if (!uid) return
    try {
      await projectApi.addMember(project.id, { user_id: uid })
      toast.success("成员已添加")
      setMemberOpen(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "添加失败")
    }
  }

  async function removeMember(userId: string, name: string) {
    try {
      await projectApi.removeMember(project.id, userId)
      toast.success(`已移除成员 ${name}`)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "移除失败")
    }
  }

  async function addMilestone() {
    const nameInput = document.getElementById("ms-name") as HTMLInputElement | null
    const dueInput = document.getElementById("ms-due") as HTMLInputElement | null
    const name = nameInput?.value.trim()
    if (!name) return
    try {
      await projectApi.addMilestone(project.id, { name, due_date: dueInput?.value || null })
      toast.success("里程碑已创建")
      setMilestoneOpen(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建失败")
    }
  }

  async function toggleMilestone(m: Milestone) {
    try {
      await projectApi.updateMilestone(m.id, { completed_at: m.completed_at ? null : new Date().toISOString() })
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败")
    }
  }

  async function saveProject() {
    const nameInput = document.getElementById("proj-edit-name") as HTMLInputElement | null
    const descInput = document.getElementById("proj-edit-desc") as HTMLInputElement | null
    if (!nameInput?.value.trim()) return
    try {
      await projectApi.update(project.id, { name: nameInput.value.trim(), description: descInput?.value ?? "" })
      toast.success("项目已更新")
      setEditProjectOpen(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败")
    }
  }

  async function transition(task: Task, to: TaskStatus) {
    try {
      await projectApi.transitionTask(task.id, to)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "状态流转失败")
    }
  }

  async function deleteTask() {
    if (!deleteTaskTarget) return
    try {
      await projectApi.deleteTask(deleteTaskTarget.id)
      toast.success("任务已删除")
      setDeleteTaskTarget(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败")
      setDeleteTaskTarget(null)
    }
  }

  return (
    <div>
      {/* 头部 */}
      <div className="mb-5">
        <Link to="/projects" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> 返回项目列表
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">{project.name}</h1>
              <Badge variant={project.status === "done" ? "secondary" : "default"}>
                {project.status === "done" ? "已完成" : "进行中"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {project.description || "暂无描述"} · 负责人:{project.owner?.display_name}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {isOwner && (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditProjectOpen(true)}>
                  <Pencil /> 编辑
                </Button>
                <Button variant="outline" size="sm" onClick={() => setMemberOpen(true)}>
                  <UserPlus /> 加成员
                </Button>
                <Button variant="outline" size="sm" onClick={() => setMilestoneOpen(true)}>
                  <Flag /> 里程碑
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw /> 刷新
            </Button>
            <Button size="sm" onClick={() => setTaskDialog({ open: true, task: null })}>
              <Plus /> 新建任务
            </Button>
          </div>
        </div>
      </div>

      {/* 成员与里程碑 */}
      <Card className="mb-5 p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold">成员 ({members.length})</h3>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <span key={m.user.id} className="group inline-flex items-center gap-1.5 rounded-full bg-muted py-1 pr-2 pl-1">
                  <Avatar name={m.user.display_name} id={m.user.id} className="size-6" />
                  <span className="text-sm">{m.user.display_name}</span>
                  <span className="text-xs text-muted-foreground">{m.role === "owner" ? "负责人" : "成员"}</span>
                  {isOwner && m.role !== "owner" && (
                    <button
                      type="button"
                      className="ml-0.5 rounded-full p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      onClick={() => void removeMember(m.user.id, m.user.display_name)}
                      aria-label={`移除 ${m.user.display_name}`}
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              添加成员需要对方用户 ID(可在其「个人资料」中查看)
            </p>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">里程碑 ({milestones.length})</h3>
            {milestones.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无里程碑</p>
            ) : (
              <ul className="space-y-1.5">
                {milestones.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-sm">
                    {m.completed_at ? (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                    ) : (
                      <span className="size-4 shrink-0 rounded-full border-2 border-slate-300" />
                    )}
                    <span className={cn(m.completed_at && "text-muted-foreground line-through")}>{m.name}</span>
                    {m.due_date && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                        <CalendarDays className="size-3" /> {formatDate(m.due_date)}
                      </span>
                    )}
                    {isOwner && (
                      <button
                        type="button"
                        className="ml-auto text-xs text-primary hover:underline"
                        onClick={() => void toggleMilestone(m)}
                      >
                        {m.completed_at ? "重开" : "完成"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>

      {/* 看板 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.status)
          return (
            <div key={col.status} className="flex flex-col rounded-xl bg-muted/60 p-3">
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className={cn("size-2.5 rounded-full", col.dot)} />
                <span className="text-sm font-semibold">{col.label}</span>
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{colTasks.length}</Badge>
              </div>
              <div className="space-y-2">
                {colTasks.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">{col.empty}</p>
                ) : (
                  colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isOwner={isOwner}
                      isAssignee={user != null && task.assignee_id === user.id}
                      onEdit={() => setTaskDialog({ open: true, task })}
                      onDelete={() => setDeleteTaskTarget(task)}
                      onTransition={(to) => void transition(task, to)}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* 添加成员 */}
      <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>添加成员</DialogTitle>
            <DialogDescription>输入对方用户 ID,将其加入本项目</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="member-user-id">用户 ID</Label>
            <Input id="member-user-id" placeholder="用户 ID(UUID)" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberOpen(false)}>取消</Button>
            <Button onClick={() => void addMember()}>添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新建里程碑 */}
      <Dialog open={milestoneOpen} onOpenChange={setMilestoneOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>新建里程碑</DialogTitle>
            <DialogDescription>里程碑代表项目关键节点</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="ms-name">名称</Label>
              <Input id="ms-name" placeholder="如:初稿 / 开题" maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ms-due">截止日期(可选)</Label>
              <Input id="ms-due" type="date" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMilestoneOpen(false)}>取消</Button>
            <Button onClick={() => void addMilestone()}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑项目 */}
      <Dialog open={editProjectOpen} onOpenChange={setEditProjectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑项目</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="proj-edit-name">名称</Label>
              <Input id="proj-edit-name" defaultValue={project.name} maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proj-edit-desc">描述</Label>
              <Input id="proj-edit-desc" defaultValue={project.description ?? ""} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProjectOpen(false)}>取消</Button>
            <Button onClick={() => void saveProject()}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 任务创建/编辑 */}
      <TaskDialog
        open={taskDialog.open}
        onOpenChange={(v) => setTaskDialog((s) => ({ ...s, open: v }))}
        projectId={project.id}
        members={members}
        milestones={milestones}
        task={taskDialog.task}
        onSaved={() => void load()}
      />

      {/* 删除任务 */}
      <AlertDialog open={deleteTaskTarget != null} onOpenChange={(v) => !v && setDeleteTaskTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除任务「{deleteTaskTarget?.title}」?</AlertDialogTitle>
            <AlertDialogDescription>软删除,任务将从看板中移除。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void deleteTask()} className="bg-destructive text-white hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function TaskCard({
  task, isOwner, isAssignee, onEdit, onDelete, onTransition,
}: {
  task: Task
  isOwner: boolean
  isAssignee: boolean
  onEdit: () => void
  onDelete: () => void
  onTransition: (to: TaskStatus) => void
}) {
  const canEdit = isOwner || isAssignee
  const btns = TRANSITIONS[task.status] ?? []
  return (
    <Card className="p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm leading-snug font-medium">{task.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
            <span className={cn("rounded-full px-1.5 py-0.5 font-medium", STATUS_BADGE[task.status])}>
              {STATUS_BADGE[task.status].includes("slate") ? "待办" : task.status === "in_progress" ? "进行中" : task.status === "blocked" ? "受阻" : "完成"}
            </span>
            {task.priority === "high" && <span className="text-red-500">高优先级</span>}
            {task.priority === "low" && <span className="text-muted-foreground">低优先级</span>}
            {task.due_date && (
              <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                <CalendarDays className="size-3" /> {formatDate(task.due_date)}
              </span>
            )}
          </div>
          {task.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
          )}
          <div className="mt-2 flex items-center gap-1.5">
            {task.assignee ? (
              <>
                <Avatar name={task.assignee.display_name} id={task.assignee.id} className="size-5" />
                <span className="text-xs text-muted-foreground">{task.assignee.display_name}</span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">未指派</span>
            )}
            {canEdit && (
              <span className="ml-auto flex gap-0.5">
                <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted" onClick={onEdit} aria-label="编辑任务">
                  <Pencil className="size-3.5" />
                </button>
                {isOwner && (
                  <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive" onClick={onDelete} aria-label="删除任务">
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </span>
            )}
          </div>
        </div>
      </div>
      {btns.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 border-t pt-2">
          {btns.map((b) => {
            const Icon = b.icon
            return (
              <Button key={b.to} size="xs" variant="outline" onClick={() => onTransition(b.to)}>
                <Icon /> {b.label}
              </Button>
            )
          })}
        </div>
      )}
    </Card>
  )
}


